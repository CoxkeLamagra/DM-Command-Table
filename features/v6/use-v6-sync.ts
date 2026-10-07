"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getV6Campaign, V6_CLIENT_INSTANCE_ID } from "./api-client";

type MutationDetail = { campaignId: string | null; source: "local" | "remote" };

export function useV6Sync(
  campaignId: string | undefined,
  revision: number | undefined,
) {
  const [online, setOnline] = useState(true);
  const [updatesAvailable, setUpdatesAvailable] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [generation, setGeneration] = useState(0);
  const checking = useRef(false);
  const activeCampaign = useRef(campaignId);
  const knownRevision = useRef(revision ?? 0);

  useEffect(() => {
    activeCampaign.current = campaignId;
    knownRevision.current = revision ?? 0;
    const timer = window.setTimeout(() => {
      setUpdatesAvailable(false);
      setConflict(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaignId, revision]);

  const checkRevision = useCallback(async () => {
    if (
      !campaignId ||
      !navigator.onLine ||
      document.visibilityState !== "visible" ||
      checking.current
    )
      return;
    checking.current = true;
    try {
      const campaign = await getV6Campaign(campaignId);
      if (activeCampaign.current !== campaignId) return;
      setOnline(true);
      if (campaign.revision > knownRevision.current) {
        setUpdatesAvailable(true);
      }
    } catch {
      if (activeCampaign.current === campaignId) setOnline(false);
    } finally {
      checking.current = false;
    }
  }, [campaignId]);

  useEffect(() => {
    const onlineListener = () => {
      setOnline(true);
      void checkRevision();
    };
    const offlineListener = () => setOnline(false);
    const connectivity = (event: Event) =>
      setOnline(
        Boolean((event as CustomEvent<{ online: boolean }>).detail.online),
      );
    const mutation = (event: Event) => {
      const detail = (event as CustomEvent<MutationDetail>).detail;
      if (detail.campaignId !== campaignId) return;
      if (detail.source === "remote") {
        setUpdatesAvailable(true);
        void checkRevision();
      } else
        void (async () => {
          try {
            const campaign = await getV6Campaign(campaignId);
            if (activeCampaign.current === campaignId)
              knownRevision.current = campaign.revision;
          } catch {
            setOnline(false);
          }
        })();
    };
    const conflictListener = () => {
      setConflict(true);
      setUpdatesAvailable(true);
    };
    window.addEventListener("online", onlineListener);
    window.addEventListener("offline", offlineListener);
    window.addEventListener("v6:connectivity", connectivity);
    window.addEventListener("v6:mutation", mutation);
    window.addEventListener("v6:conflict", conflictListener);
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("dm-command-table-v6");
      channel.onmessage = (event) => {
        if (event.data?.clientInstanceId !== V6_CLIENT_INSTANCE_ID)
          window.dispatchEvent(
            new CustomEvent("v6:mutation", { detail: event.data }),
          );
      };
    } catch {
      /* polling remains active */
    }
    const timer = window.setInterval(() => void checkRevision(), 8_000);
    const visibility = () => {
      if (document.visibilityState === "visible") void checkRevision();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("online", onlineListener);
      window.removeEventListener("offline", offlineListener);
      window.removeEventListener("v6:connectivity", connectivity);
      window.removeEventListener("v6:mutation", mutation);
      window.removeEventListener("v6:conflict", conflictListener);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(timer);
      channel?.close();
    };
  }, [campaignId, checkRevision]);

  const reloadLatest = useCallback(async () => {
    if (campaignId) {
      const campaign = await getV6Campaign(campaignId);
      knownRevision.current = campaign.revision;
    }
    setUpdatesAvailable(false);
    setConflict(false);
    setGeneration((value) => value + 1);
  }, [campaignId]);

  return { online, updatesAvailable, conflict, generation, reloadLatest };
}

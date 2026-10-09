"use client";
import { ApiError } from "@/domain/types";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCampaign, CLIENT_INSTANCE_ID } from "../shared/api-client";

type MutationDetail = { campaignId: string | null; source: "local" | "remote" };

export function useSync(
  campaignId: string | undefined,
  revision: number | undefined,
) {
  const [online, setOnline] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
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
      const campaign = await getCampaign(campaignId);
      if (activeCampaign.current !== campaignId) return;
      setOnline(true);
      setAccessError(null);
      if (campaign.revision > knownRevision.current) {
        setUpdatesAvailable(true);
      }
    } catch (error) {
      if (activeCampaign.current === campaignId) {
        if (
          error instanceof ApiError &&
          [401, 403, 404].includes(error.status)
        ) {
          setOnline(true);
          setAccessError(
            error.status === 401
              ? "Your login session has expired. Sign in again."
              : "Campaign access is no longer available.",
          );
        } else setOnline(false);
      }
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
            const campaign = await getCampaign(campaignId);
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
    window.addEventListener("workspace:connectivity", connectivity);
    window.addEventListener("workspace:mutation", mutation);
    window.addEventListener("workspace:conflict", conflictListener);
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("dm-command-table");
      channel.onmessage = (event) => {
        if (event.data?.clientInstanceId !== CLIENT_INSTANCE_ID)
          window.dispatchEvent(
            new CustomEvent("workspace:mutation", { detail: event.data }),
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
      window.removeEventListener("workspace:connectivity", connectivity);
      window.removeEventListener("workspace:mutation", mutation);
      window.removeEventListener("workspace:conflict", conflictListener);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(timer);
      channel?.close();
    };
  }, [campaignId, checkRevision]);

  const reloadLatest = useCallback(async () => {
    if (campaignId) {
      const campaign = await getCampaign(campaignId);
      knownRevision.current = campaign.revision;
    }
    setUpdatesAvailable(false);
    setConflict(false);
    setGeneration((value) => value + 1);
  }, [campaignId]);

  return {
    accessError,
    online,
    updatesAvailable,
    conflict,
    generation,
    reloadLatest,
  };
}

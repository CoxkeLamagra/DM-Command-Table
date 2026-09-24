"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cacheCampaign, removeCachedCampaign } from "@/lib/local-campaigns";
import {
  AuthenticationRequiredError,
  createCampaign as createRemoteCampaign,
  deleteCampaign as deleteRemoteCampaign,
  fetchCampaigns,
  shareCampaign as shareRemoteCampaign,
  updateCampaign as updateRemoteCampaign,
} from "@/lib/api/campaign-client";
import { logout as logoutRemote } from "@/lib/api/auth-client";
import { createEmptyCampaign, starterCampaign } from "./defaults";
import { normaliseCampaign } from "./normalise";
import type { Campaign, CampaignState, CampaignUser } from "./types";

export function useCampaignWorkspace() {
  const [data, setData] = useState<CampaignState>(starterCampaign);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("Loading…");
  const [authRequired, setAuthRequired] = useState(false);
  const [user, setUser] = useState<CampaignUser | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIdRef = useRef(currentId);
  const campaignsRef = useRef(campaigns);
  const currentRef = useRef<Campaign | undefined>(undefined);
  const authRequiredRef = useRef(authRequired);
  const dataRef = useRef(data);

  const current = campaigns.find((campaign) => campaign.id === currentId);
  const canEdit = current?.role !== "viewer";

  useEffect(() => {
    currentIdRef.current = currentId;
    campaignsRef.current = campaigns;
    currentRef.current = current;
    authRequiredRef.current = authRequired;
    dataRef.current = data;
  }, [currentId, campaigns, current, authRequired, data]);

  const refresh = useCallback(async (initial: boolean) => {
    try {
      const response = await fetchCampaigns();
      setUser(response.user);
      setAuthRequired(false);
      let incoming = response.campaigns;
      if (!incoming.length)
        incoming = [await createRemoteCampaign(starterCampaign)];
      for (const campaign of incoming) await cacheCampaign(campaign);
      setCampaigns(incoming);
      const selected =
        incoming.find(
          (campaign) =>
            campaign.id === (currentIdRef.current || incoming[0]?.id),
        ) ?? incoming[0];
      const known = campaignsRef.current.find(
        (campaign) => campaign.id === selected?.id,
      );
      if (
        selected &&
        (initial ||
          !currentIdRef.current ||
          new Date(selected.updatedAt) > new Date(known?.updatedAt ?? 0))
      ) {
        setCurrentId(selected.id);
        setData(normaliseCampaign(selected.payload));
      }
      setSaved("Synced");
      setLoaded(true);
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        setAuthRequired(true);
        setLoaded(true);
        return;
      }
      setLoaded(true);
      setSaved("Connection unavailable");
    }
  }, []);

  const save = useCallback(async (next = dataRef.current) => {
    const selected = currentRef.current;
    if (!selected) return;
    const now = new Date().toISOString();
    const local = {
      ...selected,
      name: next.campaignName,
      payload: next,
      updatedAt: now,
    };
    setCampaigns((list) =>
      list.map((campaign) => (campaign.id === selected.id ? local : campaign)),
    );
    await cacheCampaign(local);
    if (authRequiredRef.current) {
      setSaved("Saved on this device");
      return;
    }
    setSaving(true);
    try {
      const result = await updateRemoteCampaign(selected, next);
      const synced = { ...local, updatedAt: result.updatedAt };
      setCampaigns((list) =>
        list.map((campaign) =>
          campaign.id === selected.id ? synced : campaign,
        ),
      );
      await cacheCampaign(synced);
      setSaved("Synced just now");
    } catch {
      setSaved("Offline — saved locally");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    // Initial hydration intentionally synchronizes the client with the local API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!loaded || !currentId || !canEdit) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(data), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, loaded, currentId, canEdit, save]);

  useEffect(() => {
    if (!loaded || authRequired) return;
    const poll = setInterval(() => void refresh(false), 5000);
    return () => clearInterval(poll);
  }, [loaded, authRequired, refresh]);

  const addCampaign = useCallback(async () => {
    try {
      const payload = createEmptyCampaign();
      const created = await createRemoteCampaign(payload);
      await cacheCampaign(created);
      setCampaigns((list) => [created, ...list]);
      setCurrentId(created.id);
      setData(payload);
      toast.success("Campaign created");
    } catch {
      toast.error("Campaign could not be created");
    }
  }, []);

  const selectCampaign = useCallback((id: string) => {
    const selected = campaignsRef.current.find(
      (campaign) => campaign.id === id,
    );
    if (!selected) return;
    setCurrentId(id);
    setData(normaliseCampaign(selected.payload));
  }, []);

  const deleteCampaign = useCallback(async () => {
    const selected = currentRef.current;
    if (
      !selected ||
      selected.role !== "owner" ||
      !confirm(`Delete "${selected.name}"? This cannot be undone.`)
    ) {
      return;
    }
    try {
      await deleteRemoteCampaign(selected.id);
    } catch {
      toast.error("Campaign could not be deleted");
      return;
    }
    await removeCachedCampaign(selected.id);
    const remaining = campaignsRef.current.filter(
      (campaign) => campaign.id !== selected.id,
    );
    setCampaigns(remaining);
    if (remaining[0]) {
      setCurrentId(remaining[0].id);
      setData(remaining[0].payload);
    } else {
      await addCampaign();
    }
  }, [addCampaign]);

  const exportCampaign = useCallback(() => {
    const selected = currentRef.current;
    if (!selected) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "dm-command-table",
            version: 1,
            name: selected.name,
            payload: dataRef.current,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "campaign"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const importCampaign = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        name?: string;
        payload?: CampaignState;
      };
      if (!parsed.payload?.campaignName) throw new Error();
      const payload = normaliseCampaign(parsed.payload);
      const created = await createRemoteCampaign(
        payload,
        parsed.name ?? parsed.payload.campaignName,
      );
      await cacheCampaign(created);
      setCampaigns((list) => [created, ...list]);
      setCurrentId(created.id);
      setData(created.payload);
      toast.success("Campaign imported");
    } catch {
      toast.error("That file is not a valid DM Command Table campaign");
    }
  }, []);

  const shareCampaign = useCallback(
    async (username: string, role: "viewer" | "editor") => {
      const selected = currentRef.current;
      if (!selected || !username.trim()) return false;
      try {
        await shareRemoteCampaign(selected.id, username, role);
        setCampaigns((list) =>
          list.map((campaign) =>
            campaign.id === selected.id
              ? { ...campaign, shared: true }
              : campaign,
          ),
        );
        toast.success("Campaign access granted");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Campaign access could not be granted",
        );
        return false;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRemote();
    setUser(null);
    setCampaigns([]);
    setCurrentId("");
    setAuthRequired(true);
  }, []);

  const patch = useCallback(
    <T extends keyof CampaignState>(key: T, value: CampaignState[T]) => {
      if (currentRef.current?.role !== "viewer") {
        setData((currentData) => ({ ...currentData, [key]: value }));
      }
    },
    [],
  );

  return {
    data,
    setData,
    campaigns,
    currentId,
    current,
    loaded,
    saving,
    saved,
    authRequired,
    user,
    canEdit,
    refresh,
    save,
    addCampaign,
    selectCampaign,
    deleteCampaign,
    exportCampaign,
    importCampaign,
    shareCampaign,
    logout,
    patch,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createV6Campaign,
  copyV6Campaign,
  deleteV6Campaign,
  exportV6Campaign,
  importV6Campaign,
  getV6AuthStatus,
  listV6Campaigns,
  logoutV6,
  updateV6Campaign,
} from "./api-client";
import type { V6Campaign, V6User } from "./types";
import { V6ApiError } from "./types";

export function useV6Workspace() {
  const [user, setUser] = useState<V6User | null>(null);
  const [campaigns, setCampaigns] = useState<V6Campaign[]>([]);
  const [archivedCampaigns, setArchivedCampaigns] = useState<V6Campaign[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [initialSetup, setInitialSetup] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Synced");
  const current = campaigns.find(({ id }) => id === currentId) ?? null;

  const refresh = useCallback(async () => {
    try {
      const status = await getV6AuthStatus();
      setInitialSetup(status.initialSetup);
      setRegistrationEnabled(status.registrationEnabled);
      if (!status.user) {
        setAuthRequired(true);
        setLoaded(true);
        return;
      }
      const [active, archived] = await Promise.all([
        listV6Campaigns(false),
        listV6Campaigns(true),
      ]);
      let next = active;
      if (!next.length) next = [await createV6Campaign()];
      setUser(status.user);
      setCampaigns(next);
      setArchivedCampaigns(archived);
      setCurrentId((selected) =>
        next.some(({ id }) => id === selected) ? selected : (next[0]?.id ?? ""),
      );
      setAuthRequired(false);
      setLoaded(true);
    } catch (error) {
      setLoaded(true);
      toast.error(
        error instanceof Error
          ? error.message
          : "The v6 workspace could not be loaded.",
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const createCampaign = useCallback(async () => {
    try {
      const created = await createV6Campaign();
      setCampaigns((items) => [created, ...items]);
      setCurrentId(created.id);
      toast.success("Campaign created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Campaign creation failed.",
      );
    }
  }, []);

  const saveCampaign = useCallback(
    async (patch: Partial<Pick<V6Campaign, "name" | "notes" | "archived">>) => {
      const selected = current;
      if (!selected || selected.role === "viewer") return false;
      setSaving(true);
      setSaveLabel("Saving…");
      try {
        const updated = await updateV6Campaign(selected, patch);
        if (updated.archived) {
          setCampaigns((items) => items.filter(({ id }) => id !== updated.id));
          setArchivedCampaigns((items) => [updated, ...items]);
          setCurrentId((id) => (id === updated.id ? "" : id));
        } else {
          setCampaigns((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
        }
        setSaveLabel("Synced just now");
        return true;
      } catch (error) {
        if (error instanceof V6ApiError && error.code === "revision_conflict") {
          setSaveLabel("Conflict detected");
          toast.error(
            "This campaign changed in another browser. Reload it before saving again.",
          );
        } else {
          setSaveLabel("Save failed");
          toast.error(
            error instanceof Error ? error.message : "Campaign save failed.",
          );
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [current],
  );

  const signOut = useCallback(async () => {
    await logoutV6();
    setUser(null);
    setCampaigns([]);
    setCurrentId("");
    setAuthRequired(true);
  }, []);

  const restoreCampaign = useCallback(async (campaign: V6Campaign) => {
    try {
      const restored = await updateV6Campaign(campaign, { archived: false });
      setArchivedCampaigns((items) =>
        items.filter(({ id }) => id !== restored.id),
      );
      setCampaigns((items) => [restored, ...items]);
      setCurrentId(restored.id);
      toast.success("Campaign restored");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Campaign restore failed.",
      );
    }
  }, []);

  const copyCampaign = useCallback(
    async (mode: "campaign" | "template") => {
      if (!current) return;
      try {
        const copy = await copyV6Campaign(current.id, mode);
        setCampaigns((items) => [copy, ...items]);
        setCurrentId(copy.id);
        toast.success(
          mode === "template" ? "Campaign template created" : "Campaign copied",
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Campaign copy failed.",
        );
      }
    },
    [current],
  );

  const deleteCampaign = useCallback(async () => {
    if (
      !current ||
      current.role !== "owner" ||
      !window.confirm(`Permanently delete "${current.name}"?`)
    )
      return;
    try {
      await deleteV6Campaign(current.id);
      const remaining = campaigns.filter(({ id }) => id !== current.id);
      setCampaigns(remaining);
      if (remaining.length) setCurrentId(remaining[0].id);
      else {
        const created = await createV6Campaign();
        setCampaigns([created]);
        setCurrentId(created.id);
      }
      toast.success("Campaign deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Campaign deletion failed.",
      );
    }
  }, [campaigns, current]);
  const exportCampaign = useCallback(async () => {
    if (!current) return;
    try {
      const value = await exportV6Campaign(current.id);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${current.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "campaign"}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  }, [current]);
  const importCampaign = useCallback(async (file: File) => {
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error("Campaign imports must be no larger than 4 MB.");
      const imported = await importV6Campaign(JSON.parse(await file.text()));
      setCampaigns((items) => [imported, ...items]);
      setCurrentId(imported.id);
      toast.success("Campaign imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    }
  }, []);

  return {
    user,
    campaigns,
    archivedCampaigns,
    current,
    currentId,
    setCurrentId,
    loaded,
    authRequired,
    initialSetup,
    registrationEnabled,
    saving,
    saveLabel,
    refresh,
    createCampaign,
    copyCampaign,
    deleteCampaign,
    exportCampaign,
    importCampaign,
    saveCampaign,
    restoreCampaign,
    signOut,
  };
}

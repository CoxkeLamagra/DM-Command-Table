"use client";

import type { ChangeEvent, RefObject } from "react";
import { Download, LogOut, Menu, Plus, Save, Share2, Swords, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Campaign, CampaignUser } from "@/features/campaign/types";

export function ApplicationHeader({
  campaigns,
  currentId,
  current,
  user,
  mobileOpen,
  saving,
  saved,
  canEdit,
  fileInput,
  selectCampaign,
  toggleMobile,
  createCampaign,
  exportCampaign,
  importCampaign,
  openShare,
  save,
  logout,
}: {
  campaigns: Campaign[];
  currentId: string;
  current: Campaign | undefined;
  user: CampaignUser | null;
  mobileOpen: boolean;
  saving: boolean;
  saved: string;
  canEdit: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  selectCampaign: (id: string) => void;
  toggleMobile: () => void;
  createCampaign: () => void;
  exportCampaign: () => void;
  importCampaign: (file: File) => void;
  openShare: () => void;
  save: () => void;
  logout: () => void;
}) {
  function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) importCampaign(file);
    event.currentTarget.value = "";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b0d12]/95 px-4 backdrop-blur md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button className="md:hidden" onClick={toggleMobile} aria-label={mobileOpen ? "Close navigation" : "Open navigation"}>
          <Menu />
        </button>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-400/30 bg-amber-300/10 text-amber-300">
          <Swords size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold leading-none">DM Command Table</p>
          <select
            aria-label="Current campaign"
            className="mt-1 max-w-56 bg-transparent text-xs text-stone-400 outline-none"
            value={currentId}
            onChange={(event) => selectCampaign(event.target.value)}
          >
            {campaigns.map((campaign) => (
              <option className="bg-[#12161e]" key={campaign.id} value={campaign.id}>
                {campaign.name}{campaign.role !== "owner" ? ` · ${campaign.role}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <span className="hidden lg:inline">{saving ? "Saving…" : saved}</span>
        <Button size="sm" variant="outline" className="hidden border-white/15 bg-transparent hover:bg-white/5 sm:inline-flex" onClick={createCampaign}>
          <Plus /> Campaign
        </Button>
        <Button size="icon" variant="outline" className="border-white/15 bg-transparent" onClick={exportCampaign} title="Export campaign"><Download /></Button>
        <Button size="icon" variant="outline" className="border-white/15 bg-transparent" onClick={() => fileInput.current?.click()} title="Import campaign"><Upload /></Button>
        {current?.role === "owner" && (
          <Button size="icon" variant="outline" className="border-white/15 bg-transparent" onClick={openShare} title="Share campaign"><Share2 /></Button>
        )}
        <Button size="sm" variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" disabled={!canEdit} onClick={save}>
          <Save size={15} /> Save
        </Button>
        <button onClick={logout} title={`Sign out ${user?.username ?? ""}`} className="rounded-md p-2 hover:bg-white/5 hover:text-stone-200"><LogOut size={17} /></button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
      </div>
    </header>
  );
}

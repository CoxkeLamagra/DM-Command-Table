"use client";

import { useState, type ComponentType } from "react";
import {
  ArchiveRestore,
  BookOpen,
  BookText,
  Library,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Swords,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { APPLICATION_VERSION } from "@/lib/version";
import { CampaignScreen } from "./campaign-screen";
import { V6AuthScreen } from "./auth-screen";
import { SessionsScreen } from "./sessions-screen";
import { StoryScreen } from "./story-screen";
import { PlayersScreen } from "./players-screen";
import { BestiaryScreen } from "./bestiary-screen";
import { CombatScreen } from "./combat-screen";
import { SearchScreen } from "./search-screen";
import { AccountScreen } from "./account-screen";
import { AdminScreen } from "./admin-screen";
import type { V6Section } from "./types";
import { useV6Workspace } from "./use-v6-workspace";
import { useV6Sync } from "./use-v6-sync";

const navigation: {
  id: V6Section;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "campaign", label: "Campaign", icon: BookOpen },
  { id: "story", label: "Story", icon: BookText },
  { id: "sessions", label: "Sessions", icon: Library },
  { id: "players", label: "Players", icon: Users },
  { id: "bestiary", label: "Bestiary", icon: Shield },
  { id: "combat", label: "Combat", icon: Swords },
  { id: "search", label: "Search", icon: Search },
  { id: "account", label: "Account", icon: Settings },
];

export function V6Shell() {
  const workspace = useV6Workspace();
  const [section, setSection] = useState<V6Section>("campaign");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string>();
  const [openStoryId, setOpenStoryId] = useState<string>();
  const sync = useV6Sync(workspace.current?.id, workspace.current?.revision);

  if (!workspace.loaded)
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b0d12] text-stone-400">
        Opening local workspace…
      </div>
    );
  if (workspace.authRequired)
    return (
      <V6AuthScreen
        initialSetup={workspace.initialSetup}
        registrationEnabled={workspace.registrationEnabled}
        onAuthenticated={workspace.refresh}
      />
    );

  const items = workspace.user?.isAdmin
    ? [
        ...navigation,
        {
          id: "administration" as const,
          label: "Administration",
          icon: Shield,
        },
      ]
    : navigation;

  return (
    <div className="min-h-screen bg-[#0b0d12] text-[#f5f0e5]">
      <Toaster theme="dark" position="bottom-right" />
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-[#0b0d12]/95 px-4 backdrop-blur lg:hidden">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu />
        </Button>
        <span className="font-serif text-lg">DM Command Table</span>
      </header>
      <aside
        className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#10131a] transition-transform lg:translate-x-0`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-300 text-black">
            <Swords />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg">DM Command Table</p>
            <p className="text-xs text-stone-500">Version 6 workspace</p>
          </div>
          <Button
            className="lg:hidden"
            size="icon-sm"
            variant="ghost"
            onClick={() => setMenuOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="border-b border-white/10 p-4">
          <label
            className="text-xs uppercase tracking-wider text-stone-500"
            htmlFor="v6-campaign"
          >
            Campaign
          </label>
          <select
            id="v6-campaign"
            className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#191d27] px-3 text-sm"
            value={workspace.currentId}
            onChange={(event) => {
              workspace.setCurrentId(event.target.value);
              setSection("campaign");
            }}
          >
            {workspace.campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={workspace.createCampaign}
          >
            <Plus /> New campaign
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${section === item.id ? "bg-amber-300 text-black" : "text-stone-400 hover:bg-white/5 hover:text-stone-100"}`}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
          {!!workspace.archivedCampaigns.length && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="px-3 text-xs uppercase tracking-wider text-stone-600">
                Archived
              </p>
              {workspace.archivedCampaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-stone-500 hover:bg-white/5"
                  onClick={() => workspace.restoreCampaign(campaign)}
                >
                  <ArchiveRestore className="size-3.5" /> Restore{" "}
                  {campaign.name}
                </button>
              ))}
            </div>
          )}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm">{workspace.user?.displayName}</p>
          <p className="truncate text-xs text-stone-600">
            @{workspace.user?.username}
          </p>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start"
            onClick={workspace.signOut}
          >
            <LogOut /> Sign out
          </Button>
          <a
            className="mt-2 block text-xs text-stone-600 hover:text-amber-300"
            href="https://github.com/CoxkeLamagra/DM-Command-Table"
            target="_blank"
            rel="noreferrer"
          >
            Version {APPLICATION_VERSION}
          </a>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {(!sync.online || sync.updatesAvailable) && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-md rounded-xl border p-4 shadow-2xl lg:right-8 ${sync.online ? "border-amber-300/30 bg-[#272013]" : "border-red-400/30 bg-[#291617]"}`}
          role="status"
        >
          <p className="font-medium">
            {!sync.online
              ? "Working offline"
              : sync.conflict
                ? "Save conflict detected"
                : "Campaign updates available"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {!sync.online
              ? "Your unsaved editor contents remain in this browser. Reconnect before saving."
              : "Another user or browser changed this campaign. Reload when your local edits are safe."}
          </p>
          {sync.online && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() =>
                void (async () => {
                  await workspace.refresh();
                  await sync.reloadLatest();
                })()
              }
            >
              Reload latest
            </Button>
          )}
        </div>
      )}
      <main className="min-h-screen p-4 sm:p-7 lg:ml-72 lg:p-10">
        {workspace.current && section === "campaign" && (
          <CampaignScreen
            key={`${workspace.current.id}:${workspace.current.revision}:${sync.generation}`}
            campaign={workspace.current}
            saving={workspace.saving}
            saveLabel={workspace.saveLabel}
            onSave={workspace.saveCampaign}
            onCopy={workspace.copyCampaign}
            onDelete={workspace.deleteCampaign}
            onExport={workspace.exportCampaign}
            onImport={workspace.importCampaign}
            onOpenSession={(id) => {
              setOpenSessionId(id);
              setSection("sessions");
            }}
          />
        )}
        {workspace.current && section === "story" && (
          <StoryScreen
            key={`${workspace.current.id}:${openStoryId ?? "default"}:${sync.generation}`}
            campaignId={workspace.current.id}
            editable={workspace.current.role !== "viewer"}
            initialOpenId={openStoryId}
            onOpenSession={(id) => {
              setOpenSessionId(id);
              setSection("sessions");
            }}
          />
        )}
        {workspace.current && section === "sessions" && (
          <SessionsScreen
            key={`${workspace.current.id}:${openSessionId ?? "default"}:${sync.generation}`}
            campaignId={workspace.current.id}
            editable={workspace.current.role !== "viewer"}
            initialOpenId={openSessionId}
            onOpenStory={(id) => {
              setOpenStoryId(id);
              setSection("story");
            }}
            onOpenCombat={() => setSection("combat")}
          />
        )}
        {workspace.current && section === "players" && (
          <PlayersScreen
            key={`${workspace.current.id}:${sync.generation}`}
            campaignId={workspace.current.id}
            editable={workspace.current.role !== "viewer"}
          />
        )}
        {workspace.current && section === "bestiary" && (
          <BestiaryScreen
            key={`${workspace.current.id}:${sync.generation}`}
            campaignId={workspace.current.id}
            editable={workspace.current.role !== "viewer"}
          />
        )}
        {workspace.current && section === "combat" && (
          <CombatScreen
            key={`${workspace.current.id}:${sync.generation}`}
            campaignId={workspace.current.id}
            editable={workspace.current.role !== "viewer"}
          />
        )}
        {workspace.current && section === "search" && (
          <SearchScreen
            campaignId={workspace.current.id}
            navigate={(target, id) => {
              if (target === "sessions") setOpenSessionId(id);
              if (target === "story") setOpenStoryId(id);
              setSection(target);
            }}
          />
        )}
        {workspace.user && section === "account" && (
          <AccountScreen user={workspace.user} refresh={workspace.refresh} />
        )}
        {workspace.user?.isAdmin && section === "administration" && (
          <AdminScreen current={workspace.user} />
        )}
      </main>
    </div>
  );
}

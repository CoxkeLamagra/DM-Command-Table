"use client";

import { OneShotQuickStart } from "../adventure/one-shot-quick-start";
import dynamic from "next/dynamic";
import { confirmDiscardChanges } from "@/features/shared/unsaved-changes";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  ArchiveRestore,
  FilePlus as FilePlusIcon,
  BookOpen,
  BookText,
  Library,
  LogOut,
  Menu,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Rows3,
  Settings,
  Shield,
  Swords,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { APPLICATION_VERSION } from "@/lib/version";
import { DraftAccount } from "../shared/draft-recovery";
import { clearUserDrafts } from "../shared/draft-storage";
import { CampaignScreen } from "../campaigns/campaign-screen";
import { AuthScreen } from "../identity/auth-screen";
const SessionsScreen = dynamic(
  () =>
    import("../sessions/sessions-screen").then(
      (module) => module.SessionsScreen,
    ),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const StoryScreen = dynamic(
  () => import("../story/story-screen").then((module) => module.StoryScreen),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const PlayersScreen = dynamic(
  () =>
    import("../characters/players-screen").then(
      (module) => module.PlayersScreen,
    ),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const BestiaryScreen = dynamic(
  () =>
    import("../bestiary/bestiary-screen").then(
      (module) => module.BestiaryScreen,
    ),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const CombatScreen = dynamic(
  () => import("../combat/combat-screen").then((module) => module.CombatScreen),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const SearchScreen = dynamic(
  () => import("../search/search-screen").then((module) => module.SearchScreen),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const AccountScreen = dynamic(
  () =>
    import("../identity/account-screen").then((module) => module.AccountScreen),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
const AdminScreen = dynamic(
  () =>
    import("../administration/admin-screen").then(
      (module) => module.AdminScreen,
    ),
  { loading: () => <p className="p-4 text-stone-400">Loading…</p> },
);
import type { Section } from "@/domain/types";
import { useWorkspace } from "./use-workspace";
import { useSync } from "./use-sync";

const navigation: {
  id: Section;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "campaign", label: "Campaign", icon: BookOpen },
  { id: "story", label: "Story", icon: BookText },
  { id: "sessions", label: "Sessions", icon: Library },
  { id: "players", label: "Players / NPC’s", icon: Users },
  { id: "bestiary", label: "Bestiary", icon: Shield },
  { id: "combat", label: "Combat", icon: Swords },
  { id: "search", label: "Search", icon: Search },
  { id: "account", label: "Account", icon: Settings },
];

import { parseWorkspacePath, workspacePath } from "./routes";
export function Shell() {
  const workspace = useWorkspace();
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [section, setSection] = useState<Section>("campaign");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem("dmct-sidebar-collapsed") === "true"
      );
    } catch {
      return false;
    }
  });
  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem("dmct-sidebar-collapsed", String(next));
    } catch {
      // Persistence is optional; the current preference still applies.
    }
  }
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = document.getElementById("workspace-sidebar");
    const elements = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button,a,select,input,[tabindex="0"]',
        ) ?? [],
      ).filter(
        (node) => node.offsetParent !== null && !node.hasAttribute("disabled"),
      );
    elements()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = elements();
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [menuOpen]);
  const labelClass = sidebarCollapsed ? "lg:hidden" : "";
  const [openSessionId, setOpenSessionId] = useState<string>();
  const [openStoryId, setOpenStoryId] = useState<string>();
  const [openPlayerId, setOpenPlayerId] = useState<string>();
  const [openMonsterId, setOpenMonsterId] = useState<string>();
  const [compact, setCompact] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem("dmct-compact-layout") === "true"
      );
    } catch {
      return false;
    }
  });
  function resetRecordTargets() {
    setOpenSessionId(undefined);
    setOpenStoryId(undefined);
    setOpenPlayerId(undefined);
    setOpenMonsterId(undefined);
  }
  function toggleDensity() {
    const next = !compact;
    setCompact(next);
    try {
      localStorage.setItem("dmct-compact-layout", String(next));
    } catch {
      /* The current preference still applies. */
    }
  }
  const sync = useSync(workspace.current?.id, workspace.current?.revision);
  const routeInitialized = useRef(false);
  const previousPath = useRef("");
  const restoringRoute = useRef(false);
  useEffect(() => {
    if (!workspace.loaded || !workspace.currentId || routeInitialized.current)
      return;
    routeInitialized.current = true;
    const route = parseWorkspacePath(window.location.pathname);
    if (route && workspace.campaigns.some((c) => c.id === route.campaignId)) {
      restoringRoute.current = true;
      const initialPath = window.location.pathname;
      queueMicrotask(() => {
        workspace.setCurrentId(route.campaignId);
        setSection(route.section);
        if (route.section === "sessions") setOpenSessionId(route.recordId);
        if (route.section === "story") setOpenStoryId(route.recordId);
        if (route.section === "players") setOpenPlayerId(route.recordId);
        if (route.section === "bestiary") setOpenMonsterId(route.recordId);
        previousPath.current = initialPath;
        restoringRoute.current = false;
      });
    }
  }, [workspace]);
  useEffect(() => {
    if (
      !routeInitialized.current ||
      !workspace.currentId ||
      restoringRoute.current
    )
      return;
    const record =
      section === "sessions"
        ? openSessionId
        : section === "story"
          ? openStoryId
          : section === "players"
            ? openPlayerId
            : section === "bestiary"
              ? openMonsterId
              : undefined;
    const path = workspacePath(workspace.currentId, section, record);
    if (previousPath.current === path) return;
    if (!previousPath.current) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    previousPath.current = path;
  }, [
    workspace.currentId,
    section,
    openSessionId,
    openStoryId,
    openPlayerId,
    openMonsterId,
  ]);
  useEffect(() => {
    const pop = () => {
      if (!confirmDiscardChanges()) {
        window.history.pushState({}, "", previousPath.current);
        return;
      }
      const route = parseWorkspacePath(window.location.pathname);
      if (!route || !workspace.campaigns.some((c) => c.id === route.campaignId))
        return;
      previousPath.current = window.location.pathname;
      workspace.setCurrentId(route.campaignId);
      setSection(route.section);
      setOpenSessionId(
        route.section === "sessions" ? route.recordId : undefined,
      );
      setOpenStoryId(route.section === "story" ? route.recordId : undefined);
      setOpenPlayerId(route.section === "players" ? route.recordId : undefined);
      setOpenMonsterId(
        route.section === "bestiary" ? route.recordId : undefined,
      );
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [workspace]);

  if (!workspace.loaded)
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b0d12] text-stone-400">
        Opening local workspace…
      </div>
    );
  if (workspace.authRequired)
    return (
      <AuthScreen
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
      {quickStartOpen && (
        <OneShotQuickStart
          sourceId={workspace.current?.id}
          close={() => setQuickStartOpen(false)}
          created={(value) => {
            void workspace.refresh().then(() => {
              workspace.setCurrentId(value.campaign.id);
              setOpenSessionId(value.session.id);
              setSection("sessions");
              setMenuOpen(false);
            });
          }}
        />
      )}
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
        id="workspace-sidebar"
        aria-label="Workspace menu"
        className={`${sidebarCollapsed ? "lg:w-20" : "lg:w-72"} ${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#10131a] transition-transform lg:translate-x-0`}
      >
        <div
          className={`flex h-20 items-center gap-3 border-b border-white/10 px-5 ${sidebarCollapsed ? "lg:justify-center lg:px-3" : ""}`}
        >
          <span className="grid size-10 place-items-center rounded-xl bg-amber-300 text-black">
            <Swords />
          </span>
          <div className={`min-w-0 flex-1 ${labelClass}`}>
            <p className="font-serif text-lg">DM Command Table</p>
            <p className="text-xs text-stone-400">Campaign workspace</p>
          </div>
          <Button
            className="lg:hidden"
            size="icon-sm"
            variant="ghost"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>
        <div className="hidden border-b border-white/10 p-3 lg:block">
          <Button
            variant="ghost"
            className="w-full"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!sidebarCollapsed}
            aria-controls="workspace-sidebar"
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            <span className={labelClass}>Collapse menu</span>
          </Button>
        </div>
        <div className="border-b border-white/10 p-4">
          {sidebarCollapsed && (
            <Button
              variant="ghost"
              className="hidden w-full lg:flex"
              aria-label="Choose campaign"
              title={`Choose campaign: ${workspace.current?.name ?? "No campaign"}`}
              onClick={toggleSidebar}
            >
              <BookOpen />
            </Button>
          )}
          <div className={labelClass}>
            <label
              className="text-xs uppercase tracking-wider text-stone-400"
              htmlFor="campaign"
            >
              Campaign
            </label>
            <select
              id="campaign"
              className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#191d27] px-3 text-sm"
              value={workspace.currentId}
              onChange={(event) => {
                if (!confirmDiscardChanges()) return;
                resetRecordTargets();
                workspace.setCurrentId(event.target.value);
                setSection("campaign");
                setMenuOpen(false);
              }}
            >
              {workspace.campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            aria-label="New campaign"
            title="New campaign"
            className={`mt-2 w-full ${sidebarCollapsed ? "lg:px-0" : ""}`}
            onClick={() => {
              if (!confirmDiscardChanges()) return;
              void workspace.createCampaign().then(() => {
                resetRecordTargets();
                setSection("campaign");
                setMenuOpen(false);
              });
            }}
          >
            <Plus />
            <span className={labelClass}>New campaign</span>
          </Button>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start"
            aria-label="One-shot quick start"
            title="One-shot quick start"
            onClick={() => {
              if (confirmDiscardChanges()) setQuickStartOpen(true);
            }}
          >
            <FilePlusIcon />
            <span className={labelClass}>One-shot quick start</span>
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => {
                if (section === item.id) {
                  setMenuOpen(false);
                  return;
                }
                if (!confirmDiscardChanges()) return;
                resetRecordTargets();
                setSection(item.id);
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg ${sidebarCollapsed ? "lg:justify-center" : ""} px-3 py-2.5 text-left text-sm transition ${section === item.id ? "bg-amber-300 text-black" : "text-stone-400 hover:bg-white/5 hover:text-stone-100"}`}
            >
              <item.icon className="size-4" />
              <span className={labelClass}>{item.label}</span>
            </button>
          ))}
          {!!workspace.archivedCampaigns.length && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p
                className={`px-3 text-xs uppercase tracking-wider text-stone-400 ${labelClass}`}
              >
                Archived
              </p>
              {workspace.archivedCampaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  aria-label={`Restore ${campaign.name}`}
                  title={`Restore ${campaign.name}`}
                  className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-stone-400 hover:bg-white/5"
                  onClick={() => {
                    if (confirmDiscardChanges())
                      void workspace.restoreCampaign(campaign);
                  }}
                >
                  <ArchiveRestore className="size-3.5 shrink-0" />
                  <span className={labelClass}>Restore {campaign.name}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Button
            variant="ghost"
            className="mb-2 w-full"
            aria-label={
              compact ? "Use comfortable layout" : "Use compact layout"
            }
            title={compact ? "Use comfortable layout" : "Use compact layout"}
            aria-pressed={compact}
            onClick={toggleDensity}
          >
            <Rows3 />
            <span className={labelClass}>
              {compact ? "Comfortable layout" : "Compact layout"}
            </span>
          </Button>
          <p className={`truncate text-sm ${labelClass}`}>
            {workspace.user?.displayName}
          </p>
          <p className={`truncate text-xs text-stone-400 ${labelClass}`}>
            @{workspace.user?.username}
          </p>
          <Button
            variant="ghost"
            className={`mt-2 w-full ${sidebarCollapsed ? "lg:justify-center lg:px-0" : "justify-start"}`}
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              if (confirmDiscardChanges())
                void (async () => {
                  const userId = workspace.user?.userId;
                  await workspace.signOut();
                  if (userId) {
                    try {
                      clearUserDrafts(localStorage, userId);
                    } catch {}
                  }
                })();
            }}
          >
            <LogOut />
            <span className={labelClass}>Sign out</span>
          </Button>
          <a
            className="mt-2 block text-xs text-stone-400 hover:text-amber-300"
            href="https://github.com/CoxkeLamagra/DM-Command-Table"
            target="_blank"
            rel="noreferrer"
          >
            <span className={labelClass}>Version {APPLICATION_VERSION}</span>
            {sidebarCollapsed && (
              <span
                className="hidden text-center lg:block"
                title={`Version ${APPLICATION_VERSION}`}
              >
                v{APPLICATION_VERSION}
              </span>
            )}
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
      {(!sync.online || sync.updatesAvailable || sync.accessError) && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-md rounded-xl border p-4 shadow-2xl lg:right-8 ${sync.online ? "border-amber-300/30 bg-[#272013]" : "border-red-400/30 bg-[#291617]"}`}
          role="status"
        >
          <p className="font-medium">
            {sync.accessError
              ? "Access unavailable"
              : !sync.online
                ? "Server unavailable"
                : sync.conflict
                  ? "Save conflict detected"
                  : "Campaign updates available"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {sync.accessError ??
              (!sync.online
                ? "Your unsaved edits remain open. Reconnect before saving; refreshing will discard them."
                : "Another user or browser changed this campaign. Reload when your local edits are safe.")}
          </p>
          {sync.online && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() =>
                void (async () => {
                  if (!confirmDiscardChanges()) return;
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
      <DraftAccount.Provider value={workspace.user?.userId ?? null}>
        <main
          data-density={compact ? "compact" : "comfortable"}
          className={`min-h-screen p-4 sm:p-7 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"} lg:p-10`}
        >
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
              onExportPackage={workspace.exportCampaignPackage}
              onImport={workspace.importCampaign}
              onOpenSession={(id) => {
                if (!confirmDiscardChanges()) return;
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
                if (!confirmDiscardChanges()) return;
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
                if (!confirmDiscardChanges()) return;
                setOpenStoryId(id);
                setSection("story");
              }}
              onOpenCombat={() => {
                if (confirmDiscardChanges()) setSection("combat");
              }}
            />
          )}
          {workspace.current && section === "players" && (
            <PlayersScreen
              key={`${workspace.current.id}:${openPlayerId ?? "default"}:${sync.generation}`}
              campaignId={workspace.current.id}
              editable={workspace.current.role !== "viewer"}
              initialOpenId={openPlayerId}
            />
          )}
          {workspace.current && section === "bestiary" && (
            <BestiaryScreen
              key={`${workspace.current.id}:${openMonsterId ?? "default"}:${sync.generation}`}
              campaignId={workspace.current.id}
              editable={workspace.current.role !== "viewer"}
              initialOpenId={openMonsterId}
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
                if (!confirmDiscardChanges()) return;
                if (target === "sessions") setOpenSessionId(id);
                if (target === "story") setOpenStoryId(id);
                if (target === "players") setOpenPlayerId(id);
                if (target === "bestiary") setOpenMonsterId(id);
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
      </DraftAccount.Provider>
    </div>
  );
}

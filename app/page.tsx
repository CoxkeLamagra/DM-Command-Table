"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  Feather,
  Library,
  LogOut,
  Menu,
  Plus,
  Save,
  ScrollText,
  Settings,
  Share2,
  Swords,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import type { Combatant, PreparedEncounter } from "@/features/campaign/types";
import { useCampaignWorkspace } from "@/features/campaign/use-campaign-workspace";
import { AuthScreen } from "@/features/auth/auth-screen";
import { NavigationItem } from "@/features/shared/ui";
import { createId } from "@/features/campaign/id";
import { CampaignOverview } from "@/features/campaign/campaign-overview";
import { CampaignPlayers } from "@/features/campaign/campaign-players";
import { ShareCampaignDialog } from "@/features/campaign/share-dialog";
import { Sessions } from "@/features/sessions/sessions-screen";
import { Story } from "@/features/story/story-screen";
import { Combat } from "@/features/combat/combat-screen";
import { Bestiary } from "@/features/bestiary/bestiary-screen";
import { AdminScreen } from "@/features/admin/admin-screen";
import { ScreenshotLibraryProvider } from "@/features/screenshots/use-screenshot-library";
import {
  advanceCombatTurn,
  createPreparedCombatants,
  orderCombatants,
} from "@/features/combat/domain";

const uid = createId;
export default function Home() {
  const {
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
  } = useCampaignWorkspace();
  const [mobile, setMobile] = useState(false);
  const [activeTab, setActiveTab] = useState("combat");
  const [targetSessionId, setTargetSessionId] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("editor");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const ordered = useMemo(
    () => orderCombatants(data.combatants),
    [data.combatants],
  );
  const advance = useCallback(() => {
    if (!canEdit || !ordered.length) return;
    const next = advanceCombatTurn(ordered, data.turn, data.round);
    if (!next) return;
    setData((currentData) => ({
      ...currentData,
      turn: next.turn,
      round: next.round,
    }));
  }, [canEdit, ordered, data.turn, data.round, setData]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options?: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "advance_combat_turn",
          title: "Advance combat turn",
          description:
            "Move the visible initiative tracker to the next combatant and advance the round when needed.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => {
            advance();
            return { advanced: true };
          },
        },
        { signal: lifecycle.signal },
      ),
    );
    return () => lifecycle.abort();
  }, [advance]);
  useEffect(() => {
    if (activeTab !== "sessions" || !targetSessionId) return;
    const frame = requestAnimationFrame(() => {
      const entry = document.getElementById(`session-${targetSessionId}`);
      entry?.scrollIntoView({ behavior: "smooth", block: "center" });
      entry?.focus({ preventScroll: true });
      setTargetSessionId("");
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, targetSessionId]);
  async function share() {
    if (await shareCampaign(shareUsername, shareRole)) {
      setShareUsername("");
      setShareOpen(false);
    }
  }
  function openSession(id: string) {
    setTargetSessionId(id);
    setActiveTab("sessions");
    setMobile(false);
  }
  function loadPreparedEncounter(encounter: PreparedEncounter) {
    const currentMonsters = data.combatants.filter(
      (combatant) => combatant.kind === "monster",
    );
    if (
      currentMonsters.length &&
      !window.confirm(
        `Replace ${currentMonsters.length === 1 ? "the current monster combatant" : `all ${currentMonsters.length} current monster combatants`} with "${encounter.name || "Prepared encounter"}"? Players and NPCs will remain.`,
      )
    )
      return;
    const prepared = createPreparedCombatants(encounter, data.monsters, uid);
    const survivors = data.combatants.filter(
      (combatant) => combatant.kind !== "monster",
    );
    setData((currentData) => ({
      ...currentData,
      encounterName: encounter.name.trim() || "Prepared encounter",
      combatants: [...survivors, ...prepared],
      round: 1,
      turn: 0,
    }));
    setActiveTab("combat");
    setMobile(false);
    toast.success(
      `Loaded ${encounter.name || "prepared encounter"} with ${prepared.length} ${prepared.length === 1 ? "monster" : "monsters"}`,
    );
  }
  function updateCombat(id: string, part: Partial<Combatant>) {
    if (canEdit)
      patch(
        "combatants",
        data.combatants.map((c) => (c.id === id ? { ...c, ...part } : c)),
      );
  }
  if (!loaded)
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0d12] text-stone-400">
        <div className="text-center">
          <Swords className="mx-auto mb-3 text-amber-300" />
          <p>Opening the campaign desk…</p>
        </div>
      </main>
    );
  if (authRequired)
    return <AuthScreen onAuthenticated={() => void refresh(true)} />;
  return (
    <ScreenshotLibraryProvider>
    <main className="min-h-screen bg-[#0b0d12] text-[#f5f0e5]">
      <Toaster theme="dark" position="bottom-right" />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b0d12]/95 px-4 backdrop-blur md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="md:hidden"
            onClick={() => setMobile(!mobile)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-400/30 bg-amber-300/10 text-amber-300">
            <Swords size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold leading-none">
              DM Command Table
            </p>
            <select
              aria-label="Current campaign"
              className="mt-1 max-w-56 bg-transparent text-xs text-stone-400 outline-none"
              value={currentId}
              onChange={(e) => selectCampaign(e.target.value)}
            >
              {campaigns.map((c) => (
                <option className="bg-[#12161e]" key={c.id} value={c.id}>
                  {c.name}
                  {c.role !== "owner" ? ` · ${c.role}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span className="hidden lg:inline">{saving ? "Saving…" : saved}</span>
          <Button
            size="sm"
            variant="outline"
            className="hidden border-white/15 bg-transparent hover:bg-white/5 sm:inline-flex"
            onClick={addCampaign}
          >
            <Plus /> Campaign
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-transparent"
            onClick={exportCampaign}
            title="Export campaign"
          >
            <Download />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-transparent"
            onClick={() => fileInput.current?.click()}
            title="Import campaign"
          >
            <Upload />
          </Button>
          {current?.role === "owner" && (
            <Button
              size="icon"
              variant="outline"
              className="border-white/15 bg-transparent"
              onClick={() => setShareOpen(true)}
              title="Share campaign"
            >
              <Share2 />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent hover:bg-white/5"
            disabled={!canEdit}
            onClick={() => save()}
          >
            <Save size={15} /> Save
          </Button>
          <button
            onClick={() => void logout()}
            title={`Sign out ${user?.username ?? ""}`}
            className="rounded-md p-2 hover:bg-white/5 hover:text-stone-200"
          >
            <LogOut size={17} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCampaign(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </header>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setMobile(false);
        }}
        orientation="vertical"
        className="flex min-h-[calc(100vh-4rem)] gap-0"
      >
        <aside
          className={`${mobile ? "fixed inset-x-0 top-16 z-20 flex" : "hidden"} max-h-[calc(100vh-4rem)] w-full flex-col overflow-y-auto border-b border-white/10 bg-[#11141b] p-3 md:static md:flex md:min-h-[calc(100vh-4rem)] md:w-56 md:shrink-0 md:border-b-0 md:border-r`}
        >
          <p className="mb-2 px-3 pt-2 text-[11px] font-semibold uppercase tracking-[.18em] text-amber-300/70">
            Campaign desk
          </p>
          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 flex-col items-stretch gap-1 bg-transparent p-0"
          >
            <NavigationItem value="combat" icon={<Swords />}>
              Combat
            </NavigationItem>
            <NavigationItem value="bestiary" icon={<Library />}>
              Bestiary
            </NavigationItem>
            <NavigationItem value="players" icon={<Users />}>
              Players
            </NavigationItem>
            <NavigationItem value="campaign" icon={<BookOpen />}>
              Campaign
            </NavigationItem>
            <NavigationItem value="sessions" icon={<Feather />}>
              Sessions
            </NavigationItem>
            <NavigationItem value="story" icon={<ScrollText />}>
              Story
            </NavigationItem>
            {user?.isAdmin && (
              <NavigationItem value="admin" icon={<Settings />}>
                Administration
              </NavigationItem>
            )}
          </TabsList>
          <div className="mt-auto hidden rounded-xl border border-white/10 bg-black/20 p-3 md:block">
            <p className="text-xs font-medium text-stone-300">
              {current?.shared ? "Shared campaign" : "Private campaign"} ·{" "}
              {current?.role ?? "owner"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Saved locally and synced to your account.
            </p>
            {current?.role === "owner" && (
              <button
                onClick={deleteCampaign}
                className="mt-3 text-xs text-red-300/70 hover:text-red-300"
              >
                Delete campaign
              </button>
            )}
          </div>
        </aside>
        <section className="min-w-0 flex-1 p-4 md:p-7">
          <TabsContent value="combat">
            <Combat
              data={data}
              ordered={ordered}
              update={updateCombat}
              patch={patch}
              advance={advance}
            />
          </TabsContent>
          <TabsContent value="bestiary">
            <Bestiary data={data} patch={patch} />
          </TabsContent>
          <TabsContent value="players">
            <CampaignPlayers data={data} patch={patch} />
          </TabsContent>
          <TabsContent value="campaign">
            <CampaignOverview
              data={data}
              patch={patch}
              openSession={openSession}
            />
          </TabsContent>
          <TabsContent value="sessions">
            <Sessions
              data={data}
              patch={patch}
              loadEncounter={loadPreparedEncounter}
            />
          </TabsContent>
          <TabsContent value="story">
            <Story data={data} patch={patch} />
          </TabsContent>
          {user?.isAdmin && (
            <TabsContent value="admin">
              <AdminScreen currentUsername={user.username} />
            </TabsContent>
          )}
        </section>
      </Tabs>
      <ShareCampaignDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        username={shareUsername}
        setUsername={setShareUsername}
        role={shareRole}
        setRole={setShareRole}
        onShare={() => void share()}
      />
    </main>
    </ScreenshotLibraryProvider>
  );
}

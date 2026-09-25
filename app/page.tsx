"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swords } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import type { Combatant, PreparedEncounter } from "@/features/campaign/types";
import { useCampaignWorkspace } from "@/features/campaign/use-campaign-workspace";
import { AuthScreen } from "@/features/auth/auth-screen";
import { createId } from "@/features/campaign/id";
import { CampaignOverview } from "@/features/campaign/campaign-overview";
import { CampaignPlayers } from "@/features/campaign/campaign-players";
import { ShareCampaignDialog } from "@/features/campaign/share-dialog";
import { Sessions } from "@/features/sessions/sessions-screen";
import { createSessionNote } from "@/features/sessions/domain";
import { Story } from "@/features/story/story-screen";
import { Combat } from "@/features/combat/combat-screen";
import { Bestiary } from "@/features/bestiary/bestiary-screen";
import { AdminScreen } from "@/features/admin/admin-screen";
import { AccountScreen } from "@/features/account/account-screen";
import { ScreenshotLibraryProvider } from "@/features/screenshots/use-screenshot-library";
import {
  advanceCombatTurn,
  createPreparedCombatants,
  orderCombatants,
  tickConditions,
} from "@/features/combat/domain";
import { ApplicationHeader } from "@/features/app/application-header";
import { ApplicationSidebar } from "@/features/app/application-sidebar";
import { useRecordNavigation } from "@/features/app/use-record-navigation";

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
  const { activeTab, setActiveTab, openSession: navigateToSession, openStory: navigateToStory } = useRecordNavigation();
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
    const nextCombatantId = ordered[next.turn]?.id;
    setData((currentData) => ({
      ...currentData,
      turn: next.turn,
      round: next.round,
      combatants: currentData.combatants.map((combatant) =>
        combatant.id === nextCombatantId
          ? { ...combatant, conditions: tickConditions(combatant.conditions) }
          : combatant,
      ),
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
  async function share() {
    if (await shareCampaign(shareUsername, shareRole)) {
      setShareUsername("");
      setShareOpen(false);
    }
  }
  function openSession(id: string) {
    navigateToSession(id);
    setMobile(false);
  }
  function openStory(id: string) {
    navigateToStory(id);
    setMobile(false);
  }
  async function createCampaignAndOpen() {
    if (!(await addCampaign())) return;
    setActiveTab("campaign");
    setMobile(false);
  }
  function createSessionAndOpen() {
    const session = createSessionNote(
      uid,
      new Date().toISOString().slice(0, 10),
    );
    patch("sessions", [session, ...data.sessions]);
    openSession(session.id);
    toast.success("Session created");
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
      <ApplicationHeader
        campaigns={campaigns}
        currentId={currentId}
        current={current}
        user={user}
        mobileOpen={mobile}
        saving={saving}
        saved={saved}
        canEdit={canEdit}
        fileInput={fileInput}
        selectCampaign={selectCampaign}
        toggleMobile={() => setMobile((open) => !open)}
        createCampaign={() => void createCampaignAndOpen()}
        exportCampaign={exportCampaign}
        importCampaign={(file) => void importCampaign(file)}
        openShare={() => setShareOpen(true)}
        save={() => void save()}
        logout={() => void logout()}
      />
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setMobile(false);
        }}
        orientation="vertical"
        className="flex min-h-[calc(100vh-4rem)] gap-0"
      >
        <ApplicationSidebar
          mobileOpen={mobile}
          campaign={current}
          user={user}
          deleteCampaign={deleteCampaign}
        />
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
              createSession={createSessionAndOpen}
            />
          </TabsContent>
          <TabsContent value="sessions">
            <Sessions
              data={data}
              patch={patch}
              loadEncounter={loadPreparedEncounter}
              openStory={openStory}
            />
          </TabsContent>
          <TabsContent value="story">
            <Story data={data} patch={patch} />
          </TabsContent>
          {user && (
            <TabsContent value="account">
              <AccountScreen user={user} refresh={() => refresh(true)} />
            </TabsContent>
          )}
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

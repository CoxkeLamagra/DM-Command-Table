"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { nextSession } from "@/features/shared/next-session";
import { toast } from "sonner";
import { StatusBadge } from "../shared/progress-status";
import { SaveStatus } from "@/features/shared/save-status";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import { useDraftRecovery } from "../shared/draft-recovery";
import { MemberManager } from "./member-manager";
import type { Campaign, Session } from "@/domain/types";
import {
  createSession,
  listSessions,
  uploadScreenshot,
} from "../shared/api-client";

export function CampaignScreen({
  campaign,
  saving,
  saveLabel,
  onSave,
  onCopy,
  onDelete,
  onExport,
  onExportPackage,
  onImport,
  onOpenSession,
}: {
  campaign: Campaign;
  saving: boolean;
  saveLabel: string;
  onSave: (
    patch: Partial<Pick<Campaign, "name" | "notes" | "archived">>,
  ) => Promise<boolean>;
  onCopy: (mode: "campaign" | "template") => Promise<void>;
  onDelete: () => Promise<void>;
  onExport: () => Promise<void>;
  onExportPackage: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onOpenSession: (id: string) => void;
}) {
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [notes, setNotes] = useState(campaign.notes);
  const dirty = name !== campaign.name || notes !== campaign.notes;
  useUnsavedChanges(dirty);
  const editable = campaign.role !== "viewer";
  const recovery = useDraftRecovery({
    campaignId: campaign.id,
    scope: "campaign",
    value: { name, notes, revision: campaign.revision },
    dirty,
    ready: editable,
    restore: (value) => {
      if (typeof value?.name !== "string" || typeof value?.notes !== "string")
        throw new Error("Invalid draft");
      if (value.revision !== campaign.revision)
        throw new Error(
          "The campaign changed. Download the draft and reconcile it with the current notes.",
        );
      setName(value.name);
      setNotes(value.notes);
    },
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    let live = true;
    void listSessions(campaign.id)
      .then((items) => {
        if (live) setSessions(items);
      })
      .catch((error: unknown) => {
        if (live)
          toast.error(
            error instanceof Error
              ? error.message
              : "Sessions could not be loaded.",
          );
      });
    return () => {
      live = false;
    };
  }, [campaign.id]);

  const upcoming = nextSession(sessions);
  const [creatingSession, setCreatingSession] = useState(false);
  async function save() {
    if (await onSave({ name: name.trim() || "Untitled campaign", notes }))
      recovery.clear();
  }
  async function addSession() {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const session = await createSession(campaign.id, {
        title: "New session",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
        status: "planned",
        sortOrder: sessions.length,
      });
      setSessions((items) => [...items, session]);
      onOpenSession(session.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Session creation failed.",
      );
    } finally {
      setCreatingSession(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      {recovery.banner}
      <header className="sticky top-16 z-20 flex flex-col gap-4 bg-[#0b0d12]/95 py-3 backdrop-blur sm:flex-row sm:items-end sm:justify-between lg:top-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Campaign workspace
          </p>
          <h1 className="mt-1 font-serif text-3xl text-stone-100">
            Campaign details
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-400">
            <ShieldCheck className="size-4" /> {campaign.role} access · revision{" "}
            {campaign.revision}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus dirty={dirty} saving={saving} label="Campaign" />
          {saveLabel.includes("Conflict") && (
            <span role="alert">{saveLabel}</span>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button ref={actionsTrigger} variant="outline" disabled={saving}>
                Campaign actions <ChevronDown />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                onCloseAutoFocus={(event) => {
                  if (accessOpen) event.preventDefault();
                }}
                className="z-50 min-w-56 rounded-lg border border-white/10 bg-[#151820] p-1 text-stone-100 shadow-lg"
              >
                {campaign.role === "owner" && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                    onSelect={() => setAccessOpen(true)}
                  >
                    <ShieldCheck className="size-4" /> Manage access
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                  onSelect={() => void onCopy("campaign")}
                >
                  <Copy className="size-4" /> Copy
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                  onSelect={() => void onCopy("template")}
                >
                  <Copy className="size-4" /> Use as template
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                  onSelect={() => void onExport()}
                >
                  <Download className="size-4" /> Export
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                  onSelect={() => void onExportPackage()}
                >
                  <Download className="size-4" /> Export with images
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                  onSelect={() => importInput.current?.click()}
                >
                  <Upload className="size-4" /> Import
                </DropdownMenu.Item>
                {editable && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                      onSelect={() => void onSave({ archived: true })}
                    >
                      <Archive className="size-4" /> Archive
                    </DropdownMenu.Item>
                  </>
                )}
                {campaign.role === "owner" && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-red-300 outline-none data-[highlighted]:bg-white/10"
                    onSelect={() => void onDelete()}
                  >
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <input
            ref={importInput}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onImport(file);
            }}
          />
          {editable && (
            <Button
              className="bg-amber-300 text-black hover:bg-amber-200"
              onClick={save}
              disabled={saving}
            >
              <Save /> Save
            </Button>
          )}
        </div>
      </header>
      {campaign.role === "owner" && (
        <MemberManager
          campaign={campaign}
          open={accessOpen}
          onOpenChange={setAccessOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            actionsTrigger.current?.focus();
          }}
        />
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <section className="rounded-2xl border border-white/10 bg-[#13161d] p-5 shadow-xl sm:p-7">
          <label
            className="text-sm font-medium text-stone-300"
            htmlFor="campaign-name"
          >
            Campaign name
          </label>
          <Input
            id="campaign-name"
            className="mt-2 h-12 text-lg"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!editable || saving}
          />
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-stone-300">
              Campaign notes
            </p>
            {editable && !saving ? (
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                onPasteImage={uploadScreenshot}
                placeholder="World notes, themes, factions, and plans…"
                className="min-h-80"
              />
            ) : (
              <RichTextContent value={notes} />
            )}
          </div>
        </section>
        <section>
          <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
            <p className="text-xs uppercase tracking-wider text-amber-300">
              {upcoming?.status === "active"
                ? "Continue session"
                : "Next session"}
            </p>
            {upcoming ? (
              <>
                <h2 className="mt-2 font-serif text-xl">{upcoming.title}</h2>
                <p className="mt-2 text-sm text-stone-300">
                  {upcoming.date || "Date not set"}
                </p>
                <Button
                  className="mt-3"
                  onClick={() => onOpenSession(upcoming.id)}
                >
                  {upcoming.status === "active"
                    ? "Continue session"
                    : "Prepare next session"}
                  <ChevronRight />
                </Button>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone-400">
                No active or planned sessions.
              </p>
            )}
            {editable && (
              <Button
                variant="outline"
                className="mt-3 ml-2"
                disabled={creatingSession}
                onClick={addSession}
              >
                <Plus /> New session
              </Button>
            )}
          </div>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.18em] text-amber-300">
                Session history
              </p>
              <h2 className="mt-1 font-serif text-2xl">Timeline</h2>
            </div>
            {editable && (
              <Button
                size="icon"
                onClick={addSession}
                disabled={creatingSession}
                aria-label="Create session"
              >
                <Plus />
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {[...sessions]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((session) => (
                <button
                  key={session.id}
                  onClick={() => onOpenSession(session.id)}
                  className="block w-full rounded-xl border border-white/10 bg-[#13161d] p-4 text-left hover:border-amber-300/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-amber-100">
                      {session.title}
                    </span>
                    <ChevronRight className="size-4 text-stone-400" />
                  </div>
                  <p className="mt-1 text-xs text-stone-400">
                    {session.date || "Date not set"} ·{" "}
                    <StatusBadge status={session.status} />
                  </p>
                  <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm text-stone-400">
                    {session.notes.replace(/<[^>]*>/g, "").slice(0, 2000) ||
                      "No session notes yet."}
                  </p>
                </button>
              ))}
            {!sessions.length && (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-stone-400">
                No sessions yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

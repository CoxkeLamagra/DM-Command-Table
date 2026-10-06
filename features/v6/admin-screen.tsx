"use client";

import Image from "next/image";
import { Plus, Save, Shield, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createV6ManagedAccount,
  deleteV6ManagedAccount,
  deleteV6Screenshot,
  getV6Administration,
  listV6Screenshots,
  setV6Registration,
  setV6ServerSettings,
  updateV6ManagedAccount,
  uploadV6Screenshot,
} from "./api-client";
import type {
  ManagedV6User,
  V6Screenshot,
  V6ServerSettings,
  V6User,
} from "./types";

export function AdminScreen({ current }: { current: V6User }) {
  const [users, setUsers] = useState<ManagedV6User[]>([]);
  const [screenshots, setScreenshots] = useState<V6Screenshot[]>([]);
  const [registration, setRegistration] = useState(false);
  const [settings, setSettings] = useState<V6ServerSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    void Promise.all([getV6Administration(), listV6Screenshots()])
      .then(([state, shots]) => {
        setUsers(state.users);
        setRegistration(state.registrationEnabled);
        setSettings(state.serverSettings);
        setScreenshots(shots);
      })
      .catch(report);
  }, []);

  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Administration update failed.",
    );
  }
  async function create() {
    try {
      const state = await createV6ManagedAccount({
        username,
        displayName,
        password,
      });
      setUsers(state.users);
      setUsername("");
      setDisplayName("");
      setPassword("");
      toast.success("Account created");
    } catch (error) {
      report(error);
    }
  }
  async function patch(
    id: string,
    values: Parameters<typeof updateV6ManagedAccount>[0],
  ) {
    try {
      setUsers(
        (await updateV6ManagedAccount({ ...values, action: "update", id }))
          .users,
      );
    } catch (error) {
      report(error);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this account and all campaigns it owns?")) return;
    try {
      setUsers((await deleteV6ManagedAccount(id)).users);
    } catch (error) {
      report(error);
    }
  }
  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const state = await setV6ServerSettings(settings);
      setSettings(state.serverSettings);
      toast.success("Server settings saved");
    } catch (error) {
      report(error);
    } finally {
      setSavingSettings(false);
    }
  }
  function numberSetting(key: keyof V6ServerSettings, value: string) {
    setSettings((currentSettings) =>
      currentSettings ? { ...currentSettings, [key]: Number(value) } : null,
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <h1 className="font-serif text-3xl">Administration</h1>

      <section className="rounded-xl border border-white/10 bg-[#13161d] p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-amber-200">
              Server settings
            </h2>
            <p className="text-sm text-stone-500">
              Stored locally in SQLite and applied server-wide.
            </p>
          </div>
          <Button onClick={saveSettings} disabled={!settings || savingSettings}>
            <Save /> {savingSettings ? "Saving…" : "Save settings"}
          </Button>
        </div>
        {settings ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Setting
              label="Secure session cookies"
              help="Auto detects HTTPS. Always requires HTTPS; Never is for trusted private HTTP only."
            >
              <select
                className={selectClass}
                value={settings.secureCookieMode}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    secureCookieMode: event.target
                      .value as V6ServerSettings["secureCookieMode"],
                  })
                }
              >
                <option value="auto">Auto-detect HTTPS</option>
                <option value="always">Always secure</option>
                <option value="never">Never secure</option>
              </select>
            </Setting>
            <NumberSetting
              label="Session lifetime"
              help="Days before a new login expires. Existing sessions keep their current expiry."
              value={settings.sessionLifetimeDays}
              min={1}
              max={365}
              suffix="days"
              onChange={(value) => numberSetting("sessionLifetimeDays", value)}
            />
            <NumberSetting
              label="Upload limit"
              help="Maximum original image size for each screenshot."
              value={settings.uploadLimitMb}
              min={1}
              max={50}
              suffix="MB"
              onChange={(value) => numberSetting("uploadLimitMb", value)}
            />
            <NumberSetting
              label="User screenshot quota"
              help="Maximum screenshot storage per account."
              value={settings.screenshotQuotaMb}
              min={1}
              max={10000}
              suffix="MB"
              onChange={(value) => numberSetting("screenshotQuotaMb", value)}
            />
            <NumberSetting
              label="Server screenshot quota"
              help="Maximum screenshot storage across all accounts."
              value={settings.screenshotGlobalQuotaMb}
              min={1}
              max={100000}
              suffix="MB"
              onChange={(value) =>
                numberSetting("screenshotGlobalQuotaMb", value)
              }
            />
            <NumberSetting
              label="Combat undo history"
              help="Number of prior Combat states retained per campaign."
              value={settings.combatHistoryLimit}
              min={1}
              max={1000}
              suffix="states"
              onChange={(value) => numberSetting("combatHistoryLimit", value)}
            />
            <NumberSetting
              label="Audit history"
              help="Maximum audit events retained per campaign or account."
              value={settings.auditEventLimit}
              min={100}
              max={100000}
              suffix="events"
              onChange={(value) => numberSetting("auditEventLimit", value)}
            />
          </div>
        ) : (
          <p className="text-sm text-stone-500">Loading server settings…</p>
        )}
        <p className="mt-5 border-t border-white/10 pt-4 text-xs text-stone-500">
          Database paths, upload paths, and bootstrap secrets remain deployment
          settings and require a server restart.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#13161d] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Account registration</p>
            <p className="text-sm text-stone-500">
              Allow new users to register from the sign-in screen.
            </p>
          </div>
          <Switch
            checked={registration}
            onCheckedChange={async (enabled) => {
              try {
                const state = await setV6Registration(enabled);
                setRegistration(state.registrationEnabled);
              } catch (error) {
                report(error);
              }
            }}
          />
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
          />
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
          />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Initial password"
          />
          <Button onClick={create}>
            <Plus /> Create
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#13161d]">
        {users.map((user) => (
          <div
            key={user.id}
            className="grid gap-3 border-b border-white/10 p-4 last:border-0 md:grid-cols-[1fr_1fr_8rem_12rem] md:items-center"
          >
            <Input
              defaultValue={user.username}
              onBlur={(event) => {
                if (event.target.value !== user.username)
                  void patch(user.id, {
                    action: "update",
                    id: user.id,
                    username: event.target.value,
                    displayName: user.displayName,
                  });
              }}
            />
            <Input
              defaultValue={user.displayName}
              onBlur={(event) => {
                if (event.target.value !== user.displayName)
                  void patch(user.id, {
                    action: "update",
                    id: user.id,
                    username: user.username,
                    displayName: event.target.value,
                  });
              }}
            />
            <span className="text-sm">
              {user.isAdmin ? "Administrator" : "User"}
            </span>
            <div className="flex justify-end gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={user.id === current.userId}
                title="Toggle administrator"
                onClick={() =>
                  patch(user.id, {
                    action: "update",
                    id: user.id,
                    isAdmin: !user.isAdmin,
                  })
                }
              >
                <Shield />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={user.id === current.userId}
                onClick={() => {
                  const value = prompt(
                    "Enter the new password (minimum 8 characters):",
                  );
                  if (value)
                    void patch(user.id, {
                      action: "update",
                      id: user.id,
                      password: value,
                    });
                }}
              >
                Reset password
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={user.id === current.userId}
                onClick={() => remove(user.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#13161d] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Uploaded screenshots</h2>
            <p className="text-sm text-stone-500">
              Local images available to rich-text notes.
            </p>
          </div>
          <label className="cursor-pointer rounded-md bg-amber-300 px-3 py-2 text-sm text-black">
            <Plus className="mr-1 inline size-4" /> Upload
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await uploadV6Screenshot(file);
                  setScreenshots(await listV6Screenshots());
                } catch (error) {
                  report(error);
                }
              }}
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {screenshots.map((shot) => (
            <div
              key={shot.id}
              className="overflow-hidden rounded-lg border border-white/10"
            >
              <Image
                unoptimized
                width={320}
                height={112}
                src={shot.url}
                alt={shot.name}
                className="h-28 w-full bg-black/30 object-contain"
              />
              <div className="flex items-center gap-2 p-2">
                <span className="min-w-0 flex-1 truncate text-xs">
                  {shot.name}
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("Delete this screenshot?")) return;
                    try {
                      await deleteV6Screenshot(shot.id);
                      setScreenshots((all) =>
                        all.filter(({ id }) => id !== shot.id),
                      );
                    } catch (error) {
                      report(error);
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Setting({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <label className="rounded-lg border border-white/10 bg-black/10 p-4">
      <span className="block text-sm font-medium">{label}</span>
      <span className="mb-3 mt-1 block min-h-10 text-xs leading-5 text-stone-500">
        {help}
      </span>
      {children}
    </label>
  );
}
function NumberSetting({
  label,
  help,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: string) => void;
}) {
  return (
    <Setting label={label} help={help}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="w-14 text-xs text-stone-500">{suffix}</span>
      </div>
    </Setting>
  );
}
const selectClass =
  "h-9 w-full rounded-md border border-white/10 bg-[#0d1016] px-3 text-sm text-stone-100 outline-none focus:border-amber-300/50";

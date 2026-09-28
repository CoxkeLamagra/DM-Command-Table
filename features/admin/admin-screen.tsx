"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Shield, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScreenTitle } from "@/features/shared/ui";
import {
  createManagedUser,
  deleteManagedUser,
  fetchAdministration,
  resetManagedUserPassword,
  setAccountRegistration,
  setManagedUserAdmin,
  updateManagedUser,
  type ManagedUser,
} from "@/lib/api/admin-client";
import { AccountDialog, type AccountDialogMode } from "./account-dialog";
import { RegistrationControls } from "./registration-controls";
import { ScreenshotAdmin } from "./screenshot-admin";

export function AdminScreen({ currentUsername }: { currentUsername: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [mode, setMode] = useState<AccountDialogMode>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationBusy, setRegistrationBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const state = await fetchAdministration();
      setUsers(state.users);
      setRegistrationEnabled(state.registrationEnabled);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Users could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial hydration intentionally synchronizes this screen with the admin API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openEdit(user: ManagedUser) {
    setSelected(user);
    setUsername(user.username);
    setDisplayName(user.displayName);
    setMode("edit");
  }

  function openCreate() {
    setSelected(null);
    setUsername("");
    setDisplayName("");
    setPassword("");
    setMode("create");
  }

  function openPassword(user: ManagedUser) {
    setSelected(user);
    setPassword("");
    setMode("password");
  }

  async function saveDialog() {
    if (mode !== "create" && !selected) return;
    setWorkingId(selected?.id ?? "create");
    try {
      const next =
        mode === "create"
          ? await createManagedUser({ username, displayName, password })
          : mode === "edit"
          ? await updateManagedUser({
              id: selected!.id,
              username,
              displayName,
            })
          : await resetManagedUserPassword(selected!.id, password);
      setUsers(next);
      setMode(null);
      toast.success(
        mode === "create"
          ? "Account created"
          : mode === "edit"
            ? "User updated"
            : "Password reset",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "User could not be updated.");
    } finally {
      setWorkingId("");
    }
  }

  async function toggleRegistration(enabled: boolean) {
    setRegistrationBusy(true);
    try {
      const state = await setAccountRegistration(enabled);
      setUsers(state.users);
      setRegistrationEnabled(state.registrationEnabled);
      toast.success(
        enabled ? "Account registration enabled" : "Account registration disabled",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Registration settings could not be updated.",
      );
    } finally {
      setRegistrationBusy(false);
    }
  }

  async function toggleAdmin(user: ManagedUser) {
    setWorkingId(user.id);
    try {
      setUsers(await setManagedUserAdmin(user.id, !user.isAdmin));
      toast.success(user.isAdmin ? "Administrator access removed" : "Administrator access granted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Permissions could not be changed.");
    } finally {
      setWorkingId("");
    }
  }

  async function remove(user: ManagedUser) {
    if (!window.confirm(`Delete the account "${user.username}" and every campaign it owns? This cannot be undone.`)) return;
    setWorkingId(user.id);
    try {
      setUsers(await deleteManagedUser(user.id));
      toast.success("User deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "User could not be deleted.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <ScreenTitle eyebrow="Server administration" title="User management" />
      <p className="-mt-3 mb-6 max-w-3xl text-sm leading-relaxed text-stone-400">
        Manage the local accounts that can access this DM Command Table server.
        Password resets immediately sign the affected user out on every device.
      </p>
      <RegistrationControls
        enabled={registrationEnabled}
        disabled={loading || registrationBusy}
        setEnabled={(enabled) => void toggleRegistration(enabled)}
        createAccount={openCreate}
      />
      {loading ? (
        <p className="text-sm text-stone-400">Loading users…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#12161e]">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_14rem] gap-4 border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 md:grid">
            <span>Username</span>
            <span>Display name</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
          </div>
          {users.map((managedUser) => {
            const isCurrent = managedUser.username === currentUsername;
            const busy = workingId === managedUser.id;
            return (
              <div
                key={managedUser.id}
                className="grid gap-3 border-b border-white/10 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_14rem] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-100">{managedUser.username}</p>
                  {isCurrent && <p className="text-xs text-amber-300/70">Current account</p>}
                </div>
                <p className="truncate text-sm text-stone-400">{managedUser.displayName}</p>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs ${managedUser.isAdmin ? "bg-amber-300/10 text-amber-200" : "bg-white/5 text-stone-400"}`}>
                  {managedUser.isAdmin ? "Administrator" : "User"}
                </span>
                <div className="flex flex-wrap justify-start gap-1 md:justify-end">
                  <Button size="icon" variant="ghost" title="Edit user" disabled={busy} onClick={() => openEdit(managedUser)}>
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="ghost" title="Reset password" disabled={busy} onClick={() => openPassword(managedUser)}>
                    <KeyRound />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title={managedUser.isAdmin ? "Remove administrator access" : "Grant administrator access"}
                    disabled={busy || isCurrent}
                    onClick={() => void toggleAdmin(managedUser)}
                  >
                    {managedUser.isAdmin ? <ShieldCheck /> : <Shield />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-300 hover:text-red-200"
                    title="Delete user"
                    disabled={busy || isCurrent}
                    onClick={() => void remove(managedUser)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AccountDialog
        mode={mode}
        selected={selected}
        username={username}
        displayName={displayName}
        password={password}
        busy={workingId === (selected?.id ?? "create")}
        setUsername={setUsername}
        setDisplayName={setDisplayName}
        setPassword={setPassword}
        close={() => setMode(null)}
        save={() => void saveDialog()}
      />
      <ScreenshotAdmin />
    </>
  );
}

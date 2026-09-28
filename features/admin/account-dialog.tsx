"use client";

import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ManagedUser } from "@/lib/api/admin-client";

export type AccountDialogMode = "create" | "edit" | "password" | null;

export function AccountDialog({
  mode,
  selected,
  username,
  displayName,
  password,
  busy,
  setUsername,
  setDisplayName,
  setPassword,
  close,
  save,
}: {
  mode: AccountDialogMode;
  selected: ManagedUser | null;
  username: string;
  displayName: string;
  password: string;
  busy: boolean;
  setUsername: (value: string) => void;
  setDisplayName: (value: string) => void;
  setPassword: (value: string) => void;
  close: () => void;
  save: () => void;
}) {
  const accountFields = mode === "create" || mode === "edit";
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="border-amber-300/20 bg-[#12161e] text-stone-100">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-amber-100">
            {mode === "create"
              ? "Create account"
              : mode === "edit"
                ? "Edit user"
                : "Reset password"}
          </DialogTitle>
        </DialogHeader>
        {accountFields ? (
          <>
            <label className="text-sm text-stone-300">
              Username
              <Input className="mt-2 border-white/10 bg-black/20" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={32} />
            </label>
            {mode === "create" && (
              <label className="text-sm text-stone-300">
                Initial password
                <Input autoFocus className="mt-2 border-white/10 bg-black/20" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} />
              </label>
            )}
            <label className="text-sm text-stone-300">
              Display name
              <Input className="mt-2 border-white/10 bg-black/20" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} />
            </label>
          </>
        ) : (
          <label className="text-sm text-stone-300">
            New password for {selected?.username}
            <Input autoFocus className="mt-2 border-white/10 bg-black/20" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} />
          </label>
        )}
        <Button
          className="bg-amber-300 text-black hover:bg-amber-200"
          disabled={busy || ((mode === "create" || mode === "password") && password.length < 8) || (accountFields && username.length < 3)}
          onClick={save}
        >
          {mode === "create" ? <UserPlus /> : mode === "edit" ? <Pencil /> : <KeyRound />}
          {mode === "create" ? "Create account" : mode === "edit" ? "Save user" : "Reset password"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

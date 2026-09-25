"use client";

import { useState } from "react";
import { KeyRound, UserRoundPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenTitle } from "@/features/shared/ui";
import type { CampaignUser } from "@/features/campaign/types";
import {
  changeOwnPassword,
  renameOwnAccount,
} from "@/lib/api/account-client";

export function AccountScreen({
  user,
  refresh,
}: {
  user: CampaignUser;
  refresh: () => Promise<void>;
}) {
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function rename() {
    setRenaming(true);
    try {
      const renamed = await renameOwnAccount(username);
      setUsername(renamed);
      await refresh();
      toast.success("Account renamed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The account could not be renamed.",
      );
    } finally {
      setRenaming(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("The new passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The password could not be changed.",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <>
      <ScreenTitle eyebrow="Personal settings" title="Account" />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-[#12161e] p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl text-amber-100">
            <UserRoundPen size={20} /> Rename account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">
            Usernames are unique and are used when sharing campaigns.
          </p>
          <label className="mt-5 block text-sm text-stone-300">
            Username
            <Input
              className="mt-2 border-white/10 bg-black/20"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={32}
              autoComplete="username"
            />
          </label>
          <Button
            className="mt-4 bg-amber-300 text-black hover:bg-amber-200"
            disabled={renaming || username.trim().toLowerCase() === user.username}
            onClick={() => void rename()}
          >
            <UserRoundPen /> {renaming ? "Saving…" : "Save username"}
          </Button>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#12161e] p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl text-amber-100">
            <KeyRound size={20} /> Change password
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">
            Changing your password signs out other active sessions.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm text-stone-300">
              Current password
              <Input className="mt-2 border-white/10 bg-black/20" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="block text-sm text-stone-300">
              New password
              <Input className="mt-2 border-white/10 bg-black/20" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label className="block text-sm text-stone-300">
              Confirm new password
              <Input className="mt-2 border-white/10 bg-black/20" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          </div>
          <Button
            className="mt-4 bg-amber-300 text-black hover:bg-amber-200"
            disabled={changingPassword || !currentPassword || newPassword.length < 8 || confirmPassword.length < 8}
            onClick={() => void changePassword()}
          >
            <KeyRound /> {changingPassword ? "Changing…" : "Change password"}
          </Button>
        </section>
      </div>
    </>
  );
}

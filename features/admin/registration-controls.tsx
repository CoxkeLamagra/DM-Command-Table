"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function RegistrationControls({
  enabled,
  disabled,
  setEnabled,
  createAccount,
}: {
  enabled: boolean;
  disabled: boolean;
  setEnabled: (enabled: boolean) => void;
  createAccount: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-[#12161e] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-stone-100">Account registration</h2>
          <p className="mt-1 text-sm text-stone-400">
            Allow visitors to create their own local account from the sign-in screen.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-stone-300">
          <Switch checked={enabled} disabled={disabled} onCheckedChange={setEnabled} />
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>
      <div className="mb-4 flex justify-end">
        <Button className="bg-amber-300 text-black hover:bg-amber-200" onClick={createAccount}>
          <UserPlus /> Create account
        </Button>
      </div>
    </>
  );
}

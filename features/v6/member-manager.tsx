"use client";

import { useEffect, useState } from "react";
import { Crown, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  grantCampaignAccess,
  listCampaignMembers,
  revokeCampaignAccess,
  transferCampaignOwnership,
} from "./api-client";
import type { CampaignMember, V6Campaign } from "./types";

export function MemberManager({ campaign }: { campaign: V6Campaign }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listCampaignMembers(campaign.id).then(setMembers).catch(report);
  }, [campaign.id, open]);

  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Member update failed.",
    );
  }

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    try {
      setMembers(await grantCampaignAccess(campaign.id, username, role));
      setUsername("");
      toast.success("Campaign access updated");
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(member: CampaignMember) {
    setBusy(true);
    try {
      setMembers(await revokeCampaignAccess(campaign.id, member.userId));
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  async function transfer(member: CampaignMember) {
    if (!window.confirm(`Transfer ownership to ${member.displayName}?`)) return;
    setBusy(true);
    try {
      setMembers(await transferCampaignOwnership(campaign.id, member.userId));
      toast.success("Ownership transferred. Reloading workspace…");
      window.location.reload();
    } catch (error) {
      report(error);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Manage access</Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#151820] text-stone-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Campaign access</DialogTitle>
          <DialogDescription>
            Invite existing local accounts as editors or read-only viewers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={grant} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            aria-label="Username"
          />
          <Select
            value={role}
            onValueChange={(value) => setRole(value as "viewer" | "editor")}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={busy}>
            <UserPlus /> Add or update
          </Button>
        </form>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.displayName}</p>
                <p className="text-xs text-stone-500">
                  @{member.username} · {member.role}
                </p>
              </div>
              {member.role !== "owner" && (
                <>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Transfer ownership"
                    disabled={busy}
                    onClick={() => transfer(member)}
                  >
                    <Crown />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Remove access"
                    disabled={busy}
                    onClick={() => revoke(member)}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

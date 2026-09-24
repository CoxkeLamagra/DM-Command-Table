"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ShareCampaignDialog({
  open,
  onOpenChange,
  username,
  setUsername,
  role,
  setRole,
  onShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  setUsername: (value: string) => void;
  role: "viewer" | "editor";
  setRole: (role: "viewer" | "editor") => void;
  onShare: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-300/20 bg-[#12161e] text-stone-100">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-amber-100">
            Share campaign
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-stone-400">
          Grant access to another registered account on this DM Command Table
          server.
        </p>
        <label className="text-sm text-stone-300">
          Username
          <Input
            className="mt-2 border-white/10 bg-black/20"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="player_name"
          />
        </label>
        <label className="text-sm text-stone-300">
          Permission
          <select
            className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/25 px-3"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "viewer" | "editor")
            }
          >
            <option value="editor">Editor — can change campaign data</option>
            <option value="viewer">Viewer — read only</option>
          </select>
        </label>
        <Button onClick={onShare} className="bg-amber-300 text-black hover:bg-amber-200">
          <Share2 /> Grant access
        </Button>
      </DialogContent>
    </Dialog>
  );
}

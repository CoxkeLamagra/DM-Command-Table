"use client";

import {
  BookOpen,
  CircleUserRound,
  Feather,
  Library,
  ScrollText,
  Settings,
  Swords,
  Users,
} from "lucide-react";
import { TabsList } from "@/components/ui/tabs";
import type { Campaign, CampaignUser } from "@/features/campaign/types";
import { NavigationItem } from "@/features/shared/ui";
import { APPLICATION_VERSION } from "@/lib/version";

export function ApplicationSidebar({
  mobileOpen,
  campaign,
  user,
  deleteCampaign,
}: {
  mobileOpen: boolean;
  campaign: Campaign | undefined;
  user: CampaignUser | null;
  deleteCampaign: () => void;
}) {
  return (
    <aside
      className={`${mobileOpen ? "fixed inset-x-0 top-16 z-20 flex" : "hidden"} max-h-[calc(100vh-4rem)] w-full flex-col overflow-y-auto border-b border-white/10 bg-[#11141b] p-3 md:static md:flex md:min-h-[calc(100vh-4rem)] md:w-56 md:shrink-0 md:border-b-0 md:border-r`}
    >
      <p className="mb-2 px-3 pt-2 text-[11px] font-semibold uppercase tracking-[.18em] text-amber-300/70">
        Campaign desk
      </p>
      <TabsList
        variant="line"
        className="h-auto w-full shrink-0 flex-col items-stretch gap-1 bg-transparent p-0"
      >
        <NavigationItem value="campaign" icon={<BookOpen />}>Campaign</NavigationItem>
        <NavigationItem value="story" icon={<ScrollText />}>Story</NavigationItem>
        <NavigationItem value="sessions" icon={<Feather />}>Sessions</NavigationItem>
        <NavigationItem value="players" icon={<Users />}>Players</NavigationItem>
        <NavigationItem value="bestiary" icon={<Library />}>Bestiary</NavigationItem>
        <NavigationItem value="combat" icon={<Swords />}>Combat</NavigationItem>
        <NavigationItem value="account" icon={<CircleUserRound />}>Account</NavigationItem>
        {user?.isAdmin && (
          <NavigationItem value="admin" icon={<Settings />}>Administration</NavigationItem>
        )}
      </TabsList>
      <div className="mt-auto hidden rounded-xl border border-white/10 bg-black/20 p-3 md:block">
        <p className="text-xs font-medium text-stone-300">
          {campaign?.shared ? "Shared campaign" : "Private campaign"} · {campaign?.role ?? "owner"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">
          Saved locally and synced to your account.
        </p>
        {campaign?.role === "owner" && (
          <button
            onClick={deleteCampaign}
            className="mt-3 text-xs text-red-300/70 hover:text-red-300"
          >
            Delete campaign
          </button>
        )}
      </div>
      <p className="px-3 pb-1 pt-3 text-[10px] text-stone-600">
        DM Command Table v{APPLICATION_VERSION}
      </p>
    </aside>
  );
}

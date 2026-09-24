"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScreenTitle } from "@/features/shared/ui";
import { createId } from "@/features/campaign/id";
import type {
  CampaignPatch,
  CampaignState,
  StoryBeat,
} from "@/features/campaign/types";

const uid = createId;

export function Story({
  data,
  patch,
}: {
  data: CampaignState;
  patch: CampaignPatch;
}) {
  const update = (id: string, p: Partial<StoryBeat>) =>
    patch(
      "story",
      data.story.map((s) => (s.id === id ? { ...s, ...p } : s)),
    );
  return (
    <>
      <ScreenTitle
        eyebrow="Campaign arc"
        title="Storyline"
        action={
          <Button
            onClick={() =>
              patch("story", [
                ...data.story,
                {
                  id: uid(),
                  title: "New story beat",
                  chapter: "Unsorted",
                  details: "",
                  status: "planned",
                },
              ])
            }
            className="bg-amber-300 text-black hover:bg-amber-200"
          >
            <Plus /> Add story beat
          </Button>
        }
      />
      <div className="relative space-y-4 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-white/10">
        {data.story.map((s, i) => (
          <article
            key={s.id}
            className="relative grid grid-cols-[40px_1fr] gap-4"
          >
            <div
              className={`z-10 mt-5 grid h-10 w-10 place-items-center rounded-full border ${s.status === "happened" ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-300" : s.status === "active" ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/15 bg-[#12161e] text-stone-600"}`}
            >
              {s.status === "happened" ? <Check size={18} /> : i + 1}
            </div>
            <div className="rounded-xl border border-white/10 bg-[#12161e] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Input
                    className="h-auto border-0 bg-transparent p-0 font-serif text-xl text-amber-100"
                    value={s.title}
                    onChange={(e) => update(s.id, { title: e.target.value })}
                  />
                  <Input
                    className="mt-1 h-auto border-0 bg-transparent p-0 text-xs uppercase tracking-wider text-stone-500"
                    value={s.chapter}
                    onChange={(e) => update(s.id, { chapter: e.target.value })}
                  />
                </div>
                <select
                  className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={s.status}
                  onChange={(e) =>
                    update(s.id, {
                      status: e.target.value as StoryBeat["status"],
                    })
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active now</option>
                  <option value="happened">Happened</option>
                </select>
              </div>
              <Textarea
                className="mt-4 min-h-24 border-white/10 bg-black/20"
                value={s.details}
                onChange={(e) => update(s.id, { details: e.target.value })}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

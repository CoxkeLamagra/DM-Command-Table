import type { Campaign, Player, Session, Monster, StoryBeat } from "./types.ts";
import type { PreparedEncounter } from "./encounters.ts";
import { emptyContinuity } from "./adventure.ts";
function escape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}
function text(value: string): string {
  return escape(
    value
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(
        /&(amp|lt|gt|quot|apos|nbsp);/g,
        (_, entity: string) =>
          ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[
            entity
          ]!,
      )
      .replace(/&#(\d+);/g, (_, digits: string) => {
        const code = Number(digits);
        return code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }),
  );
}
export function printPacket(
  campaign: Campaign,
  session: Session,
  players: Player[],
  encounters: PreparedEncounter[],
  monsters: Monster[] = [],
  stories: StoryBeat[] = [],
): string {
  const value = session.continuity ?? emptyContinuity(),
    attendees = players.filter((player) =>
      value.attendanceIds.includes(player.id),
    );
  const section = (heading: string, notes: string) =>
    `<section><h2>${escape(heading)}</h2><div class="notes">${text(notes) || "—"}</div></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(session.title)} — DM packet</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}h1,h2,h3{break-after:avoid}section,li{break-inside:avoid}.notes{white-space:pre-wrap}small{color:#555}li{margin-bottom:.8rem}@media print{body{margin:0;max-width:none}h2{border-bottom:1px solid #aaa}}</style></head><body><header><h1>${escape(campaign.name)} — ${escape(session.title)}</h1><p>${escape(session.date || "Undated")} · ${escape(session.status)}${campaign.adventure?.oneShot ? ` · ${campaign.adventure.oneShot.durationMinutes} minute one-shot` : ""}</p><small>DM-only packet · generated from saved data · use your browser’s Print command. Text-only; embedded screenshots remain in the application.</small></header>${section("Preparation", session.notes)}<section><h2>Scene checklist</h2><ol>${value.scenes.map((scene) => `<li><strong>${scene.done ? "✓" : "□"} ${escape(scene.title)}</strong> — ${scene.essential ? "Essential" : "Optional"}, ${scene.minutes} min<div class="notes">${text(scene.notes)}</div></li>`).join("")}</ol></section>${stories
    .filter((story) => story.sessionIds.includes(session.id))
    .map((story) => section(`Linked story: ${story.title}`, story.details))
    .join(
      "",
    )}${section("Actual events / recap", value.recap)}${section("Rewards", value.rewards)}<section><h2>Unresolved threads</h2><ul>${(
    campaign.adventure?.threads ?? []
  )
    .filter(
      (thread) =>
        thread.status === "open" && value.threadIds.includes(thread.id),
    )
    .map(
      (thread) =>
        `<li><strong>${escape(thread.title)}</strong> — ${escape(thread.kind)}<div class="notes">${text(thread.notes)}</div></li>`,
    )
    .join(
      "",
    )}</ul></section><section><h2>Party attendance</h2><ul>${attendees.map((player) => `<li>${escape(player.name)} — ${escape(player.kind)}, HP ${player.hitPoints ?? "—"}, AC ${player.armorClass ?? "—"}</li>`).join("")}</ul></section><section><h2>Prepared encounters</h2>${encounters.map((encounter) => `<h3>${escape(encounter.name)}</h3><div class="notes">${text(encounter.notes)}</div><p>${encounter.monsters.map((entry) => `${escape(monsters.find((monster) => monster.id === entry.monsterId)?.name ?? "Removed monster")} × ${entry.quantity}`).join(", ") || "No Bestiary monsters"}; ${(encounter.combatants ?? []).map((entry) => escape(entry.name) + " (" + escape(entry.kind) + ")").join(", ") || "no custom combatants"}</p>${(encounter.combatants ?? []).map((entry) => `<h4>${escape(entry.name)} (${escape(entry.kind)})</h4><p>HP ${entry.hitPoints}/${entry.maximumHitPoints}, AC ${entry.armorClass}, initiative ${entry.initiative}</p><div class="notes">${text(entry.notes)}</div>`).join("")}`).join("")}</section><section><h2>Encounter stat blocks</h2>${monsters
    .filter((monster) =>
      encounters.some((encounter) =>
        encounter.monsters.some((entry) => entry.monsterId === monster.id),
      ),
    )
    .map(
      (monster) =>
        `<h3>${escape(monster.name)}</h3><p>${escape(monster.type)} · CR ${escape(monster.challengeRating)} · HP ${monster.hitPoints} · AC ${monster.armorClass} · ${escape(monster.speed)}</p><div class="notes">${text([monster.stats, monster.abilities, monster.spells, monster.notes].join("\n"))}</div>`,
    )
    .join("")}</section></body></html>`;
}

import type { Monster } from "@/features/campaign/types";

export const BESTIARY_BASE = "https://dnd5e.lamagra.link";

export type RemoteMonsterRef = { name: string; source: string; file: string };

export type FiveEToolsMonster = {
  name: string;
  source: string;
  size?: string[];
  type?: string | { type?: string; tags?: unknown[] };
  ac?: Array<number | { ac?: number }>;
  hp?: { average?: number; formula?: string };
  speed?: Record<string, number | boolean | { number?: number }>;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  cr?: string | number | { cr?: string | number };
  trait?: unknown[];
  action?: unknown[];
  bonus?: unknown[];
  reaction?: unknown[];
  legendary?: unknown[];
  mythic?: unknown[];
  spellcasting?: unknown[];
};

export function monsterIdentity(
  monster: Pick<Monster, "name" | "source">,
): string {
  return `${monster.name.trim().toLowerCase()}::${(monster.source ?? "").trim().toLowerCase()}`;
}

export function cleanRemoteText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return value
      .replace(/\{@atk mw,rw}/g, "Melee or Ranged Weapon Attack:")
      .replace(/\{@atk mw}/g, "Melee Weapon Attack:")
      .replace(/\{@atk rw}/g, "Ranged Weapon Attack:")
      .replace(
        /\{@\w+\s+([^}]+)}/g,
        (_, content: string) => content.split("|")[0],
      );
  }
  if (Array.isArray(value))
    return value.map(cleanRemoteText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const body = cleanRemoteText(
      record.entries ?? record.entry ?? record.items ?? "",
    );
    return record.name ? `${cleanRemoteText(record.name)} — ${body}` : body;
  }
  return String(value);
}

export function formatRemoteEntries(value: unknown[] | undefined): string {
  return value?.map(cleanRemoteText).filter(Boolean).join("\n\n") ?? "";
}

export function getRemoteSummary(remote: FiveEToolsMonster) {
  const sizes: Record<string, string> = {
    T: "Tiny",
    S: "Small",
    M: "Medium",
    L: "Large",
    H: "Huge",
    G: "Gargantuan",
  };
  const rawType =
    typeof remote.type === "string"
      ? remote.type
      : (remote.type?.type ?? "creature");
  const type =
    `${(remote.size ?? []).map((size) => sizes[size] ?? size).join("/")} ${rawType}`.trim();
  const acEntry = remote.ac?.[0];
  const ac = typeof acEntry === "number" ? acEntry : (acEntry?.ac ?? 10);
  const hp = remote.hp?.average ?? 10;
  const cr =
    typeof remote.cr === "object" ? (remote.cr.cr ?? "—") : (remote.cr ?? "—");
  return { type, ac, hp, cr: String(cr) };
}

export function convertRemoteMonster(
  remote: FiveEToolsMonster,
  createId: () => string,
): Monster {
  const summary = getRemoteSummary(remote);
  const speed =
    Object.entries(remote.speed ?? {})
      .filter(([, value]) => value !== false)
      .map(([mode, value]) => {
        const amount =
          typeof value === "number"
            ? value
            : typeof value === "object"
              ? value.number
              : undefined;
        return `${mode === "walk" ? "" : `${mode} `}${amount ?? value} ft.`;
      })
      .join(", ") || "30 ft.";
  const stats = `STR ${remote.str ?? 10}  DEX ${remote.dex ?? 10}  CON ${remote.con ?? 10}  INT ${remote.int ?? 10}  WIS ${remote.wis ?? 10}  CHA ${remote.cha ?? 10}`;
  const sections = [
    ["Traits", remote.trait],
    ["Actions", remote.action],
    ["Bonus Actions", remote.bonus],
    ["Reactions", remote.reaction],
    ["Legendary Actions", remote.legendary],
    ["Mythic Actions", remote.mythic],
  ]
    .map(([title, entries]) => {
      const body = formatRemoteEntries(entries as unknown[] | undefined);
      return body ? `${title}\n${body}` : "";
    })
    .filter(Boolean);
  const spellcasting = formatRemoteEntries(remote.spellcasting);
  const slots = Array.from({ length: 5 }, (_, index) => {
    const level = String(index + 1);
    for (const block of remote.spellcasting ?? []) {
      if (!block || typeof block !== "object") continue;
      const spells = (block as Record<string, unknown>).spells;
      if (!spells || typeof spells !== "object") continue;
      const levelData = (spells as Record<string, unknown>)[level];
      if (levelData && typeof levelData === "object") {
        const count = (levelData as Record<string, unknown>).slots;
        if (typeof count === "number") return count;
      }
    }
    return 0;
  });
  return {
    id: createId(),
    name: remote.name,
    source: remote.source,
    type: summary.type,
    cr: summary.cr,
    ac: summary.ac,
    hp: summary.hp,
    speed,
    stats,
    abilities: sections.join("\n\n") || "No special actions or traits.",
    spells: spellcasting || "No spells",
    notes: "",
    slots,
  };
}

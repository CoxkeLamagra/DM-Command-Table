export type ConvertedMonster = {
  id: string;
  name: string;
  source?: string;
  type: string;
  cr: string;
  ac: number;
  hp: number;
  speed: string;
  stats: string;
  abilities: string;
  spells: string;
  notes: string;
  slots: number[];
};

export type FiveEToolsMonster = {
  name: string;
  source: string;
  hasToken?: boolean;
  token?: { name: string; source: string };
  tokenUrl?: string;
  tokenHref?: { type?: string; url?: string; path?: string };
  alignment?: unknown[];
  save?: Record<string, unknown>;
  skill?: Record<string, unknown>;
  vulnerable?: unknown[];
  resist?: unknown[];
  immune?: unknown[];
  conditionImmune?: unknown[];
  senses?: unknown[];
  languages?: unknown[];
  passive?: number | string;
  pbNote?: string;
  size?: string[];
  type?: string | { type?: string; tags?: unknown[] };
  ac?: Array<number | { ac?: number; from?: unknown[]; condition?: string }>;
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
  monster: Pick<ConvertedMonster, "name" | "source">,
): string {
  return `${monster.name.trim().toLowerCase()}::${(monster.source ?? "").trim().toLowerCase()}`;
}

export function cleanCatalogueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return value
      .replace(/\{@h}/g, "Hit: ")
      .replace(/\{@dc ([^}|]+)(?:\|[^}]*)?}/g, "DC $1")
      .replace(/\{@hit ([^}|]+)(?:\|[^}]*)?}/g, (_, value: string) =>
        /^\d+$/.test(value) ? `+${value}` : value,
      )
      .replace(
        /\{@recharge(?: ([1-6]))?}/g,
        (_, value: string | undefined) =>
          `(Recharge ${value === "6" ? "6" : `${value ?? "5"}–6`})`,
      )
      .replace(/\{@atk mw,rw}/g, "Melee or Ranged Weapon Attack:")
      .replace(/\{@atk mw}/g, "Melee Weapon Attack:")
      .replace(/\{@atk rw}/g, "Ranged Weapon Attack:")
      .replace(
        /\{@\w+\s+([^}]+)}/g,
        (_, content: string) => content.split("|")[0],
      );
  }
  if (Array.isArray(value))
    return value.map(cleanCatalogueText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const body = cleanCatalogueText(
      record.entries ?? record.entry ?? record.items ?? "",
    );
    return record.name ? `${cleanCatalogueText(record.name)} — ${body}` : body;
  }
  return String(value);
}

export function formatCatalogueEntries(value: unknown[] | undefined): string {
  return value?.map(cleanCatalogueText).filter(Boolean).join("\n\n") ?? "";
}

export function formatCatalogueValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value))
    return value.map(formatCatalogueValue).filter(Boolean).join("; ");
  if (typeof value === "object")
    return Object.entries(value)
      .filter(([key]) => !["cond", "hidden"].includes(key))
      .map(([key, item]) =>
        [
          "resist",
          "immune",
          "vulnerable",
          "conditionImmune",
          "choose",
          "note",
          "preNote",
        ].includes(key)
          ? formatCatalogueValue(item)
          : `${key}: ${formatCatalogueValue(item)}`,
      )
      .filter(Boolean)
      .join("; ");
  return cleanCatalogueText(value);
}

export function formatCatalogueSpellcasting(
  blocks: unknown[] | undefined,
): string {
  return (blocks ?? [])
    .map((block) => {
      if (!block || typeof block !== "object") return cleanCatalogueText(block);
      const record = block as Record<string, unknown>;
      const lines = [
        cleanCatalogueText(record.name),
        cleanCatalogueText(record.headerEntries ?? record.entries),
      ];
      for (const field of ["will", "constant"])
        if (record[field])
          lines.push(
            `${field === "will" ? "At will" : "Constant"}: ${formatCatalogueValue(record[field])}`,
          );
      for (const field of ["daily", "rest", "weekly", "monthly"]) {
        const uses = record[field];
        if (uses && typeof uses === "object")
          for (const [count, spells] of Object.entries(uses))
            lines.push(
              `${count.replace("e", " each")}/${({ daily: "day", rest: "rest", weekly: "week", monthly: "month" } as Record<string, string>)[field]}: ${formatCatalogueValue(spells)}`,
            );
      }
      if (record.spells && typeof record.spells === "object")
        for (const [level, value] of Object.entries(record.spells)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          lines.push(
            `${level === "0" ? "Cantrips" : `Level ${level}`}${typeof entry.slots === "number" ? ` (${entry.slots} slots)` : ""}: ${formatCatalogueValue(entry.spells)}`,
          );
        }
      lines.push(cleanCatalogueText(record.footerEntries));
      return lines.filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function getMonsterSummary(remote: FiveEToolsMonster) {
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
  const tags =
    typeof remote.type === "object"
      ? (remote.type.tags ?? [])
          .map((tag) =>
            typeof tag === "string"
              ? tag
              : tag && typeof tag === "object"
                ? `${(tag as Record<string, unknown>).prefix ?? ""} ${(tag as Record<string, unknown>).tag ?? ""}`.trim()
                : "",
          )
          .filter(Boolean)
          .join(", ")
      : "";
  const type =
    `${(remote.size ?? []).map((size) => sizes[size] ?? size).join("/")} ${rawType}${tags ? ` (${tags})` : ""}`.trim();
  const acEntry = remote.ac?.[0];
  const ac = typeof acEntry === "number" ? acEntry : (acEntry?.ac ?? 10);
  const hp = remote.hp?.average ?? 10;
  const cr =
    typeof remote.cr === "object" ? (remote.cr.cr ?? "—") : (remote.cr ?? "—");
  return { type, ac, hp, cr: String(cr) };
}

export function convertCatalogueMonster(
  remote: FiveEToolsMonster,
  createId: () => string,
): ConvertedMonster {
  const summary = getMonsterSummary(remote);
  const speed =
    Object.entries(remote.speed ?? {})
      .filter(([, value]) => typeof value !== "boolean")
      .map(([mode, value]) => {
        const amount =
          typeof value === "number"
            ? value
            : typeof value === "object"
              ? value.number
              : undefined;
        return `${mode === "walk" ? "" : `${mode} `}${amount ?? value} ft.${mode === "fly" && remote.speed?.canHover === true ? " (hover)" : ""}`;
      })
      .join(", ") || "30 ft.";
  const stats = `STR ${remote.str ?? 10}  DEX ${remote.dex ?? 10}  CON ${remote.con ?? 10}  INT ${remote.int ?? 10}  WIS ${remote.wis ?? 10}  CHA ${remote.cha ?? 10}`;
  const alignment = (remote.alignment ?? [])
    .map((entry) =>
      typeof entry === "string"
        ? ((
            {
              L: "lawful",
              N: "neutral",
              C: "chaotic",
              G: "good",
              E: "evil",
              U: "unaligned",
              A: "any alignment",
            } as Record<string, string>
          )[entry] ?? entry)
        : formatCatalogueValue(entry),
    )
    .join(" ");
  const details = [
    ["Alignment", alignment],
    [
      "Armor details",
      remote.ac
        ?.filter((entry) => typeof entry === "object")
        .map((entry) =>
          typeof entry === "object"
            ? [formatCatalogueValue(entry.from), entry.condition]
                .filter(Boolean)
                .join("; ")
            : "",
        )
        .filter(Boolean)
        .join("; "),
    ],
    ["Hit point formula", remote.hp?.formula],
    ["Saving throws", formatCatalogueValue(remote.save)],
    ["Skills", formatCatalogueValue(remote.skill)],
    ["Damage vulnerabilities", formatCatalogueValue(remote.vulnerable)],
    ["Damage resistances", formatCatalogueValue(remote.resist)],
    ["Damage immunities", formatCatalogueValue(remote.immune)],
    ["Condition immunities", formatCatalogueValue(remote.conditionImmune)],
    ["Senses", formatCatalogueValue(remote.senses)],
    ["Passive Perception", remote.passive],
    ["Languages", formatCatalogueValue(remote.languages)],
    ["Proficiency bonus", remote.pbNote],
  ]
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const sections = [
    ["Creature details", details ? [details] : undefined],
    ["Traits", remote.trait],
    ["Actions", remote.action],
    ["Bonus Actions", remote.bonus],
    ["Reactions", remote.reaction],
    ["Legendary Actions", remote.legendary],
    ["Mythic Actions", remote.mythic],
  ]
    .map(([title, entries]) => {
      const body = formatCatalogueEntries(entries as unknown[] | undefined);
      return body ? `${title}\n${body}` : "";
    })
    .filter(Boolean);
  const spellcasting = formatCatalogueSpellcasting(remote.spellcasting);
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

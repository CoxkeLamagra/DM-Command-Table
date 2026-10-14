import { abilityScores, abilitySections } from "@/domain/monster-stat-block";
import type { CombatSnapshot } from "@/domain/encounters";
import { RichTextContent } from "@/features/rich-text/rich-text";

export type StatBlockData = Pick<
  CombatSnapshot,
  | "name"
  | "type"
  | "challengeRating"
  | "armorClass"
  | "hitPoints"
  | "speed"
  | "stats"
  | "abilities"
  | "spells"
  | "notes"
  | "source"
  | "spellSlots"
> & { tags?: CombatSnapshot["tags"] };
export function MonsterStatBlock({
  monster,
  caption,
}: {
  monster: StatBlockData;
  caption?: string;
}) {
  const scores = abilityScores(monster.stats);
  return (
    <section
      aria-label={`${monster.name} stat block`}
      className="my-4 overflow-hidden rounded border-y-4 border-red-900 bg-[#f5eddb] p-4 text-[#2c211b] shadow-md sm:p-6"
    >
      <h3 className="break-words font-serif text-3xl font-bold text-red-950">
        {monster.name}
      </h3>
      <p className="mb-3 text-sm italic">{monster.type || "Creature"}</p>
      {caption && <p className="mb-3 text-xs">{caption}</p>}
      {!!monster.tags?.length && (
        <div className="mb-3 flex flex-wrap gap-2">
          {monster.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded border border-red-900/30 px-2 py-0.5 text-xs"
              style={tag.color ? { color: tag.color } : undefined}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <dl className="space-y-1 border-y border-red-900/50 py-3 text-sm">
        <div>
          <dt className="inline font-bold text-red-950">Armor Class </dt>
          <dd className="inline">{monster.armorClass}</dd>
        </div>
        <div>
          <dt className="inline font-bold text-red-950">Hit Points </dt>
          <dd className="inline">{monster.hitPoints}</dd>
        </div>
        <div>
          <dt className="inline font-bold text-red-950">Speed </dt>
          <dd className="inline">{monster.speed || "—"}</dd>
        </div>
      </dl>
      {scores.every(({ value }) => value !== undefined) ? (
        <dl className="grid grid-cols-3 gap-y-3 border-b border-red-900/50 py-3 text-center text-sm sm:grid-cols-6">
          {scores.map(({ name, value }) => {
            const modifier = Math.floor((value! - 10) / 2);
            return (
              <div key={name}>
                <dt className="font-bold text-red-950">{name}</dt>
                <dd>
                  {value} ({modifier >= 0 ? "+" : ""}
                  {modifier})
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        monster.stats && (
          <div className="border-b border-red-900/50 py-3">
            <RichTextContent
              value={monster.stats}
              className="text-[#2c211b]! whitespace-pre-line"
            />
          </div>
        )
      )}
      {monster.stats && scores.every(({ value }) => value !== undefined) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">Ability score details</summary>
          <RichTextContent
            value={monster.stats}
            className="text-[#2c211b]! whitespace-pre-line"
          />
        </details>
      )}
      <p className="my-3 text-sm">
        <strong className="text-red-950">Challenge </strong>
        {monster.challengeRating || "—"}
        {monster.source ? ` · ${monster.source}` : ""}
      </p>
      {abilitySections(monster.abilities).map((section, index) => (
        <BlockSection key={index} title={section.title} value={section.value} />
      ))}
      <BlockSection title="Spellcasting" value={monster.spells} />
      {!!monster.spellSlots.some((value) => value > 0) && (
        <p className="my-2 text-sm">
          {monster.spellSlots
            .map((count, index) =>
              count > 0 ? `Level ${index + 1}: ${count} slots` : "",
            )
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <BlockSection title="Notes" value={monster.notes} />
    </section>
  );
}
function BlockSection({ title, value }: { title: string; value: string }) {
  if (
    !value ||
    value === "No spells" ||
    value === "No special actions or traits."
  )
    return null;
  return (
    <div className="mt-4 ">
      <h4 className="mb-2 border-b border-red-900/40 font-serif text-xl font-bold text-red-950">
        {title}
      </h4>
      <RichTextContent
        value={value}
        className="text-[#2c211b]! whitespace-pre-line"
      />
    </div>
  );
}

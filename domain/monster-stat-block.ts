export function abilityScores(stats: string) {
  const text = stats.replace(/<[^>]*>/g, " ");
  const values = new Map(
    [...text.matchAll(/\b(STR|DEX|CON|INT|WIS|CHA)\s*[:=]?\s*(-?\d+)\b/gi)].map(
      (match) => [match[1].toUpperCase(), Number(match[2])],
    ),
  );
  return ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((name) => ({
    name,
    value: values.get(name),
  }));
}

export function abilitySections(value: string) {
  if (/<\/?[a-z][a-z0-9]*(?:\s|\/|>)/i.test(value))
    return [{ title: "Traits and Actions", value }];
  const parts = value.split(
    /^(Creature details|Traits|Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions)\n/gm,
  );
  if (parts.length === 1) return [{ title: "Traits and Actions", value }];
  const sections = parts[0].trim()
    ? [{ title: "Traits and Actions", value: parts[0].trim() }]
    : [];
  for (let index = 1; index < parts.length; index += 2)
    sections.push({ title: parts[index], value: parts[index + 1].trim() });
  return sections;
}

export function highlightParts(
  value: string,
  query: string,
): { text: string; match: boolean }[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/["*:^(){}\[\]]/g, ""))
    .filter(Boolean);
  if (!terms.length) return [{ text: value, match: false }];
  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "giu");
  return value
    .split(pattern)
    .filter(Boolean)
    .map((text) => ({
      text,
      match: terms.some(
        (term) => text.toLocaleLowerCase() === term.toLocaleLowerCase(),
      ),
    }));
}

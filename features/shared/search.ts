export function matchesSearch(
  query: string,
  values: Array<string | number | null | undefined>,
): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = values
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
}

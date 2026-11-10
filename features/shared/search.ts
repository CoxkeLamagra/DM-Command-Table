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

/** Search immutable records without re-extracting unchanged rich text.
 * Weak keys allow replaced records and unmounted screens to be collected.
 */
export function createRecordSearch<T extends object>(
  textFor: (record: T) => string,
) {
  const text = new WeakMap<T, string>();
  return (
    records: readonly T[],
    query: string,
    include: (record: T) => boolean = () => true,
  ): T[] => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return records.filter((record) => {
      if (!include(record)) return false;
      if (!terms.length) return true;
      let haystack = text.get(record);
      if (haystack === undefined) {
        haystack = textFor(record).toLowerCase();
        text.set(record, haystack);
      }
      return terms.every((term) => haystack.includes(term));
    });
  };
}

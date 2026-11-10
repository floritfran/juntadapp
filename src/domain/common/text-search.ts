export function normalizeForSearch(text: string): string {
  const decomposed = text.normalize('NFD');
  let result = '';
  for (const char of decomposed) {
    const code = char.codePointAt(0) ?? 0;
    const isCombiningMark = code >= 0x0300 && code <= 0x036f;
    if (!isCombiningMark) result += char;
  }
  return result.toLowerCase();
}

export function matchesQuery(text: string, query: string): boolean {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (normalizedQuery === '') return true;
  return normalizeForSearch(text).includes(normalizedQuery);
}

export function compareByName(a: string, b: string): number {
  const normalizedA = normalizeForSearch(a);
  const normalizedB = normalizeForSearch(b);
  if (normalizedA !== normalizedB) return normalizedA < normalizedB ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

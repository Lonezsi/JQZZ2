/** Whether any of the texts contains the query, ignoring case; an empty query matches everything. */
export function hits(query: string, ...texts: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return texts.some((t) => !!t && t.toLowerCase().includes(q));
}

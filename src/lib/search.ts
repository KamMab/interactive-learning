export type SearchItem = {
  kind: "course" | "professor" | "person" | "chapter" | "term";
  label: string;
  sub: string;
  href: string;
  badge?: string;
  text: string; // everything searchable for this item
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ");

/** Every word of the query must appear somewhere. Titles that start with the query rank first. */
export function searchItems(items: SearchItem[], query: string, limit = 9): SearchItem[] {
  const q = norm(query).trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  const kindRank = { course: 0, professor: 1, chapter: 2, person: 3, term: 4 } as const;
  return items
    .map((it) => {
      const label = norm(it.label), hay = label + " " + norm(it.text);
      if (!words.every((w) => hay.includes(w))) return null;
      const score = (label.startsWith(q) ? 0 : label.includes(q) ? 1 : words.every((w) => label.includes(w)) ? 2 : 3) * 3 + kindRank[it.kind];
      return { it, score };
    })
    .filter((x): x is { it: SearchItem; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.it);
}

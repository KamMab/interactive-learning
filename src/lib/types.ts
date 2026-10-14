export type Term = { id: string; term: string; definition: string };

export type Question = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number; // index into choices
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
};

export type EntryLine = { account: string; debit: number; credit: number };

export type JournalEntry = {
  id: string;
  scenario: string;
  lines: EntryLine[];
  explanation: string;
};

export type MapRegion = "us-states" | "world";
export type MapItem = { id: string; place: string; prompt: string };
/** Map mode: click the right state/country. place must be a name from lib/map-names.ts. */
export type MapSet = { region: MapRegion; ask: string; items: MapItem[] };

export type ChapterContent = {
  summary?: string;
  /** What the two sides of a card are called, e.g. {front: "State", back: "Capital"}. Default Term/Definition. */
  labels?: { front: string; back: string };
  terms: Term[];
  questions: Question[];
  entries: JournalEntry[];
  map?: MapSet | null;
};

export const MODES = ["learn", "flashcards", "quiz", "map", "entries", "match", "rush"] as const;
export type Mode = (typeof MODES)[number];

type ContentKey = "terms" | "questions" | "entries" | "map";
export const MODE_INFO: Record<Mode, { name: string; blurb: string; needs: ContentKey[]; game?: boolean }> = {
  learn: { name: "Learn", blurb: "Short rounds that repeat what you miss until you've mastered it.", needs: ["terms", "questions"] },
  flashcards: { name: "Flashcards", blurb: "Flip through key terms and sort what you know.", needs: ["terms"] },
  quiz: { name: "Quick-fire", blurb: "Multiple choice with explanations and a speed bonus.", needs: ["questions"] },
  map: { name: "Map", blurb: "Find each place on the map.", needs: ["map"] },
  entries: { name: "Journal Entries", blurb: "Build the full entry for each scenario.", needs: ["entries"] },
  match: { name: "Match", blurb: "Pair terms with definitions against the clock.", needs: ["terms"], game: true },
  rush: { name: "Ledger Rush", blurb: "Answer as many as you can before time runs out.", needs: ["questions"], game: true },
};

/** How many items a mode has to work with in this chapter (0 = the mode is hidden). */
export const modeCount = (mode: Mode, c: ChapterContent) =>
  MODE_INFO[mode].needs.reduce((n, k) => n + (k === "map" ? c.map?.items.length ?? 0 : c[k].length), 0);

/** Card side names for this content ("Term"/"Definition" unless Claude chose better ones). */
export const sideLabels = (c: ChapterContent) => c.labels ?? { front: "Term", back: "Definition" };

export type ChapterSettings = {
  modes: Mode[];            // enabled modes, in display order
  questionCount: number;    // questions per quiz session (0 = all)
  rushSeconds: number;      // time limit for Rush
  matchPairs: number;       // pairs per Match round
  shuffle: boolean;
  showExplanations: boolean;
  requireFlashcardsFirst: boolean; // lock other modes until flashcards are finished once
  v?: number;               // settings format version
};

export const DEFAULT_SETTINGS: ChapterSettings = {
  modes: ["learn", "flashcards", "quiz", "map", "entries", "match", "rush"],
  questionCount: 10,
  rushSeconds: 60,
  matchPairs: 6,
  shuffle: true,
  showExplanations: true,
  requireFlashcardsFirst: false,
  v: 2,
};

export type Course = {
  id: string;
  slug: string;
  code: string;
  title: string;
  description: string;
  instructions: string;
  sort: number;
  published: boolean;
  owner_id?: string | null;    // set = a student's private course built from their uploads
  owner_email?: string | null;
  kind?: "class" | "fun";
  visibility?: "public" | "private";
  created_at?: string;
};

export type Profile = { user_id: string; handle: string; display_name: string };

/** A chapter shown on Home/Library cards, with where it lives and who made it. */
export type SetCard = {
  chapterId: string; href: string; title: string; course: string; kind: "class" | "fun" | "official";
  terms: number; questions: number; author?: Profile | null; plays?: number; visibility?: "public" | "private"; hasMap?: boolean;
};

export type Professor = {
  id: string;
  course_id: string;
  slug: string;
  name: string;
  instructions: string;
  sort: number;
  published: boolean;
};

/** URL segment for chapters that every professor shares (or for courses with no professors listed). */
export const ALL_PROFS = "all";

export type Chapter = {
  id: string;
  course_id: string;
  professor_id: string | null;
  number: number;
  title: string;
  instructions: string;
  content: ChapterContent;
  settings: ChapterSettings;
  published: boolean;
};

export type Note = {
  id: string;
  chapter_id: string;
  name: string;
  path: string;
  mime: string | null;
  size: number | null;
  created_at: string;
};

export function normalizeSettings(s: Partial<ChapterSettings> | null | undefined): ChapterSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  merged.modes = (merged.modes ?? []).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  // Chapters saved before Learn existed get it added as the opening mode.
  if (s && !s.v && !merged.modes.includes("learn")) merged.modes = ["learn", ...merged.modes];
  merged.v = 2;
  return merged;
}

export function normalizeContent(c: Partial<ChapterContent> | null | undefined): ChapterContent {
  return {
    summary: c?.summary ?? "",
    terms: c?.terms ?? [],
    questions: c?.questions ?? [],
    entries: c?.entries ?? [],
    labels: c?.labels?.front && c?.labels?.back ? c.labels : undefined,
    map: c?.map?.items?.length ? c.map : null,
  };
}

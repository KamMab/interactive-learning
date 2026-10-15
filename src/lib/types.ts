/** Every item can belong to one section of a long chapter (Section.id). */
/** image: a picture shown instead of the front text (an https URL, or "wiki:<Wikipedia page>" for its main photo). */
export type Term = { id: string; term: string; definition: string; section?: string; image?: string };

export type Question = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number; // index into choices
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  section?: string;
  image?: string;     // a picture shown above the question
};

export type EntryLine = { account: string; debit: number; credit: number };

export type JournalEntry = {
  id: string;
  scenario: string;
  lines: EntryLine[];
  explanation: string;
  section?: string;
};

export type MapRegion = "us-states" | "world";
export type MapItem = { id: string; place: string; prompt: string; section?: string };
/** Map mode: click the right state/country. place must be a name from lib/map-names.ts. */
export type MapSet = { region: MapRegion; ask: string; items: MapItem[] };

/** A topic within a chapter. blurb: a few words on what it covers. */
export type Section = { id: string; title: string; blurb?: string };

export type ChapterContent = {
  summary?: string;
  /** Long chapters are split into sections the student can study one at a time. */
  sections?: Section[];
  /** What the two sides of a card are called, e.g. {front: "State", back: "Capital"}. Default Term/Definition. */
  labels?: { front: string; back: string };
  terms: Term[];
  questions: Question[];
  entries: JournalEntry[];
  map?: MapSet | null;
  /** Reference material students can open while studying, e.g. "interest-tables" (PV/FV factor tables). */
  tools?: Tool[];
};

export const TOOLS = ["interest-tables"] as const;
export type Tool = (typeof TOOLS)[number];
export const cleanTools = (x: unknown): Tool[] | undefined => {
  const t = (Array.isArray(x) ? x : []).filter((v): v is Tool => (TOOLS as readonly string[]).includes(v as string));
  return t.length ? [...new Set(t)] : undefined;
};

export const MODES = ["learn", "flashcards", "quiz", "map", "entries", "match", "rush"] as const;
export type Mode = (typeof MODES)[number];

/** Every set gets these three when it has the content for them. */
export const CORE_MODES: Mode[] = ["learn", "flashcards", "quiz"];
/** Extra ways to study, added when they fit the material (or the student asks for them). */
export const EXTRA_MODES: Mode[] = ["map", "entries", "match", "rush"];

type ContentKey = "terms" | "questions" | "entries" | "map";
export const MODE_INFO: Record<Mode, { name: string; blurb: string; needs: ContentKey[]; game?: boolean }> = {
  learn: { name: "Learn", blurb: "Short rounds that repeat what you miss until you've mastered it.", needs: ["terms", "questions"] },
  flashcards: { name: "Flashcards", blurb: "Flip through key terms and sort what you know.", needs: ["terms"] },
  quiz: { name: "Quick-fire", blurb: "Multiple choice with explanations and a speed bonus.", needs: ["questions"] },
  map: { name: "Map", blurb: "Find each place on the map.", needs: ["map"] },
  entries: { name: "Journal Entries", blurb: "Build the full entry for each scenario.", needs: ["entries"] },
  match: { name: "Match", blurb: "Pair terms with definitions against the clock.", needs: ["terms"], game: true },
  rush: { name: "Rush", blurb: "Answer as many as you can before time runs out.", needs: ["questions"], game: true },
};

/** Display name for a mode in this set (Rush is "Ledger Rush" for accounting material). */
export const modeName = (mode: Mode, c: ChapterContent) => (mode === "rush" && c.entries.length > 0 ? "Ledger Rush" : MODE_INFO[mode].name);

/** The part of a chapter in the chosen topics (the whole chapter when none are given or all are chosen). */
export function contentFor(c: ChapterContent, picked: string | string[] | null): ChapterContent {
  const ids = (picked == null ? [] : Array.isArray(picked) ? picked : [picked]).filter((id) => c.sections?.some((s) => s.id === id));
  const used = usableSections(c);
  if (!ids.length || used.every((s) => ids.includes(s.id))) return c;
  const keep = <T extends { section?: string }>(xs: T[]) => xs.filter((x) => !!x.section && ids.includes(x.section));
  return { ...c, terms: keep(c.terms), questions: keep(c.questions), entries: keep(c.entries),
    map: c.map ? { ...c.map, items: keep(c.map.items) } : c.map };
}

/** Sections that actually have something in them. */
export const usableSections = (c: ChapterContent) =>
  (c.sections ?? []).filter((s) => [...c.terms, ...c.questions, ...c.entries, ...(c.map?.items ?? [])].some((x) => x.section === s.id));

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
  professor?: string | null;   // who teaches the student's version, e.g. "Prof. Lu" (just a label)
};

/** A course on Home/Library: "MGMT 120B by kammab". */
export type CourseCard = {
  id: string; slug: string; code: string; title: string; professor?: string | null;
  chapters: number; author: Profile | null; official: boolean;
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
    sections: Array.isArray(c?.sections) && c.sections.length > 1 ? c.sections : undefined,
    terms: c?.terms ?? [],
    questions: c?.questions ?? [],
    entries: c?.entries ?? [],
    labels: c?.labels?.front && c?.labels?.back ? c.labels : undefined,
    map: c?.map?.items?.length ? c.map : null,
    tools: cleanTools(c?.tools),
  };
}

/**
 * What a chapter is called on screen. A title like "Ch. 13 Current Liabilities" shows as number 13 with the
 * title "Current Liabilities", even if it was saved under another number.
 */
export function chapterLabel(ch: { number: number; title: string }) {
  const m = ch.title.match(/^\s*(?:ch(?:apter)?|unit|week|lecture|module)\.?\s*(\d{1,3})\s*[:.\-–—]?\s*(.*)$/i);
  if (!m) return { num: ch.number, title: ch.title };
  return { num: Number(m[1]), title: m[2].trim() || ch.title };
}

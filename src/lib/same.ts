// "Don't Say the Same Thing as Me": the rules, shared by solo games (in the browser) and live rooms (on the server).
// Each round has a prompt ("Name a country in Europe"). The site secretly picks an answer too. You're out if your
// answer doesn't fit, was already said earlier in the game (by anyone), or matches the site's (or another player's).

export type SameAnswer = { name: string; aka?: string[]; w?: number }; // w: how obvious it is (1-5); the site favors obvious answers
export type SamePrompt = { text: string; level: number; answers: string[]; first?: boolean };
export type SameSet = { noun: string; answers: SameAnswer[]; prompts: SamePrompt[] };

export type Verdict = "ok" | "invalid" | "used" | "site" | "twin" | "none";
export const VERDICT_TEXT: Record<Verdict, string> = {
  ok: "Safe",
  invalid: "Doesn't fit",
  used: "Already said for this question",
  site: "Same as the site",
  twin: "Same as another player",
  none: "No answer",
};

/** Shape check for content coming from the database or an uploaded file. */
export function cleanSame(x: any): SameSet | undefined {
  if (!x || !Array.isArray(x.answers) || !Array.isArray(x.prompts)) return undefined;
  const answers: SameAnswer[] = x.answers.filter((a: any) => a?.name).slice(0, 2000).map((a: any) => ({
    name: String(a.name).slice(0, 80),
    ...(Array.isArray(a.aka) && a.aka.length ? { aka: a.aka.slice(0, 12).map((s: unknown) => String(s).slice(0, 80)) } : {}),
    ...(Number(a.w) > 0 ? { w: Math.min(9, Number(a.w)) } : {}),
  }));
  const names = new Set(answers.map((a) => a.name));
  const prompts: SamePrompt[] = x.prompts.slice(0, 1000).map((p: any) => ({
    text: String(p?.text ?? "").slice(0, 200),
    level: Math.max(1, Math.min(5, Math.round(Number(p?.level) || 1))),
    answers: (Array.isArray(p?.answers) ? p.answers : []).map(String).filter((n: string) => names.has(n)),
    ...(p?.first ? { first: true } : {}),
  })).filter((p: SamePrompt) => p.text && p.answers.length >= 2);
  if (answers.length < 3 || !prompts.length) return undefined;
  return { noun: String(x.noun || "answer").slice(0, 30), answers, prompts };
}

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/\bst\.?\s/g, "saint ")
    .replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();

function dist(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Turns what someone typed into one of the set's answers (aliases and small typos allowed). */
export function makeResolver(set: SameSet) {
  const idx = new Map<string, string>();
  for (const a of set.answers) for (const s of [a.name, ...(a.aka ?? [])]) if (!idx.has(norm(s))) idx.set(norm(s), a.name);
  const keys = [...idx.keys()];
  return (typed: string): string | null => {
    const k = norm(typed);
    if (!k) return null;
    const hit = idx.get(k);
    if (hit) return hit;
    const tol = k.length >= 9 ? 2 : k.length >= 5 ? 1 : 0;
    if (!tol) return null;
    const close = [...new Set(keys.filter((x) => dist(k, x) <= tol).map((x) => idx.get(x)!))];
    return close.length === 1 ? close[0] : null;
  };
}

/** Small seeded random numbers, so a live room (or an async challenge) plays the same everywhere. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedFor = (seed: number, round: number, salt: number) => (seed * 2654435761 + round * 40503 + salt * 97) >>> 0;

/** Rounds start vague and get narrower: level 1 for rounds 1-3, then 2, 3, 4, and 5 from round 26 on. */
export const levelFor = (round: number) => (round <= 3 ? 1 : round <= 8 ? 2 : round <= 15 ? 3 : round <= 25 ? 4 : 5);

const left = (p: SamePrompt, used: Set<string>) => p.answers.filter((a) => !used.has(a)).length;

/**
 * The next prompt: the round's level, not asked yet, and still with enough unused answers for everyone.
 * Answers only can't repeat within the same question (usedOf(i) = what's been said for prompt i in this game).
 * (players + the site, plus one spare so there's a real choice). Falls back to nearby levels, then to repeats.
 * Returns -1 when nothing is answerable any more (everyone still in has beaten the whole set).
 */
export function choosePrompt(set: SameSet, round: number, usedOf: (i: number) => Set<string>, asked: Set<number>, players: number, rand: () => number) {
  if (round === 1) { const f = set.prompts.findIndex((p) => p.first); if (f >= 0 && left(set.prompts[f], usedOf(f)) >= players + 1) return f; }
  const want = levelFor(round);
  const tiers: ((i: number) => boolean)[] = [
    (i) => set.prompts[i].level === want && !asked.has(i) && left(set.prompts[i], usedOf(i)) >= players + 2,
    (i) => Math.abs(set.prompts[i].level - want) <= 1 && !asked.has(i) && left(set.prompts[i], usedOf(i)) >= players + 2,
    (i) => !asked.has(i) && left(set.prompts[i], usedOf(i)) >= players + 1,
    (i) => left(set.prompts[i], usedOf(i)) >= players + 2 && set.prompts[i].level >= Math.min(want, 3),
    (i) => left(set.prompts[i], usedOf(i)) >= players + 1,
  ];
  for (const ok of tiers) {
    const pool = set.prompts.map((_, i) => i).filter(ok);
    if (pool.length) return pool[Math.floor(rand() * pool.length)];
  }
  return -1;
}

/** The site's secret answer: any fitting answer not yet said for this question, strongly favoring the obvious ones. */
export function sitePick(set: SameSet, p: SamePrompt, used: Set<string>, rand: () => number) {
  const w = new Map(set.answers.map((a) => [a.name, a.w ?? 1]));
  const pool = p.answers.filter((a) => !used.has(a));
  const weights = pool.map((a) => Math.pow(w.get(a) ?? 1, 2));
  let r = rand() * weights.reduce((s, x) => s + x, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/** Judges everyone's answers for one round. answers: player id -> resolved answer (or null for none). */
export function judgeRound(p: SamePrompt, site: string, used: Set<string>, answers: Record<string, string | null>): Record<string, Verdict> {
  const count = new Map<string, number>();
  for (const a of Object.values(answers)) if (a) count.set(a, (count.get(a) ?? 0) + 1);
  const out: Record<string, Verdict> = {};
  for (const [id, a] of Object.entries(answers)) {
    out[id] = !a ? "none" : !p.answers.includes(a) ? "invalid" : used.has(a) ? "used" : a === site ? "site" : (count.get(a) ?? 0) > 1 ? "twin" : "ok";
  }
  return out;
}

/** A few answers that would have worked (for the "you're out" screen). */
export function examples(p: SamePrompt, used: Set<string>, skip: string[], n = 4) {
  return p.answers.filter((a) => !used.has(a) && !skip.includes(a)).slice(0, n);
}

/** Join codes like "ioq-13b": no look-alike characters. */
export function makeCode() {
  const L = "abcdefghjkmnpqrstuvwxyz", D = "23456789", pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  return `${pick(L)}${pick(L)}${pick(L)}-${pick(D)}${pick(D)}${pick(L)}`;
}
export const cleanCode = (s: string) => {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return t.length === 6 ? `${t.slice(0, 3)}-${t.slice(3)}` : null;
};

/** What's been said so far, per question: { [prompt index]: answers }. */
export type SaidLog = Record<string, string[]>;
export const usedIn = (log: SaidLog, i: number) => new Set(log[String(i)] ?? []);
export const addSaid = (log: SaidLog, i: number, names: string[]): SaidLog => {
  const cur = log[String(i)] ?? [];
  return { ...log, [String(i)]: [...cur, ...names.filter((n, k) => !cur.includes(n) && names.indexOf(n) === k)] };
};

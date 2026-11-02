import "server-only";
import { admin } from "./db";
import { cleanMath, mathProblem, readNumber, type MathSpec } from "./math";
import { quizPoints, quizPool, type QuizQ } from "./quizpool";
import { normalizeContent } from "./types";
import { addSaid, choosePrompt, cleanSame, judgeRound, makeCode, makeResolver, rng, seedFor, sitePick, usedIn, type SaidLog, type SameSet, type Verdict } from "./same";

// Game rooms for the party games ("Don't Say the Same Thing as Me" and "Math Blitz"). A host gets a code like "ioq-13b".
// live: everyone answers the same prompt at the same time (Kahoot-style); the server keeps the secret answer.
// async: a challenge. Everyone plays the same seeded game against the site on their own time; best streaks are listed.
// Rooms advance lazily: every poll checks the clock and moves the game along, so no background job is needed.

export type Player = { id: string; name: string; alive: boolean; streak: number; outRound?: number; score?: number };
export type RevealRow = { id: string; name: string; typed: string; answer: string | null; verdict: Verdict; points?: number; secs?: number };
export type LiveState = {
  kind: "live"; game?: "same" | "math" | "quiz"; chapterId: string; title: string; seed: number; seconds: number; host: string; hostName: string;
  status: "lobby" | "answering" | "reveal" | "over";
  players: Player[]; round: number; prompt: number; promptText: string; level: number; site: string; deadline: number;
  answers: Record<string, { typed: string; answer: string | null; at?: number }>; used: SaidLog; asked: number[]; // used: what was said, per question
  last?: { round: number; prompt: string; site: string; rows: RevealRow[]; choices?: string[]; counts?: number[]; explanation?: string; image?: string };
  revealUntil?: number; ending?: boolean; winners?: string[];
  order?: number[]; count?: number; q?: { choices: string[]; image?: string }; // quiz: which questions, in what order, and the one on screen
};
export type AsyncState = {
  kind: "async"; game?: "same" | "math" | "quiz"; chapterId: string; title: string; seed: number; host: string; hostName: string;
  results: { id: string; name: string; streak: number; at: number }[];
};
type State = LiveState | AsyncState;

// (Tests can swap in a stand-in database through globalThis.__roomsDb.)
const db = () => ((globalThis as { __roomsDb?: ReturnType<typeof admin> }).__roomsDb ?? admin());
const MAX_PLAYERS = 100;
const REVEAL_MS = 7000;
type Game = { set?: SameSet; math?: MathSpec; pool?: QuizQ[] };
const sets = new Map<string, { at: number; title: string } & Game>();

async function loadSet(chapterId: string) {
  const hit = sets.get(chapterId);
  if (hit && Date.now() - hit.at < 300000) return hit;
  const { data } = await db().from("chapters").select("title,content,published").eq("id", chapterId).maybeSingle();
  if (!data?.published) throw new Error("This game isn't available.");
  const set = cleanSame((data.content as any)?.same);
  const math = !set ? cleanMath((data.content as any)?.math) : undefined;
  const pool = quizPool(normalizeContent(data.content as any));
  if (!set && !math && !pool.length) throw new Error("This game isn't available.");
  const v = { at: Date.now(), set, math, pool, title: data.title as string };
  sets.set(chapterId, v);
  return v;
}

async function read(code: string) {
  const { data, error } = await db().from("game_rooms").select("state,version,updated_at").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message.includes("game_rooms") ? "Game rooms aren't set up yet (run the new SQL in Supabase)." : error.message);
  if (!data) return null;
  return { state: data.state as State, version: data.version as number };
}

/** Saves only if nobody else saved in between; returns false so the caller can reload and retry. */
async function write(code: string, version: number, state: State) {
  const { data } = await db().from("game_rooms").update({ state, version: version + 1, updated_at: new Date().toISOString() })
    .eq("code", code).eq("version", version).select("code");
  return !!data?.length;
}

/** Load → change → save, retrying when two people act at the same moment. */
async function mutate(code: string, fn: (s: State, g: Game) => string | void) {
  for (let i = 0; i < 6; i++) {
    const cur = await read(code);
    if (!cur) return { error: "No game with that code. Check it and try again." };
    const g = await loadSet(cur.state.chapterId);
    const s = structuredClone(cur.state);
    const err = fn(s, g);
    if (err) return { error: err };
    if (await write(code, cur.version, s)) return { state: s };
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  return { error: "The game is busy. Try again." };
}

export async function createRoom(input: { chapterId: string; kind: "live" | "async"; host: string; hostName: string; hostPlays: boolean; seconds: number; quiz?: boolean; count?: number }) {
  const { title, set, math, pool } = await loadSet(input.chapterId);
  const game = input.quiz || (!set && !math) ? "quiz" as const : set ? "same" as const : "math" as const;
  if (game === "quiz" && !pool?.length) return { error: "This chapter has no questions for a live quiz yet." };
  if (game === "quiz") input.kind = "live";
  const hostName = input.hostName.trim().slice(0, 24) || "Host";
  const seed = Math.floor(Math.random() * 2 ** 31);
  const state: State = input.kind === "async"
    ? { kind: "async", game, chapterId: input.chapterId, title, seed, host: input.host, hostName, results: [] }
    : { kind: "live", game, chapterId: input.chapterId, title, seed, seconds: [10, 15, 20, 30, 45, 60].includes(input.seconds) ? input.seconds : 30,
        host: input.host, hostName, status: "lobby", players: input.hostPlays ? [{ id: input.host, name: hostName, alive: true, streak: 0 }] : [],
        round: 0, prompt: -1, promptText: "", level: 1, site: "", deadline: 0, answers: {}, used: {}, asked: [],
        ...(game === "quiz" ? { count: input.count && input.count > 0 ? Math.min(pool!.length, Math.floor(input.count)) : pool!.length } : {}) };
  for (let i = 0; i < 8; i++) {
    const code = makeCode();
    const { error } = await db().from("game_rooms").insert({ code, chapter_id: input.chapterId, kind: input.kind, state, version: 0 });
    if (!error) return { code };
    if (!/duplicate|unique/i.test(error.message)) return { error: error.message.includes("game_rooms") ? "Game rooms aren't set up yet (run the new SQL in Supabase)." : error.message };
  }
  return { error: "Couldn't make a code. Try again." };
}

function nextRound(s: LiveState, g: Game, now: number) {
  const alive = s.players.filter((p) => p.alive);
  const round = s.round + 1;
  if (s.game === "quiz") {
    const pool = g.pool ?? [];
    if (!s.order?.length) { // a fresh shuffle each game (and each restart)
      const r = rng(seedFor(s.seed, 0, 9)), idx = pool.map((_, k) => k);
      for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
      s.order = idx.slice(0, Math.min(s.count ?? 10, idx.length));
    }
    if (round > s.order.length) { s.status = "over"; return; }
    const q = pool[s.order[round - 1]];
    if (!q) { s.status = "over"; return; }
    Object.assign(s, { round, prompt: s.order[round - 1], promptText: q.prompt, level: 0, site: String(q.answer), q: { choices: q.choices, image: q.image },
      deadline: now + s.seconds * 1000, answers: {}, status: "answering", revealUntil: undefined });
    return;
  }
  if (s.game === "math") {
    const m = mathProblem(s.seed, round);
    Object.assign(s, { round, prompt: round, promptText: m.text, level: m.level, site: String(m.answer),
      deadline: now + s.seconds * 1000, answers: {}, status: "answering", revealUntil: undefined });
    return;
  }
  const set = g.set!;
  const log = s.used && !Array.isArray(s.used) ? s.used : {};
  const i = choosePrompt(set, round, (k) => usedIn(log, k), new Set(s.asked), Math.max(1, alive.length), rng(seedFor(s.seed, round, 1)));
  if (i < 0) { s.status = "over"; s.winners = alive.map((p) => p.id); return; }
  const p = set.prompts[i];
  Object.assign(s, { round, prompt: i, promptText: p.text, level: p.level, site: sitePick(set, p, usedIn(log, i), rng(seedFor(s.seed, round, 2))),
    deadline: now + s.seconds * 1000, answers: {}, status: "answering", asked: [...s.asked, i], revealUntil: undefined });
}

function resolve(s: LiveState, g: Game, now: number) {
  if (s.game === "quiz") {
    const q = (g.pool ?? [])[s.prompt];
    const total = s.seconds * 1000, start = s.deadline - total;
    const counts = (q?.choices ?? []).map(() => 0);
    const rows: RevealRow[] = s.players.map((x) => {
      const a = s.answers[x.id]?.answer ?? null;
      if (a != null && counts[Number(a)] != null) counts[Number(a)]++;
      const ok = a != null && a === s.site;
      const pts = quizPoints(ok, s.deadline - (s.answers[x.id]?.at ?? s.deadline), total);
      x.score = (x.score ?? 0) + pts;
      if (ok) x.streak++;
      const secs = s.answers[x.id]?.at ? Math.max(0, (s.answers[x.id]!.at! - start) / 1000) : undefined;
      return { id: x.id, name: x.name, typed: a != null && q ? q.choices[Number(a)] ?? "" : "", answer: a, verdict: a == null ? "none" : ok ? "ok" : "wrong", points: pts, secs };
    });
    s.last = { round: s.round, prompt: s.promptText, site: s.site, rows, choices: q?.choices, counts, explanation: q?.explanation, image: q?.image };
    if (s.round >= (s.order?.length ?? 0)) {
      s.ending = true;
      const best = Math.max(...s.players.map((p) => p.score ?? 0));
      s.winners = s.players.filter((p) => (p.score ?? 0) === best && best > 0).map((p) => p.id);
    }
    s.status = "reveal";
    s.revealUntil = now + 6000;
    return;
  }
  if (s.game === "math") {
    const alive = s.players.filter((x) => x.alive);
    const rows: RevealRow[] = alive.map((x) => {
      const a = s.answers[x.id]?.answer ?? null;
      const verdict: Verdict = a == null ? "none" : a === s.site ? "ok" : "wrong";
      if (verdict === "ok") x.streak++; else { x.alive = false; x.outRound = s.round; }
      return { id: x.id, name: x.name, typed: s.answers[x.id]?.typed ?? "", answer: a, verdict };
    });
    s.last = { round: s.round, prompt: s.promptText, site: s.site, rows };
    return endCheck(s, alive, now);
  }
  const set = g.set!;
  const log = s.used && !Array.isArray(s.used) ? s.used : {};
  const p = set.prompts[s.prompt], used = usedIn(log, s.prompt);
  const alive = s.players.filter((x) => x.alive);
  const picks: Record<string, string | null> = Object.fromEntries(alive.map((x) => [x.id, s.answers[x.id]?.answer ?? null]));
  const v = judgeRound(p, s.site, used, picks);
  for (const x of alive) {
    if (v[x.id] === "ok") x.streak++;
    else { x.alive = false; x.outRound = s.round; }
  }
  const newly = new Set([s.site, ...Object.values(picks).filter((a): a is string => !!a && p.answers.includes(a))]);
  s.used = addSaid(log, s.prompt, [...newly]);
  s.last = { round: s.round, prompt: p.text, site: s.site,
    rows: alive.map((x) => ({ id: x.id, name: x.name, typed: s.answers[x.id]?.typed ?? "", answer: picks[x.id], verdict: v[x.id] })) };
  endCheck(s, alive, now);
}

function endCheck(s: LiveState, alive: Player[], now: number) {
  const still = s.players.filter((x) => x.alive);
  const solo = s.players.length === 1;
  if (solo ? still.length === 0 : still.length <= 1) {
    s.ending = true;
    s.winners = still.length ? still.map((x) => x.id) : alive.map((x) => x.id); // everyone left went out together: they share the win
  }
  s.status = "reveal";
  s.revealUntil = now + (s.game === "math" ? 4000 : REVEAL_MS);
}

/** Moves a live game along by the clock. Returns true when something changed. */
function tick(s: State, g: Game, now: number, force = false) {
  if (s.kind !== "live") return false;
  if (s.status === "answering") {
    const alive = s.players.filter((p) => p.alive);
    if (now >= s.deadline || alive.every((p) => s.answers[p.id])) { resolve(s, g, now); return true; }
  } else if (s.status === "reveal" && (force || now >= (s.revealUntil ?? 0))) {
    if (s.ending) s.status = "over"; else nextRound(s, g, now);
    return true;
  }
  return false;
}

/** The question on screen right now (without the answer). */
function questionOf(s: LiveState) {
  return s.q ? { choices: s.q.choices, image: s.q.image } : null;
}

/** What one person may see: the site's answer and others' answers stay hidden until the reveal. */
function view(s: State, me: string, now: number) {
  if (s.kind === "async") {
    const results = [...s.results].sort((a, b) => b.streak - a.streak || a.at - b.at).slice(0, 100);
    return { kind: s.kind, game: s.game ?? "same", title: s.title, seed: s.seed, hostName: s.hostName, isHost: s.host === me, results, mine: s.results.find((r) => r.id === me) ?? null, now };
  }
  const meP = s.players.find((p) => p.id === me) ?? null;
  return {
    kind: s.kind, game: s.game ?? "same", title: s.title, status: s.status, seconds: s.seconds, hostName: s.hostName, isHost: s.host === me, now,
    round: s.round, promptText: s.promptText, level: s.level, deadline: s.deadline, revealUntil: s.revealUntil ?? 0, ending: !!s.ending,
    players: s.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive, streak: p.streak, score: p.score ?? 0, answered: !!s.answers[p.id], outRound: p.outRound })),
    count: s.order?.length ?? s.count ?? 0, question: s.game === "quiz" && s.status === "answering" ? questionOf(s) : null,
    me: meP, myAnswer: s.answers[me]?.typed ?? null, used: s.status === "answering" && s.used && !Array.isArray(s.used) ? s.used[String(s.prompt)] ?? [] : [],
    last: s.status === "reveal" || s.status === "over" ? s.last ?? null : null, winners: s.winners ?? [],
  };
}
export type RoomView = ReturnType<typeof view>;

export async function poll(code: string, me: string) {
  const cur = await read(code);
  if (!cur) return { error: "No game with that code. Check it and try again." };
  const now = Date.now();
  if (cur.state.kind === "live" && (cur.state.status === "answering" || cur.state.status === "reveal")) {
    const g = await loadSet(cur.state.chapterId);
    const s = structuredClone(cur.state);
    if (tick(s, g, now)) {
      if (await write(code, cur.version, s)) return { view: view(s, me, now) };
      const again = await read(code);
      if (again) return { view: view(again.state, me, now) };
    }
  }
  return { view: view(cur.state, me, now) };
}

export async function join(code: string, me: string, name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (clean.length < 1) return { error: "Type a name first." };
  const r = await mutate(code, (s) => {
    if (s.kind === "async") return;
    if (s.players.some((p) => p.id === me)) { s.players = s.players.map((p) => (p.id === me ? { ...p, name: clean } : p)); return; }
    if (s.status !== "lobby") return "This game already started. Ask the host to start a new one.";
    if (s.players.length >= MAX_PLAYERS) return "This game is full.";
    if (s.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return "Someone already took that name. Try another.";
    s.players.push({ id: me, name: clean, alive: true, streak: 0 });
  });
  return "error" in r ? r : { view: view(r.state!, me, Date.now()) };
}

export async function start(code: string, me: string) {
  const r = await mutate(code, (s, g) => {
    if (s.kind !== "live") return "This is a challenge, not a live game.";
    if (s.host !== me) return "Only the host can start.";
    if (s.status !== "lobby") return;
    if (!s.players.length) return "Wait for at least one player to join.";
    nextRound(s, g, Date.now());
  });
  return "error" in r ? r : { view: view(r.state!, me, Date.now()) };
}

export async function answer(code: string, me: string, typed: string) {
  const r = await mutate(code, (s, g) => {
    if (s.kind !== "live" || s.status !== "answering") return "Answers are closed for this round.";
    const p = s.players.find((x) => x.id === me);
    if (!p?.alive) return "You're out of this game. Watch how it ends!";
    if (Date.now() > s.deadline + 1500) return "Time's up for this round.";
    let a: string | null;
    if (s.game === "quiz") {
      const q = (g.pool ?? [])[s.prompt], n = Number(typed);
      if (!q || !Number.isInteger(n) || n < 0 || n >= q.choices.length) return "Pick one of the answers.";
      if (s.answers[me]) return; // first tap counts
      s.answers[me] = { typed: String(n), answer: String(n), at: Math.min(Date.now(), s.deadline) };
      tick(s, g, Date.now());
      return;
    }
    if (s.game === "math") { const n = readNumber(typed); if (n == null) return "Type a whole number."; a = String(n); }
    else { a = makeResolver(g.set!)(typed); if (!a) return `We don't know that ${g.set!.noun}. Pick one from the list.`; }
    s.answers[me] = { typed: typed.trim().slice(0, 80), answer: a };
    tick(s, g, Date.now());
  });
  return "error" in r ? r : { view: view(r.state!, me, Date.now()) };
}

/** Host: play again with the same code. Everyone stays in the room and is back in the game; new people can join before the start. */
export async function restart(code: string, me: string) {
  const r = await mutate(code, (s) => {
    if (s.kind !== "live" || s.host !== me) return "Only the host can restart.";
    Object.assign(s, { status: "lobby", seed: Math.floor(Math.random() * 2 ** 31), round: 0, prompt: -1, promptText: "", level: 1, site: "", deadline: 0,
      answers: {}, used: {}, asked: [], last: undefined, revealUntil: undefined, ending: undefined, winners: undefined, order: undefined });
    s.players = s.players.map((p) => ({ id: p.id, name: p.name, alive: true, streak: 0, score: 0 }));
  });
  return "error" in r ? r : { view: view(r.state!, me, Date.now()) };
}

/** Host: skip the reveal pause (or end a round early when everyone's stuck). */
export async function advance(code: string, me: string) {
  const r = await mutate(code, (s, g) => {
    if (s.kind !== "live" || s.host !== me) return "Only the host can do that.";
    const now = Date.now();
    if (s.status === "answering") { s.deadline = now; tick(s, g, now); }
    else if (s.status === "reveal") tick(s, g, now, true);
  });
  return "error" in r ? r : { view: view(r.state!, me, Date.now()) };
}

export async function postResult(code: string, me: string, name: string, streak: number) {
  const r = await mutate(code, (s) => {
    if (s.kind !== "async") return "Not a challenge.";
    const n = Math.max(0, Math.min(1000, Math.floor(streak)));
    const clean = name.trim().slice(0, 24) || "Player";
    const prev = s.results.find((x) => x.id === me);
    if (prev) { prev.name = clean; if (n > prev.streak) { prev.streak = n; prev.at = Date.now(); } }
    else s.results.push({ id: me, name: clean, streak: n, at: Date.now() });
  });
  return "error" in r ? r : { view: view(r.state!, me, Date.now()) };
}

export async function roomChapter(code: string) {
  const cur = await read(code);
  return cur ? cur.state.chapterId : null;
}

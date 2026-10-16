// "Math Blitz": basic arithmetic that gets harder every few problems. Miss one (or run out of time) and you're out.
// Problems come from a seed, so a live room or a challenge code gives everyone the same ones.
import { rng, seedFor } from "./same";

export type MathSpec = { kind: "basic" };
export type MathProblem = { text: string; answer: number; level: number; seconds: number };

export const cleanMath = (x: any): MathSpec | undefined => (x && typeof x === "object" ? { kind: "basic" } : undefined);

/** Level 1 for problems 1-5, then 2 (to 10), 3 (to 18), 4 (to 28), 5 after that. */
export const mathLevel = (round: number) => (round <= 5 ? 1 : round <= 10 ? 2 : round <= 18 ? 3 : round <= 28 ? 4 : 5);
const SECONDS = [0, 10, 10, 12, 15, 20];

export function mathProblem(seed: number, round: number): MathProblem {
  const r = rng(seedFor(seed, round, 7));
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const level = mathLevel(round);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  let text = "", answer = 0;
  const add = (a: number, b: number) => { text = `${a} + ${b}`; answer = a + b; };
  const sub = (a: number, b: number) => { const [x, y] = a >= b ? [a, b] : [b, a]; text = `${x} − ${y}`; answer = x - y; };
  const mul = (a: number, b: number) => { text = `${a} × ${b}`; answer = a * b; };
  const div = (a: number, b: number) => { text = `${a * b} ÷ ${b}`; answer = a; };
  const kind = pick(level === 1 ? ["add", "sub"] : level === 2 ? ["add", "sub", "mul"] : level === 3 ? ["add", "sub", "mul", "div"] : ["add", "sub", "mul", "div", "two"]);
  if (level === 1) { kind === "add" ? add(int(1, 9), int(1, 9)) : sub(int(2, 18), int(1, 9)); }
  else if (level === 2) {
    if (kind === "add") add(int(10, 49), int(2, 9)); else if (kind === "sub") sub(int(20, 59), int(2, 9)); else mul(int(2, 5), int(2, 10));
  } else if (level === 3) {
    if (kind === "add") add(int(15, 69), int(11, 39)); else if (kind === "sub") sub(int(40, 99), int(11, 39));
    else if (kind === "mul") mul(int(3, 12), int(3, 12)); else div(int(2, 10), int(2, 10));
  } else if (level === 4) {
    if (kind === "add") add(int(120, 599), int(25, 99)); else if (kind === "sub") sub(int(200, 699), int(25, 99));
    else if (kind === "mul") { pick([0, 1]) ? mul(int(12, 49), int(3, 9)) : (() => { const n = int(11, 15); text = `${n}²`; answer = n * n; })(); }
    else if (kind === "div") div(int(6, 12), int(6, 12));
    else { const a = int(3, 9), b = int(3, 9), c = int(2, 20); text = `${a} × ${b} + ${c}`; answer = a * b + c; }
  } else {
    if (kind === "add") add(int(250, 899), int(120, 499)); else if (kind === "sub") sub(int(400, 999), int(120, 399));
    else if (kind === "mul") mul(int(12, 25), int(11, 19)); else if (kind === "div") div(int(11, 25), int(3, 9));
    else {
      const f = pick([0, 1, 2]);
      if (f === 0) { const a = int(2, 9), b = int(3, 12), c = int(3, 9); text = `(${a} + ${b}) × ${c}`; answer = (a + b) * c; }
      else if (f === 1) { const a = int(6, 12), b = int(2, 9), c = int(5, 40); const p = a * b; const k = Math.min(c, p); text = `${a} × ${b} − ${k}`; answer = p - k; }
      else { const n = int(6, 15), m = int(2, 30); text = `${n}² + ${m}`; answer = n * n + m; }
    }
  }
  return { text, answer, level, seconds: SECONDS[level] };
}

/** Reads a typed number ("56", " 56 ", "1,200"); null if it isn't one. */
export function readNumber(typed: string): number | null {
  const t = typed.replace(/[,\s]/g, "").replace(/^−/, "-");
  return /^-?\d{1,7}$/.test(t) ? Number(t) : null;
}

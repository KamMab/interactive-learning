"use client";
// A random id that identifies this browser in game rooms (no sign-in needed), plus the last name used.
const KEY = "il-player", NAME = "il-player-name";
let mem = "";
export function playerId() {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(KEY, v); }
    return v;
  } catch { return (mem ||= crypto.randomUUID()); }
}
export function savedName() { try { return localStorage.getItem(NAME) ?? ""; } catch { return ""; } }
export function saveName(n: string) { try { localStorage.setItem(NAME, n); } catch { /* private mode */ } }

export async function room<T = any>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  try {
    const r = await fetch("/api/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, me: playerId() }) });
    return await r.json();
  } catch { return { error: "Can't reach the game. Check your connection." } as T & { error?: string }; }
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { room, saveName, savedName } from "./player";

/** "Play live" on a chapter: a Kahoot-style quiz of its questions that friends or a class join with a code. */
export default function LiveQuizButton({ chapterId, available }: { chapterId: string; available: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const counts = [...new Set([5, 10, 15, 20].filter((n) => n < available).concat(available))];
  const [count, setCount] = useState(Math.min(10, available));
  const [seconds, setSeconds] = useState(20);
  const [name, setName] = useState(savedName());
  const [plays, setPlays] = useState(false);
  const [teams, setTeams] = useState(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Add your name so players know whose game it is."); return; }
    setBusy(true); setErr(""); saveName(name.trim());
    const r = await room<{ code?: string }>({ op: "create", chapterId, kind: "live", quiz: true, count, seconds, name, hostPlays: plays, teams });
    if (r.error || !r.code) { setErr(r.error ?? "Couldn't start the game."); setBusy(false); return; }
    router.push(`/play/${r.code}`);
  }
  return (
    <div className="live-quiz">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="2.5" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" /></svg>
        Play live
      </button>
      {open && (
        <form onSubmit={go} className="card live-quiz-pop flex flex-col gap-4 p-5 enter">
          <div><span className="eyebrow">Live quiz</span><p className="mt-1 text-sm text-muted">Kahoot-style: you get a code, everyone joins from their phone, and they all answer the same question at once. Faster right answers earn more points. Nobody gets knocked out.</p></div>
          <div className="flex flex-wrap items-center gap-2"><span className="note">Questions</span>
            {counts.map((n) => <button key={n} type="button" className="chip sm" aria-pressed={count === n} onClick={() => setCount(n)}>{n === available ? `All ${n}` : n}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="note">Time per question</span>
            {[10, 20, 30, 60].map((s) => <button key={s} type="button" className="chip sm" aria-pressed={seconds === s} onClick={() => setSeconds(s)}>{s}s</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2"><span className="note">Teams</span>
            {[0, 2, 3, 4].map((n) => <button key={n} type="button" className="chip sm" aria-pressed={teams === n} onClick={() => setTeams(n)}>{n ? `${n} teams` : "Off"}</button>)}
          </div>
          {teams > 0 && <p className="note -mt-2">Players pick their team when they join. You can rename teams, add more, or move people before you start.</p>}
          <label className="flex flex-col gap-1 text-sm font-bold">Your name<input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Ms. Rivera" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plays} onChange={(e) => setPlays(e.target.checked)} /> I&apos;m playing too (leave off to run it on a projector)</label>
          {err && <p className="text-sm text-bad">{err}</p>}
          <div className="flex flex-wrap gap-3"><button className="btn" disabled={busy}>{busy ? "Making a code…" : "Get a code"}</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}

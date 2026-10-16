"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SoloRun, { type RunEnd } from "./SoloRun";
import JoinBox from "./JoinBox";
import { room, saveName, savedName } from "./player";
import { saveStreak, streakBoard, type BoardRow } from "@/app/play/actions";
import { VERDICT_TEXT, type SameSet } from "@/lib/same";
import type { GP } from "../games/GameHost";

export function Rules({ noun }: { noun: string }) {
  return (
    <ul className="same-rules">
      <li><b>1</b>Each round asks you to name a {noun} that fits, like “Name a country in Europe.”</li>
      <li><b>2</b>I secretly pick one too. If you say the same thing as me, you&apos;re out.</li>
      <li><b>3</b>No repeats: anything already said in the game can&apos;t be used again. Questions get narrower as you go.</li>
    </ul>
  );
}

/** The longest streaks against the site. Top row = reigning champion until someone beats them. */
export function StreakBoard({ chapterId, refresh = 0 }: { chapterId: string; refresh?: number }) {
  const [b, setB] = useState<{ rows: BoardRow[]; mine: number | null; signedIn: boolean; error?: string } | null>(null);
  useEffect(() => { streakBoard(chapterId).then(setB).catch(() => setB({ rows: [], mine: null, signedIn: false, error: "Leaderboard unavailable." })); }, [chapterId, refresh]);
  if (!b) return <div className="card h-40 animate-pulse" />;
  const [champ, ...rest] = b.rows;
  return (
    <section className="card same-board">
      <div className="same-crown">
        <span className="eyebrow">Reigning champion</span>
        {champ ? <p><span aria-hidden>👑</span> <b>{champ.name}</b>{champ.me ? " (you)" : ""} · <span className="mono">{champ.best} in a row</span></p>
          : <p className="text-muted">{b.error ?? "No one yet. Set the first record."}</p>}
      </div>
      {rest.length > 0 && (
        <ol className="same-top" start={2}>
          {rest.map((r, i) => <li key={i} className={r.me ? "me" : ""}><span>{r.name}</span><b className="mono">{r.best}</b></li>)}
        </ol>
      )}
      <p className="note">{b.signedIn ? (b.mine != null ? `Your best: ${b.mine}.` : "Your best streak will show here.") : <>Playing as a guest. <Link className="underline" href={`/signin?next=${encodeURIComponent(typeof location !== "undefined" ? location.pathname : "/")}`}>Sign in</Link> to get on the leaderboard.</>}</p>
    </section>
  );
}

export function RunOver({ end, onAgain, onHome, saved }: { end: RunEnd; onAgain: () => void; onHome?: () => void; saved?: React.ReactNode }) {
  return (
    <section className="card p-6 enter">
      <span className="eyebrow">Game over</span>
      <p className="verdict">{end.streak} in a row</p>
      {end.prompt && (
        <p className="mt-3 text-muted">
          <b className="text-ink">{VERDICT_TEXT[end.verdict]}.</b> “{end.prompt}”: you said <b className="text-ink">{end.mine}</b>{end.verdict === "site" ? ", and so did I." : `; I said ${end.site}.`}
          {end.examples.length > 0 && <> Ones that would have worked: {end.examples.join(", ")}.</>}
        </p>
      )}
      {saved}
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn" onClick={onAgain} autoFocus>Play again</button>
        {onHome && <button className="btn-ghost" onClick={onHome}>Back</button>}
      </div>
    </section>
  );
}

function HostForm({ chapterId, onCancel }: { chapterId: string; onCancel: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<"live" | "async">("live");
  const [name, setName] = useState(savedName());
  const [plays, setPlays] = useState(true);
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Add your name so players know whose game it is."); return; }
    setBusy(true); setErr(""); saveName(name.trim());
    const r = await room<{ code?: string }>({ op: "create", chapterId, kind, name, hostPlays: plays, seconds });
    if (r.error || !r.code) { setErr(r.error ?? "Couldn't start the game."); setBusy(false); return; }
    router.push(`/play/${r.code}`);
  }
  return (
    <form onSubmit={go} className="card flex flex-col gap-4 p-5 enter">
      <div><span className="eyebrow">Host a game</span><p className="mt-1 text-muted">You&apos;ll get a code. Anyone who types it in on the Games page joins you, from any device.</p></div>
      <div className="seg max-w-md">
        <button type="button" aria-pressed={kind === "live"} onClick={() => setKind("live")}>Live</button>
        <button type="button" aria-pressed={kind === "async"} onClick={() => setKind("async")}>Challenge</button>
      </div>
      <p className="text-sm text-muted">{kind === "live"
        ? "Everyone answers the same question at the same time, like Kahoot. Match me OR another player and you're out. Last one standing wins. Great for a class."
        : "Everyone plays the same game against me whenever they like. Longest streak tops the challenge's board."}</p>
      <label className="flex flex-col gap-1 text-sm font-bold">Your name<input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Ms. Rivera" /></label>
      {kind === "live" && (
        <>
          <div className="flex flex-wrap items-center gap-2"><span className="note">Time to answer</span>
            {[15, 20, 30, 45, 60].map((s) => <button key={s} type="button" className="chip sm" aria-pressed={seconds === s} onClick={() => setSeconds(s)}>{s}s</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plays} onChange={(e) => setPlays(e.target.checked)} /> I&apos;m playing too (turn off to just run the game on a projector)</label>
        </>
      )}
      {err && <p className="text-sm text-bad">{err}</p>}
      <div className="flex flex-wrap gap-3"><button className="btn" disabled={busy}>{busy ? "Making a code…" : "Get a code"}</button><button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

// The game's home: play the site, host a live game or challenge with a code, or join one.
export default function SameGame({ chapter }: GP) {
  const set = chapter.content.same as SameSet;
  const [view, setView] = useState<"home" | "solo" | "host">("home");
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [run, setRun] = useState(0);
  const [saved, setSaved] = useState<React.ReactNode>(null);
  const [refresh, setRefresh] = useState(0);

  async function over(e: RunEnd) {
    setEnd(e); setSaved(null);
    if (e.streak <= 0) return;
    const r = await saveStreak(chapter.id, e.streak).catch(() => ({ error: "Couldn't save." }));
    setSaved("error" in r ? <p className="note mt-3">{r.error}</p>
      : r.crowned ? <p className="fb mt-3"><strong>👑 New champion!</strong><br />You hold the record until someone beats {r.best}.</p>
      : r.improved ? <p className="fb mt-3"><strong>New personal best: {r.best}</strong></p> : <p className="note mt-3">Your best is still {r.best}.</p>);
    setRefresh((x) => x + 1);
  }

  if (view === "solo") {
    return (
      <div className="mx-auto flex game-col flex-col gap-4">
        {end ? <RunOver end={end} saved={saved} onAgain={() => { setEnd(null); setRun((r) => r + 1); }} onHome={() => { setEnd(null); setView("home"); }} />
          : <SoloRun key={run} set={set} onOver={over} />}
        {end && <StreakBoard chapterId={chapter.id} refresh={refresh} />}
      </div>
    );
  }
  return (
    <div className="mx-auto flex game-col flex-col gap-4">
      <section className="sheet same-sheet same-home">
        <span className="tag">How to play</span>
        <Rules noun={set.noun} />
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn big" onClick={() => { setEnd(null); setView("solo"); setRun((r) => r + 1); }}>Play against me</button>
          <button className="btn-ghost big" onClick={() => setView(view === "host" ? "home" : "host")}>Play with friends or a class</button>
        </div>
      </section>
      {view === "host" && <HostForm chapterId={chapter.id} onCancel={() => setView("home")} />}
      <JoinBox />
      <StreakBoard chapterId={chapter.id} refresh={refresh} />
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Combo from "../Combo";
import SoloRun, { type RunEnd } from "./SoloRun";
import MathRun from "./MathRun";
import { MathRules } from "./MathGame";
import JoinBox from "./JoinBox";
import { Rules, RunOver, StreakBoard } from "./SameGame";
import { room, saveName, savedName } from "./player";
import { saveStreak } from "@/app/play/actions";
import { VERDICT_TEXT, type SameSet } from "@/lib/same";
import type { RoomView } from "@/lib/rooms";

type LiveView = Extract<RoomView, { kind: "live" }>;
type AsyncView = Extract<RoomView, { kind: "async" }>;

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof location !== "undefined" ? `${location.origin}/play/${code}` : "";
  return (
    <div className="room-code">
      <span className="eyebrow">Game code</span>
      <b className="mono">{code}</b>
      <p className="note">Join at <span className="mono">{typeof location !== "undefined" ? location.host : ""}/play</span> or open the link.</p>
      <button type="button" className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }}>{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
}

function NameForm({ label, onName, busy }: { label: string; onName: (n: string) => void; busy?: boolean }) {
  const [n, setN] = useState(savedName());
  return (
    <form className="card flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); if (n.trim()) { saveName(n.trim()); onName(n.trim()); } }}>
      <label className="flex flex-col gap-1 text-sm font-bold">Your name<input className="input max-w-xs" value={n} onChange={(e) => setN(e.target.value)} maxLength={24} autoFocus placeholder="So others know it's you" /></label>
      <div><button className="btn" disabled={!n.trim() || busy}>{busy ? "Joining…" : label}</button></div>
    </form>
  );
}

function Countdown({ until, offset }: { until: number; offset: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((until - (Date.now() + offset)) / 1000));
  return <span className={`pill${left <= 5 ? " low" : ""}`}><b>{left}s</b></span>;
}

function Live({ code, v, offset, set, act, err, href }: { code: string; v: LiveView; offset: number; set?: SameSet; act: (op: string, extra?: object) => Promise<void>; err: string; href: string }) {
  const math = v.game === "math";
  const names = useMemo(() => (set ? set.answers.map((a) => a.name).sort((a, b) => a.localeCompare(b)) : []), [set]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setTyped(""), [v.round]);
  const me = v.me, joined = !!me;
  const alive = v.players.filter((p) => p.alive);

  if (v.status === "lobby") {
    return (
      <div className="flex flex-col gap-4">
        {v.isHost && <Code code={code} />}
        {!joined && !v.isHost && <NameForm label="Join the game" busy={busy} onName={async (n) => { setBusy(true); await act("join", { name: n }); setBusy(false); }} />}
        {joined && !v.isHost && <p className="fb"><strong>You&apos;re in, {me!.name}!</strong><br />Waiting for {v.hostName} to start the game.</p>}
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="eyebrow">{v.players.length} player{v.players.length === 1 ? "" : "s"}</span>
            {v.isHost && <button className="btn" disabled={!v.players.length || busy} onClick={async () => { setBusy(true); await act("start"); setBusy(false); }}>Start the game</button>}
          </div>
          <ul className="room-players">{v.players.map((p) => <li key={p.id} className={p.id === me?.id ? "me" : ""}>{p.name}</li>)}</ul>
          {!v.players.length && <p className="note">Players show up here as they join.</p>}
        </section>
        <section className="card p-5"><span className="eyebrow">Live rules</span>{math || !set ? <><MathRules /><p className="note mt-2">Everyone gets the same problem at once. Last one standing wins.</p></> : <><Rules noun={set.noun} /><p className="note mt-2">Live games add one more rule: if you say the same thing as another player, you&apos;re both out. Last one standing wins.</p></>}</section>
      </div>
    );
  }

  if (v.status === "over") {
    const ranked = [...v.players].sort((a, b) => b.streak - a.streak || (b.outRound ?? 1e9) - (a.outRound ?? 1e9));
    const winners = v.players.filter((p) => v.winners.includes(p.id));
    return (
      <div className="flex flex-col gap-4">
        <section className="card p-6 enter">
          <span className="eyebrow">Game over · {v.round} rounds</span>
          <p className="verdict">{winners.length === 1 ? `${winners[0].name} wins!` : winners.length > 1 ? `Tie: ${winners.map((w) => w.name).join(" & ")}` : "Game over"}</p>
          {v.last && <p className="mt-3 text-muted">{math ? <>Last problem: {v.last.prompt} = <b className="text-ink">{v.last.site}</b>.</> : <>Last question: “{v.last.prompt}”. I said <b className="text-ink">{v.last.site}</b>.</>}</p>}
          {v.last && <ul className="room-rows mt-3">{v.last.rows.map((r) => <li key={r.id} className={r.verdict === "ok" ? "good" : "bad"}><span className="nm">{r.name}</span><span className="ans">{r.answer ?? "—"}</span><span className="vd">{math && r.verdict === "ok" ? "Correct" : VERDICT_TEXT[r.verdict]}</span></li>)}</ul>}
        </section>
        <section className="card p-5">
          <span className="eyebrow">Final standings</span>
          <ol className="same-top mt-2">{ranked.map((p) => <li key={p.id} className={p.id === me?.id ? "me" : ""}><span>{v.winners.includes(p.id) ? "👑 " : ""}{p.name}</span><b className="mono">{p.streak}</b></li>)}</ol>
        </section>
        {v.isHost
          ? <div className="flex flex-wrap gap-3"><button className="btn big" disabled={busy} onClick={async () => { setBusy(true); await act("restart"); setBusy(false); }}>Restart with the same code</button><Link className="btn-ghost big" href={href}>New game</Link></div>
          : <p className="note">Waiting for {v.hostName} to restart. You&apos;ll be back in automatically, or <Link className="underline" href="/games">find another game</Link>.</p>}
      </div>
    );
  }

  const answered = v.players.filter((p) => p.alive && p.answered).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono mr-auto text-[13px] text-muted">Round {v.round} · {alive.length} still in · code {code}</span>
        <span className="pill">Level <b>{v.level}</b>/5</span>
        {me && <span className="pill streak"><b>{me.streak}</b> streak</span>}
        {v.status === "answering" ? <Countdown until={v.deadline} offset={offset} /> : <Countdown until={v.revealUntil} offset={offset} />}
      </div>
      <section className="sheet same-sheet enter" key={`${v.round}-${v.status}`}>
        <span className="tag">{v.status === "answering" ? (math ? "Math Blitz" : "Don't say the same thing as me") : `Round ${v.round} results`}</span>
        <p className={math ? "math-q" : "same-prompt"}>{v.status === "answering" ? v.promptText : v.last?.prompt}{math ? " = ?" : ""}</p>
        {v.status === "answering" ? (
          me?.alive ? (v.myAnswer ? (
            <p className="fb"><strong>Locked in: {v.myAnswer}</strong><br />Waiting for the others ({answered} of {alive.length} in).</p>
          ) : (
            <>
              {!math && <p className="same-lock"><span aria-hidden>🔒</span> I&apos;ve locked in my answer. Don&apos;t match me or anyone else.</p>}
              <form className="same-form" onSubmit={async (e) => { e.preventDefault(); if (!typed.trim()) return; setBusy(true); await act("answer", { answer: typed }); setBusy(false); }}>
                {math || !set ? <input id="room-answer" className="input mono math-in" inputMode="numeric" autoComplete="off" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Answer" aria-label="Your answer" />
                  : <Combo id="room-answer" value={typed} onChange={setTyped} options={names} placeholder={`Type a ${set.noun}`} />}
                <button className="btn" disabled={!typed.trim() || busy}>Lock it in</button>
              </form>
            </>
          )) : <p className="note">{me ? "You're out. Watch who survives!" : "Watching."} {answered} of {alive.length} have answered.</p>
        ) : v.last && (
          <div className="enter">
            <div className="same-card site big"><span>{math ? "Answer" : "I said"}</span><b>{v.last.site}</b></div>
            <ul className="room-rows">
              {v.last.rows.map((r) => (
                <li key={r.id} className={r.verdict === "ok" ? "good" : "bad"}>
                  <span className="nm">{r.name}{r.id === me?.id ? " (you)" : ""}</span>
                  <span className="ans">{r.answer ?? "—"}</span>
                  <span className="vd">{math && r.verdict === "ok" ? "Correct" : VERDICT_TEXT[r.verdict]}</span>
                </li>
              ))}
            </ul>
            <p className="note mt-2">{v.ending ? "That's the game!" : "Next round starts in a moment."}</p>
          </div>
        )}
        {err && <p className="mt-2 text-sm text-bad">{err}</p>}
        {v.isHost && (
          <div className="mt-4 flex gap-3">
            <button className="btn-ghost" onClick={() => act("next")}>{v.status === "answering" ? "End this round now" : v.ending ? "Show results" : "Next round now"}</button>
          </div>
        )}
      </section>
      <section className="card p-5">
        <span className="eyebrow">Players</span>
        <ul className="room-players">{v.players.map((p) => <li key={p.id} className={`${p.alive ? "" : "out"}${p.id === me?.id ? " me" : ""}`}>{p.name} <b className="mono">{p.streak}</b>{v.status === "answering" && p.alive && p.answered ? " ✓" : ""}</li>)}</ul>
      </section>
      {v.used.length > 0 && <details className="same-used" open><summary>This question came up before. Already said for it:</summary><p>{[...v.used].sort((a, b) => a.localeCompare(b)).join(" · ")}</p></details>}
    </div>
  );
}

function Challenge({ code, v, set, chapterId, act }: { code: string; v: AsyncView; set?: SameSet; chapterId: string; act: (op: string, extra?: object) => Promise<void> }) {
  const [name, setName] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [saved, setSaved] = useState<React.ReactNode>(null);
  async function over(e: RunEnd) {
    setEnd(e);
    await act("result", { name, streak: e.streak });
    const r = await saveStreak(chapterId, e.streak).catch(() => null);
    setSaved(r && !("error" in r) && r.crowned ? <p className="fb mt-3"><strong>👑 New champion of this game!</strong></p> : null);
  }
  const board = (
    <section className="card p-5">
      <span className="eyebrow">Challenge board · code {code}</span>
      {v.results.length ? <ol className="same-top mt-2">{v.results.map((r, i) => <li key={r.id + i} className={r.id === v.mine?.id ? "me" : ""}><span>{i === 0 ? "👑 " : ""}{r.name}</span><b className="mono">{r.streak}</b></li>)}</ol>
        : <p className="note mt-2">No one has played yet.</p>}
    </section>
  );
  if (name && !end) return v.game === "math" || !set ? <MathRun key={run} seed={v.seed} label={`Challenge ${code}`} onOver={over} />
    : <SoloRun key={run} set={set} seed={v.seed} label={`Challenge ${code}`} onOver={over} />;
  if (end) return <div className="flex flex-col gap-4"><RunOver end={end} saved={saved} onAgain={() => { setEnd(null); setSaved(null); setRun((r) => r + 1); }} />{board}</div>;
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-5">
        <span className="eyebrow">Challenge from {v.hostName}</span>
        <p className="mt-1 text-muted">Everyone with this code gets the same game against me. Play whenever you like; your best streak goes on the board.</p>
        {v.game === "math" || !set ? <MathRules /> : <Rules noun={set.noun} />}
      </section>
      {v.isHost && <Code code={code} />}
      <NameForm label={v.mine ? "Play again" : "Start the challenge"} onName={(n) => { setName(n); setRun((r) => r + 1); }} />
      {board}
    </div>
  );
}

export default function RoomClient({ code, set, chapterId, title, href }: { code: string; set?: SameSet; chapterId: string; title: string; href: string }) {
  const [v, setV] = useState<RoomView | null>(null);
  const [err, setErr] = useState(""), [fatal, setFatal] = useState("");
  const offset = useRef(0);
  const take = (r: { view?: RoomView; error?: string }) => {
    if (r.view) { offset.current = r.view.now - Date.now(); setV(r.view); setErr(""); }
    else if (r.error) { if (!v) setFatal(r.error); else setErr(r.error); }
  };
  const act = async (op: string, extra: object = {}) => take(await room({ op, code, ...extra }));
  useEffect(() => { act("poll"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!v || v.kind !== "live") return;
    // Slower checks on the results screen, so players see the host's restart.
    const t = setInterval(async () => { const r = await room({ op: "poll", code }); if (r.view) { offset.current = r.view.now - Date.now(); setV(r.view); } }, v.status === "over" ? 3000 : 1200);
    return () => clearInterval(t);
  }, [v?.kind, (v as LiveView | null)?.status, code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fatal) return <div className="flex flex-col gap-4"><p className="fb bad"><strong>Can&apos;t open that game</strong><br />{fatal}</p><JoinBox /></div>;
  if (!v) return <div className="card h-72 animate-pulse" />;
  return (
    <div className="mx-auto flex game-col flex-col gap-4">
      <div>
        <span className="eyebrow">{v.kind === "live" ? "Live game" : "Challenge"} · <Link href={href} className="underline">{title}</Link></span>
        <h1 className="mt-1 text-[28px] font-bold leading-tight">{v.game === "math" ? "Math Blitz" : <>Don&apos;t Say the Same Thing as Me</>}</h1>
      </div>
      {v.kind === "live" ? <Live code={code} v={v} offset={offset.current} set={set} act={act} err={err} href={href} /> : <Challenge code={code} v={v} set={set} chapterId={chapterId} act={act} />}
      {v.kind === "async" && <StreakBoard chapterId={chapterId} />}
    </div>
  );
}

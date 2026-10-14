"use client";
import { useEffect, useRef, useState } from "react";
import { MODE_ICON } from "./icons";
import { openSettings } from "./SiteHeader";
import { GAMES } from "./games/GameHost";
import { PLAYING, chapterProgress, noteVisit, save, store, subscribe } from "@/lib/store";
import { MODE_INFO, modeCount, type Chapter, type Mode } from "@/lib/types";

type Chips = { key: "count" | "pairs" | "seconds"; label: string; list: number[]; def: number; fmt: (n: number) => string };

function optionChips(mode: Mode, chapter: Chapter): Chips {
  const c = chapter.content, s = chapter.settings;
  if (mode === "learn") return { key: "count", label: "Per round", list: [5, 7, 10], def: 7, fmt: (n) => String(n) };
  if (mode === "match") {
    const max = c.terms.length, def = Math.min(s.matchPairs, max);
    const list = [...new Set([...[4, 6, 8, 10].filter((n) => n <= max), def])].sort((a, b) => a - b);
    return { key: "pairs", label: "Pairs", list, def, fmt: (n) => String(n) };
  }
  if (mode === "rush") {
    const list = [...new Set([30, 60, 90, 120, s.rushSeconds])].sort((a, b) => a - b);
    return { key: "seconds", label: "Round", list, def: s.rushSeconds, fmt: (n) => n + "s" };
  }
  const pool = modeCount(mode, c);
  const def = s.questionCount > 0 && s.questionCount < pool ? s.questionCount : 0;
  const list = [...new Set([...[5, 10, 15, 20].filter((n) => n < pool), def, 0])].sort((a, b) => (a || 1e9) - (b || 1e9));
  return { key: "count", label: mode === "flashcards" ? "Cards" : mode === "entries" ? "Entries" : mode === "map" ? "Places" : "Questions", list, def, fmt: (n) => (n ? String(n) : `All ${pool}`) };
}

// Quizlet-style chapter page: the first mode (Learn by default) opens right away at the top,
// and every other way to study sits underneath as tiles that swap what's on top.
export default function ChapterStudy({ chapter, label, initialMode }: { chapter: Chapter; label: string; initialMode?: string }) {
  const [ready, setReady] = useState(false);
  const [, force] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const modes = chapter.settings.modes.filter((m) => modeCount(m, chapter.content) > 0);
  const progress = ready ? chapterProgress(chapter.id) : null;
  const lockOn = chapter.settings.requireFlashcardsFirst && modes.includes("flashcards");
  const locked = (m: Mode) => lockOn && m !== "flashcards" && !progress?.flashcardsDone;
  const opening = (): Mode | undefined => {
    const asked = modes.find((m) => m === initialMode);
    return asked && !locked(asked) ? asked : modes.find((m) => !locked(m));
  };
  const [mode, setMode] = useState<Mode | undefined>(undefined);
  const [opt, setOpt] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setReady(true);
    noteVisit({ id: chapter.id, label, title: chapter.title, href: location.pathname,
      items: chapter.content.terms.length + chapter.content.questions.length });
    return subscribe(() => force((x) => x + 1));
  }, [chapter.id, label]);

  useEffect(() => {
    if (!ready || mode) return;
    const m = opening();
    if (m) { setMode(m); setOpt(optionChips(m, chapter).def); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    PLAYING.chapterId = mode ? chapter.id : null;
    PLAYING.mode = mode ?? null;
    return () => { PLAYING.chapterId = null; PLAYING.mode = null; };
  }, [mode, chapter.id]);

  if (modes.length === 0) return <p className="text-muted">Nothing to study here yet.</p>;

  function pick(m: Mode) {
    if (locked(m)) return;
    setMode(m);
    setOpt(optionChips(m, chapter).def);
    setRun((r) => r + 1);
    const p = chapterProgress(chapter.id); p.lastMode = m; save();
    try { const u = new URL(location.href); u.searchParams.set("mode", m); history.replaceState(null, "", u); } catch {}
    stage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const toModes = () => document.getElementById("modes")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const oc = mode ? optionChips(mode, chapter) : null;
  const Game = mode ? GAMES[mode] : null;
  const study = modes.filter((m) => !MODE_INFO[m].game);
  const games = modes.filter((m) => MODE_INFO[m].game);
  const timer = ready ? store().settings.timer : 15;

  const tile = (m: Mode) => {
    const st = progress?.modes[m];
    return (
      <button key={m} className="mtile2" aria-pressed={mode === m} disabled={locked(m)} onClick={() => pick(m)}>
        <span className="mtile2-ic">{MODE_ICON[m]}</span>
        <span className="mtile2-name">{MODE_INFO[m].name}</span>
        <span className="mtile2-blurb">{locked(m) ? "Finish flashcards once to unlock." : MODE_INFO[m].blurb}</span>
        {mode === m ? <span className="tag ok">Studying now</span> : st && m !== "flashcards" && m !== "learn" ? <span className="tag">Best {st.best}/{st.total}</span> : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <section ref={stage} className="stage" aria-label="Study">
        <div className="stage-h">
          <div className="flex min-w-0 items-center gap-3">
            {mode && <span className="stage-ic">{MODE_ICON[mode]}</span>}
            <div className="min-w-0"><span className="eyebrow">Studying</span><h2 className="text-[24px] font-bold">{mode ? MODE_INFO[mode].name : "…"}</h2></div>
          </div>
          {oc && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="note">{oc.label}</span>
              {oc.list.map((n) => (
                <button key={n} className="chip sm" aria-pressed={opt === n} onClick={() => { setOpt(n); setRun((r) => r + 1); }}>{oc.fmt(n)}</button>
              ))}
              {mode === "quiz" && <button className="chip sm" onClick={openSettings} title="Change in Settings">{timer ? `${timer}s timer` : "No timer"}</button>}
            </div>
          )}
        </div>
        {Game && mode && oc ? (
          <Game key={`${mode}-${run}`} chapter={{ id: chapter.id, title: label, content: chapter.content, settings: chapter.settings }}
            opts={{ [oc.key]: opt }} onBack={toModes} />
        ) : <div className="card h-72 animate-pulse" />}
      </section>

      <section id="modes" className="flex flex-col gap-4">
        <h2 className="text-[22px] font-bold">Study this chapter</h2>
        <div className="mtiles">{study.map(tile)}</div>
        {games.length > 0 && (
          <>
            <h2 className="mt-4 text-[22px] font-bold">Play your way to mastery</h2>
            <div className="mtiles">{games.map(tile)}</div>
          </>
        )}
      </section>
    </div>
  );
}

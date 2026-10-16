"use client";
import { useEffect, useRef, useState } from "react";
import { MODE_ICON } from "./icons";
import { openSettings } from "./SiteHeader";
import { GAMES } from "./games/GameHost";
import InterestTables from "./InterestTables";
import { PLAYING, chapterProgress, noteVisit, save, store, subscribe } from "@/lib/store";
import { CORE_MODES, EXTRA_MODES, MODE_INFO, contentFor, modeCount, modeName, usableSections, type Chapter, type ChapterContent, type Mode } from "@/lib/types";

type Chips = { key: "count" | "pairs" | "seconds"; label: string; list: number[]; def: number; fmt: (n: number) => string };

function optionChips(mode: Mode, chapter: Chapter): Chips {
  const c = chapter.content, s = chapter.settings;
  if (mode === "same") return { key: "count", label: "", list: [], def: 0, fmt: String }; // endless: no round size to pick
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

/** Share of a part's terms and questions mastered in Learn (levels are saved per item for the whole chapter). */
function mastery(c: ChapterContent, levels: Record<string, number> | undefined) {
  const ids = [...c.terms.map((t) => "t:" + t.id), ...c.questions.map((q) => "q:" + q.id)];
  if (!ids.length) return 0;
  return ids.filter((id) => (levels?.[id] ?? 0) >= 2).length / ids.length;
}

// Quizlet-style chapter page: Learn opens right away at the top, and every other way to study sits
// underneath as tiles that swap what's on top. Long chapters can be studied one section at a time.
export default function ChapterStudy({ chapter, label, initialMode, initialSection }: { chapter: Chapter; label: string; initialMode?: string; initialSection?: string }) {
  const [ready, setReady] = useState(false);
  const [, force] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const sections = usableSections(chapter.content);
  // Topics being studied (all of them by default). The URL keeps a single picked topic for sharing.
  const [picked, setPicked] = useState<string[]>(sections.some((x) => x.id === initialSection) ? [initialSection!] : sections.map((x) => x.id));
  const allPicked = picked.length === sections.length;
  const content = sections.length > 1 && !picked.length
    ? { ...chapter.content, terms: [], questions: [], entries: [], map: null }
    : contentFor(chapter.content, picked);
  const part: Chapter = { ...chapter, content };
  // Learn, Flashcards and Quick-fire for every set; the extras the set was built with go under "More ways to study".
  const core = CORE_MODES.filter((m) => modeCount(m, content) > 0);
  const extras = chapter.settings.modes.filter((m) => EXTRA_MODES.includes(m) && modeCount(m, content) > 0);
  const modes = [...core, ...extras];
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
    if (m) { setMode(m); setOpt(optionChips(m, part).def); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    PLAYING.chapterId = mode ? chapter.id : null;
    PLAYING.mode = mode ?? null;
    return () => { PLAYING.chapterId = null; PLAYING.mode = null; };
  }, [mode, chapter.id]);

  if (modes.length === 0 && sections.length < 2) return <p className="text-muted">Nothing to study here yet.</p>;

  function pick(m: Mode) {
    if (locked(m)) return;
    setMode(m);
    setOpt(optionChips(m, part).def);
    setRun((r) => r + 1);
    const p = chapterProgress(chapter.id); p.lastMode = m; save();
    try { const u = new URL(location.href); u.searchParams.set("mode", m); history.replaceState(null, "", u); } catch {}
    stage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function choose(ids: string[]) {
    setPicked(ids);
    if (!ids.length) return;
    const next = contentFor(chapter.content, ids);
    const keep = mode && modeCount(mode, next) > 0 ? mode : CORE_MODES.find((m) => modeCount(m, next) > 0);
    if (keep) { setMode(keep); setOpt(optionChips(keep, { ...chapter, content: next }).def); }
    setRun((r) => r + 1);
    try { const u = new URL(location.href); if (ids.length === 1) u.searchParams.set("section", ids[0]); else u.searchParams.delete("section"); history.replaceState(null, "", u); } catch {}
  }
  const toModes = () => document.getElementById("modes")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const oc = mode && modes.includes(mode) ? optionChips(mode, part) : null;
  const Game = mode && modes.includes(mode) ? GAMES[mode] : null;
  const secTitle = picked.length === 1 && !allPicked ? sections.find((x) => x.id === picked[0])?.title : !allPicked && picked.length ? `${picked.length} topics` : null;
  const timer = ready ? store().settings.timer : 15;

  const tile = (m: Mode) => {
    const st = progress?.modes[m];
    return (
      <button key={m} className="mtile2" aria-pressed={mode === m} disabled={locked(m)} onClick={() => pick(m)}>
        <span className="mtile2-ic">{MODE_ICON[m]}</span>
        <span className="mtile2-name">{modeName(m, chapter.content)}</span>
        <span className="mtile2-blurb">{locked(m) ? "Finish flashcards once to unlock." : MODE_INFO[m].blurb}</span>
        {mode === m ? <span className="tag ok">Studying now</span> : st && m !== "flashcards" && m !== "learn" ? <span className="tag">Best {st.best}/{st.total}</span> : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-10">
      {chapter.content.tools?.includes("interest-tables") && <InterestTables />}
      {sections.length > 1 && (
        <Topics sections={sections} chapter={chapter} picked={picked} levels={ready ? progress?.learn : undefined} onChange={choose} />
      )}
      <section ref={stage} className="stage" aria-label="Study">
        <div className="stage-h">
          <div className="flex min-w-0 items-center gap-3">
            {mode && <span className="stage-ic">{MODE_ICON[mode]}</span>}
            <div className="min-w-0"><span className="eyebrow">{secTitle ? `Studying · ${secTitle}` : "Studying"}</span><h2 className="text-[24px] font-bold">{mode ? modeName(mode, chapter.content) : "…"}</h2></div>
          </div>
          {oc && oc.list.length > 0 && (
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
          <Game key={`${mode}-${picked.join(",")}-${run}`} chapter={{ id: chapter.id, title: label, content, settings: chapter.settings }}
            opts={{ [oc.key]: opt }} onBack={toModes} />
        ) : !picked.length ? <p className="card p-5 text-muted">Pick at least one topic above to study.</p> : modes.length === 0 ? <p className="card p-5 text-muted">Nothing in these topics yet.</p> : <div className="card h-72 animate-pulse" />}
      </section>

      {modes.length > 1 && <section id="modes" className="flex flex-col gap-4">
        <h2 className="text-[22px] font-bold">{secTitle ? `Study ${picked.length === 1 ? "this topic" : "these topics"}` : "Study this chapter"}</h2>
        <div className="mtiles">{core.map(tile)}</div>
        {extras.length > 0 && (
          <>
            <h2 className="mt-4 text-[22px] font-bold">More ways to study</h2>
            <div className="mtiles">{extras.map(tile)}</div>
          </>
        )}
      </section>}
    </div>
  );
}

/** Dots for mastery: 5 steps, the first always lit so a fresh topic still shows a start. */
function Dots({ share }: { share: number }) {
  const lit = Math.max(1, Math.round(share * 5));
  return <span className="dots" role="img" aria-label={`${Math.round(share * 100)}% mastered`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < lit ? "on" : ""} />)}</span>;
}

// Topics in a long chapter: a slim bar that opens into a checklist (pick one, several or all).
function Topics({ sections, chapter, picked, levels, onChange }: {
  sections: { id: string; title: string; blurb?: string }[]; chapter: Chapter; picked: string[];
  levels: Record<string, number> | undefined; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = picked.length === sections.length;
  const whole = mastery(chapter.content, levels);
  const summary = all ? `All ${sections.length} topics` : picked.length === 0 ? "No topics picked" : picked.length === 1
    ? sections.find((x) => x.id === picked[0])?.title : `${picked.length} of ${sections.length} topics`;
  const count = (id: string) => {
    const c = contentFor(chapter.content, [id]);
    const n = c.terms.length + c.questions.length;
    return `${n} item${n === 1 ? "" : "s"}${c.entries.length ? ` · ${c.entries.length} entr${c.entries.length === 1 ? "y" : "ies"}` : ""}`;
  };
  return (
    <section className="topics" aria-label="Topics">
      <button type="button" className="topics-bar" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="eyebrow">Topics</span>
        <span className="topics-sum">{summary}</span>
        <Dots share={whole} />
        <span className="topics-chev" aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="topics-list">
          {sections.map((x) => {
            const on = picked.includes(x.id);
            return (
              <label key={x.id} className={`topic${on ? " on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? picked.filter((p) => p !== x.id) : sections.map((s) => s.id).filter((id) => id === x.id || picked.includes(id)))} />
                <span className="topic-txt">
                  <b>{x.title}</b>
                  <span>{x.blurb ? `${x.blurb} · ` : ""}{count(x.id)}</span>
                </span>
                <Dots share={mastery(contentFor(chapter.content, [x.id]), levels)} />
              </label>
            );
          })}
          <div className="flex gap-4 px-1 pt-1">
            <button type="button" className="link" onClick={() => onChange(sections.map((s) => s.id))}>Select all</button>
            <button type="button" className="link" onClick={() => onChange([])}>Clear</button>
          </div>
        </div>
      )}
    </section>
  );
}

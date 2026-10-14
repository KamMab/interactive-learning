"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { chapterProgress, save } from "@/lib/store";
import { shuffle } from "@/lib/id";
import type { GP } from "./GameHost";
import { sideLabels } from "@/lib/types";
import Pic from "../Pic";

// Learn: short rounds of mixed questions. Each item needs two correct answers to be mastered;
// a miss sends it back to "still learning" and it returns later in the round.
// Levels: missing = not studied yet, 0 = missed, 1 = right once, 2 = mastered.
type Item = { id: string; prompt: string; choices: string[]; answer: number; explanation: string; label: string; image?: string };
type Asked = Item & { order: number[]; kind: "term" | "definition" | "question" };

const MASTERED = 2;

function buildItems(content: GP["chapter"]["content"]): Item[] {
  const items: Item[] = [];
  const terms = content.terms;
  for (const t of terms) {
    const others = shuffle(terms.filter((x) => x.id !== t.id));
    if (others.length >= 1) {
      items.push({ id: "t:" + t.id, prompt: t.image ? "" : t.definition, choices: [t.term, ...others.slice(0, 3).map((o) => o.term)], answer: 0,
        explanation: t.image ? (t.definition && t.definition !== t.term ? `${t.term}: ${t.definition}` : t.term) : `${t.term}: ${t.definition}`, label: t.term, image: t.image });
    }
  }
  for (const q of content.questions) {
    items.push({ id: "q:" + q.id, prompt: q.prompt, choices: q.choices, answer: q.answer, explanation: q.explanation, label: q.prompt, image: q.image });
  }
  return items;
}

// On the second pass a term is asked the other way round: term → definition.
function ask(item: Item, level: number, content: GP["chapter"]["content"]): Asked {
  if (item.id.startsWith("t:") && level >= 1 && !item.image) {
    const t = content.terms.find((x) => "t:" + x.id === item.id)!;
    const others = shuffle(content.terms.filter((x) => x.id !== t.id)).slice(0, 3);
    const choices = [t.definition, ...others.map((o) => o.definition)];
    return { ...item, prompt: t.term, choices, answer: 0, order: shuffle(choices.map((_, i) => i)), kind: "definition" };
  }
  return { ...item, order: shuffle(item.choices.map((_, i) => i)), kind: item.id.startsWith("t:") ? "term" : "question" };
}

export default function Learn({ chapter, opts, onBack }: GP) {
  const { content } = chapter;
  const roundSize = opts.count && opts.count > 0 ? opts.count : 7;
  const all = useMemo(() => buildItems(content), [content]);
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    const saved = chapterProgress(chapter.id).learn ?? {};
    return Object.fromEntries(all.filter((it) => saved[it.id] !== undefined).map((it) => [it.id, saved[it.id]]));
  });
  const [round, setRound] = useState(1);
  const [queue, setQueue] = useState<Asked[]>([]);
  const [results, setResults] = useState<{ id: string; label: string; ok: boolean }[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [phase, setPhase] = useState<"ask" | "summary" | "done">("ask");
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const correctTotal = useRef(0), answeredTotal = useRef(0);

  // Merge into the chapter's saved levels so studying one section never wipes another section's progress.
  const persist = (lv: Record<string, number>) => {
    const p = chapterProgress(chapter.id), next = { ...(p.learn ?? {}) };
    for (const it of all) { if (lv[it.id] === undefined) delete next[it.id]; else next[it.id] = lv[it.id]; }
    p.learn = next; save();
  };
  const counts = (lv: Record<string, number>) => {
    const vals = all.map((it) => lv[it.id]);
    return {
      mastered: vals.filter((v) => v !== undefined && v >= MASTERED).length,
      learning: vals.filter((v) => v !== undefined && v < MASTERED).length,
      fresh: vals.filter((v) => v === undefined).length,
    };
  };

  function startRound(lv: Record<string, number>) {
    const open = all.filter((it) => (lv[it.id] ?? 0) < MASTERED);
    if (open.length === 0) { setPhase("done"); recordResult(chapter.id, "learn", correctTotal.current, answeredTotal.current); return; }
    // Items already in progress first, then new ones, so each round finishes things off.
    const pick = [...open.filter((it) => lv[it.id] !== undefined).sort((a, b) => lv[b.id] - lv[a.id]), ...shuffle(open.filter((it) => lv[it.id] === undefined))].slice(0, roundSize);
    setQueue(shuffle(pick).map((it) => ask(it, lv[it.id] ?? 0, content)));
    setResults([]); setRetried(new Set()); setPicked(null); setPhase("ask");
  }

  useEffect(() => { startRound(levels); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const cur = queue[0];

  function choose(i: number) {
    if (picked !== null || !cur) return;
    setPicked(i);
    const ok = i === cur.answer;
    answeredTotal.current++; if (ok) correctTotal.current++;
    const lv = { ...levels, [cur.id]: ok ? Math.min(MASTERED, (levels[cur.id] ?? 0) + 1) : 0 };
    setLevels(lv); persist(lv);
    setResults((r) => [...r.filter((x) => x.id !== cur.id), { id: cur.id, label: cur.label, ok: ok && !retried.has(cur.id) }]);
    if (ok) setTimeout(() => next(ok, lv), 900);
  }

  function next(ok = picked === cur?.answer, lv = levels) {
    if (!cur) return;
    let rest = queue.slice(1);
    if (!ok && !retried.has(cur.id)) {
      // Missed items come back once more before the round ends.
      rest = [...rest, ask(all.find((x) => x.id === cur.id)!, 0, content)];
      setRetried((s) => new Set(s).add(cur.id));
    }
    setPicked(null);
    if (rest.length === 0) { setQueue([]); setPhase(counts(lv).mastered === all.length ? "done" : "summary"); if (counts(lv).mastered === all.length) recordResult(chapter.id, "learn", correctTotal.current, answeredTotal.current); }
    else setQueue(rest);
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (phase === "summary" && e.key === "Enter") { e.preventDefault(); setRound((r) => r + 1); startRound(levels); return; }
      if (phase !== "ask" || !cur) return;
      if (picked === null && /^[1-6]$/.test(e.key)) { const n = +e.key - 1; if (n < cur.order.length) choose(cur.order[n]); }
      else if (picked !== null && picked !== cur.answer && e.key === "Enter") { e.preventDefault(); next(); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  const c = counts(levels);
  const pct = (n: number) => `${(n / Math.max(1, all.length)) * 100}%`;
  const bar = (
    <div className="flex flex-col gap-2">
      <div className="learn-bar" role="img" aria-label={`${c.mastered} mastered, ${c.learning} still learning, ${c.fresh} not yet studied`}>
        <i className="m" style={{ width: pct(c.mastered) }} /><i className="l" style={{ width: pct(c.learning) }} />
      </div>
      <div className="learn-key">
        <span><b className="dot m" />Mastered <b className="mono">{c.mastered}</b></span>
        <span><b className="dot l" />Still learning <b className="mono">{c.learning}</b></span>
        <span><b className="dot n" />Not studied <b className="mono">{c.fresh}</b></span>
      </div>
    </div>
  );

  if (all.length === 0) return <p className="text-muted">Nothing to learn here yet.</p>;

  if (phase === "done")
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5 enter">
        <section className="card p-6">
          <span className="eyebrow">Learn</span>
          <p className="verdict">You mastered all {all.length}</p>
          <p className="mt-3 text-muted">Every term and question in this chapter is mastered. Keep it fresh with a game, or start Learn over.</p>
          <div className="mt-5">{bar}</div>
        </section>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => { const lv: Record<string, number> = {}; setLevels(lv); persist(lv); setRound(1); correctTotal.current = 0; answeredTotal.current = 0; startRound(lv); }}>Start Learn over</button>
          <button className="btn-ghost" onClick={onBack}>Other ways to study</button>
        </div>
      </div>
    );

  if (phase === "summary")
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 enter">
        <section className="card p-6">
          <span className="eyebrow">Round {round} complete</span>
          <p className="verdict">{results.filter((r) => r.ok).length} of {results.length} right</p>
          <p className="mt-2 text-muted">{c.mastered} of {all.length} mastered so far. Answer an item right in two different rounds to master it.</p>
          <div className="mt-5">{bar}</div>
          <ul className="learn-list">
            {results.map((r) => (
              <li key={r.id}><span className={`learn-mark ${r.ok ? "ok" : "bad"}`}>{r.ok ? "✓" : "✕"}</span><span>{r.label}</span></li>
            ))}
          </ul>
        </section>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => { setRound((r) => r + 1); startRound(levels); }}>Continue to round {round + 1}</button>
          <button className="btn-ghost" onClick={onBack}>Other ways to study</button>
        </div>
      </div>
    );

  if (!cur) return <div className="card h-72 animate-pulse" />;
  const right = picked === cur.answer;
  const isTermBack = cur.kind === "definition";
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      {bar}
      <div className="sheet enter" key={cur.id + queue.length}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tag">{cur.image && cur.kind === "term" ? "Which one is this?" : cur.kind === "definition" ? `Pick the ${sideLabels(content).back.toLowerCase()}` : cur.kind === "term" ? `Which ${sideLabels(content).front.toLowerCase()} goes with this?` : "Question"}</span>
          <span className="mono text-[13px] text-muted">Round {round} · {queue.length} left</span>
        </div>
        {cur.image && <Pic src={cur.image} alt="Picture for this question" className="q-pic mt-3" />}
{cur.prompt ? <p className={`mb-4 mt-3 leading-snug ${isTermBack ? "fc-term text-[clamp(24px,5vw,34px)]" : "text-[clamp(18px,3.2vw,22px)] font-bold"}`}>{cur.prompt}</p> : <div className="mb-4" />}
        <div className="grid gap-3 sm:grid-cols-2">
          {cur.order.map((idx, n) => {
            const st = picked === null ? "" : idx === cur.answer ? "ok" : idx === picked ? "bad" : "dim";
            return (
              <button key={idx} disabled={picked !== null} onClick={() => choose(idx)} className={`opt ${st}`}>
                <span className="ob">{n + 1}</span><span className="min-w-0 flex-1">{cur.choices[idx]}</span>
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className={`fb${right ? "" : " bad"} enter`}>
            <strong>{right ? ((levels[cur.id] ?? 0) >= MASTERED ? "Mastered!" : "Correct!") : "Not quite. You'll see this one again."}</strong>
            {!right && <p className="mt-1"><span className="eyebrow">Correct answer</span><br /><b>{cur.choices[cur.answer]}</b></p>}
            {!right && cur.explanation && <p className="mt-2">{cur.explanation}</p>}
            {!right && <button className="btn mt-3" onClick={() => next()}>Continue</button>}
          </div>
        )}
      </div>
    </div>
  );
}

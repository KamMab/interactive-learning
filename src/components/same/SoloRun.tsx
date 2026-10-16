"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Combo from "../Combo";
import { VERDICT_TEXT, addSaid, choosePrompt, examples, judgeRound, makeResolver, rng, seedFor, sitePick, usedIn, type SaidLog, type SameSet, type Verdict } from "@/lib/same";

export type RunEnd = { streak: number; prompt: string; mine: string; site: string; verdict: Verdict; examples: string[] };

/** One player against the site. With a seed (a challenge code), everyone gets the same game. */
export default function SoloRun({ set, seed, onOver, label }: { set: SameSet; seed?: number; onOver: (e: RunEnd) => void; label?: string }) {
  const base = useMemo(() => seed ?? Math.floor(Math.random() * 2 ** 31), [seed]);
  const resolve = useMemo(() => makeResolver(set), [set]);
  const names = useMemo(() => set.answers.map((a) => a.name).sort((a, b) => a.localeCompare(b)), [set]);
  const [said, setSaid] = useState<SaidLog>({});
  const [asked, setAsked] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState("");
  const [reveal, setReveal] = useState<null | { mine: string; site: string; verdict: Verdict; read: string | null }>(null);
  const field = useRef<HTMLFormElement>(null);

  // This round's prompt and the site's locked-in answer (both decided before you type).
  const { pi, site } = useMemo(() => {
    const i = choosePrompt(set, round, (k) => usedIn(said, k), new Set(asked), 1, rng(seedFor(base, round, 1)));
    return { pi: i, site: i >= 0 ? sitePick(set, set.prompts[i], usedIn(said, i), rng(seedFor(base, round, 2))) : "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const p = pi >= 0 ? set.prompts[pi] : null;
  const streak = round - 1;

  useEffect(() => { if (!reveal) field.current?.querySelector("input")?.focus(); }, [round, reveal]);
  useEffect(() => { if (!p) onOver({ streak, prompt: "", mine: "", site: "", verdict: "ok", examples: [] }); }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!p || reveal) return;
    const a = resolve(typed);
    if (!a) { setMsg(typed.trim() ? `We don't know “${typed.trim()}”. Pick a ${set.noun} from the list.` : `Type a ${set.noun}.`); return; }
    setMsg("");
    const v = judgeRound(p, site, usedIn(said, pi), { me: a })["me"];
    setReveal({ mine: a, site, verdict: v, read: a.toLowerCase() !== typed.trim().toLowerCase() ? a : null });
  }
  function next() {
    if (!p || !reveal) return;
    if (reveal.verdict !== "ok") {
      onOver({ streak, prompt: p.text, mine: reveal.mine, site, verdict: reveal.verdict, examples: examples(p, usedIn(said, pi), [site, reveal.mine]) });
      return;
    }
    setSaid((l) => addSaid(l, pi, [site, reveal.mine]));
    setAsked((a) => [...a, pi]);
    setRound((r) => r + 1);
    setTyped(""); setReveal(null);
  }

  if (!p) return <div className="card p-6">You've used up every answer. That's a perfect game!</div>;
  const ok = reveal?.verdict === "ok";
  return (
    <div className="mx-auto flex game-col flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono mr-auto text-[13px] text-muted">{label ? `${label} · ` : ""}Round {round}</span>
        <span className="pill" title="How narrow the questions are">Level <b>{p.level}</b>/5</span>
        <span className="pill streak"><b>{streak}</b> streak</span>
      </div>
      <div className="sheet same-sheet enter" key={round}>
        <span className="tag">Don&apos;t say the same thing as me</span>
        <p className="same-prompt">{p.text}</p>
        {!reveal ? (
          <>
            <p className="same-lock"><span aria-hidden>🔒</span> I&apos;ve locked in my answer. Don&apos;t match it.</p>
            <form className="same-form" ref={field} onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Combo id="same-answer" value={typed} onChange={(v) => { setTyped(v); setMsg(""); }} options={names} placeholder={`Type a ${set.noun}`} />
              <button className="btn" disabled={!typed.trim()}>Lock it in</button>
            </form>
            {msg && <p className="mt-2 text-sm text-bad">{msg}</p>}
          </>
        ) : (
          <div className="enter">
            <div className="same-duel">
              <div className={`same-card ${ok ? "good" : "bad"}`}><span>You said</span><b>{reveal.mine}</b>{reveal.read && <i>(read as {reveal.read})</i>}</div>
              <div className={`same-card site ${reveal.verdict === "site" ? "bad" : ""}`}><span>I said</span><b>{reveal.site}</b></div>
            </div>
            <div className={`fb${ok ? "" : " bad"}`}>
              <strong>{ok ? "Safe!" : VERDICT_TEXT[reveal.verdict]}</strong>
              <p className="mt-1">{ok ? `Different answers, and it fits. Streak: ${streak + 1}.`
                : reveal.verdict === "site" ? "We said the same thing, so you're out."
                : reveal.verdict === "used" ? `${reveal.mine} was already said for this same question earlier in the game.`
                : `${reveal.mine} doesn't fit “${p.text}”.`}</p>
              <button className="btn mt-3" onClick={next} autoFocus>{ok ? "Next round" : "See results"}</button>
            </div>
          </div>
        )}
      </div>
      {!reveal && (said[String(pi)]?.length ?? 0) > 0 && (
        <p className="same-used">This question came up before. Already said for it (can&apos;t be used again): {[...said[String(pi)]].sort((a, b) => a.localeCompare(b)).join(" · ")}</p>
      )}
    </div>
  );
}

"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { shuffle } from "@/lib/id";
import type { MapItem } from "@/lib/types";
import Results from "./Results";
import type { GP } from "./GameHost";

type Shape = { name: string; d: string };
type MapData = { viewBox: string; shapes: Shape[]; borders: string };
const cache: Record<string, Promise<MapData>> = {};
const norm = (s: string) => s.trim().toLowerCase();
const REVEAL = "\u0000reveal";

/** Map outlines are pre-drawn files (scripts/build-maps.mjs). base lets the preview load them from elsewhere. */
export function loadMap(region: string, base = "/maps/") {
  return (cache[base + region] ??= fetch(`${base}${region}.json`).then((r) => r.json()));
}

// Map: "Click the state whose capital is Sacramento". A miss shows where it really is.
export default function MapGame({ chapter, opts, onBack, mapBase }: GP & { mapBase?: string }) {
  const set = chapter.content.map!;
  const [data, setData] = useState<MapData | null>(null);
  const [round, setRound] = useState(0);
  const items = useMemo(() => { const all = shuffle(set.items); return opts.count && opts.count > 0 ? all.slice(0, opts.count) : all; },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round]);
  const [i, setI] = useState(0);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [missedHere, setMissedHere] = useState(false);

  useEffect(() => { loadMap(set.region, mapBase).then(setData).catch(() => setData(null)); }, [set.region, mapBase]);
  const cur: MapItem | undefined = items[i];

  // Zoom to the places in play (e.g. one continent or region picked in Topics) and fade everything else.
  const inPlay = useMemo(() => new Set(set.items.map((it) => norm(it.place))), [set.items]);
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!data || !svg.current) return;
    const [fx, fy, fw, fh] = data.viewBox.split(/[\s,]+/).map(Number);
    // Each place's main landmass only, so overseas bits (French Guiana for France) don't drag the view away.
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    probe.setAttribute("visibility", "hidden");
    svg.current.appendChild(probe);
    const boxes: DOMRect[] = [];
    svg.current.querySelectorAll<SVGPathElement>("path[data-name]").forEach((el) => {
      if (!inPlay.has(norm(el.dataset.name ?? ""))) return;
      let best: DOMRect | null = null;
      for (const part of (el.getAttribute("d") ?? "").split(/(?=M)/)) {
        probe.setAttribute("d", part);
        const bb = probe.getBBox();
        if (!best || bb.width * bb.height > best.width * best.height) best = bb;
      }
      if (best) boxes.push(best);
    });
    probe.remove();
    // Shapes that wrap across the map (Russia, Fiji, Alaska's islands) would stretch the box, so leave them out.
    const use = boxes.filter((b) => b.width < fw * 0.3);
    const list = use.length ? use : boxes;
    if (!list.length) { setView(null); return; }
    let x0 = Math.min(...list.map((b) => b.x)), y0 = Math.min(...list.map((b) => b.y));
    let x1 = Math.max(...list.map((b) => b.x + b.width)), y1 = Math.max(...list.map((b) => b.y + b.height));
    if ((x1 - x0) * (y1 - y0) > fw * fh * 0.6) { setView(null); return; } // nearly everything: keep the full map
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    // Keep a sensible shape (not a sliver) and stay inside the map.
    const aspect = fw / fh;
    let w = x1 - x0, h = y1 - y0;
    if (w / h < aspect * 0.75) { const nw = h * aspect * 0.75; x0 -= (nw - w) / 2; w = nw; }
    if (w / h > aspect * 1.6) { const nh = w / (aspect * 1.6); y0 -= (nh - h) / 2; h = nh; }
    x0 = Math.max(fx, Math.min(x0, fx + fw - w)); y0 = Math.max(fy, Math.min(y0, fy + fh - h));
    setView(`${x0} ${y0} ${Math.min(w, fw)} ${Math.min(h, fh)}`);
  }, [data, inPlay]);

  function advance(gotIt: boolean) {
    const s = score + (gotIt ? 1 : 0);
    if (gotIt) setScore(s);
    setSolved((x) => new Set(x).add(norm(cur!.place)));
    setWrong(null); setMissedHere(false); setFlash(null);
    if (i + 1 >= items.length) { recordResult(chapter.id, "map", s, items.length); setDone(true); } else setI(i + 1);
  }

  function click(name: string) {
    if (!cur || done) return;
    if (wrong) return; // waiting on Continue
    if (norm(name) === norm(cur.place)) { setFlash(norm(name)); setTimeout(() => advance(!missedHere), 650); }
    else { setWrong(name); setMissedHere(true); }
  }

  if (done) return <Results title="Map" score={score} total={items.length} extra={{ value: `${items.length - score}`, label: "Missed" }} onBack={onBack}
    onReplay={() => { setRound((r) => r + 1); setI(0); setScore(0); setSolved(new Set()); setDone(false); setWrong(null); setMissedHere(false); }} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="track"><i style={{ width: `${(i / items.length) * 100}%` }} /></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono mr-auto text-[13px] text-muted">{i + 1} of {items.length}</span>
        <span className="pill"><b>{score}</b> right</span>
      </div>
      <div className="sheet !pl-6">
        <p className="text-[clamp(18px,3.2vw,22px)] font-bold leading-snug">{set.ask} <span className="text-accent">{cur?.prompt}</span></p>
        {wrong ? (
          <div className="fb bad mt-3">
            <strong>{wrong === REVEAL ? "Here it is" : <>That&apos;s {wrong}</>}</strong>
            <p className="mt-1">{cur?.place} is highlighted on the map.</p>
            <button className="btn mt-3" onClick={() => advance(false)}>Continue</button>
          </div>
        ) : <p className="note mt-1">Tap the map. <button className="linkish" onClick={() => { setMissedHere(true); setWrong(REVEAL); }}>Show me</button></p>}
      </div>
      <div className="mapbox">
        {!data ? <div className="h-72 animate-pulse" /> : (
          <svg ref={svg} viewBox={view ?? data.viewBox} role="img" aria-label="Map" className={view ? "zoomed" : ""}>
            {data.shapes.map((s) => {
              const n = norm(s.name), isCur = cur && n === norm(cur.place);
              const cls = flash === n ? "ok" : wrong && norm(wrong) === n ? "bad" : wrong && isCur ? "show" : solved.has(n) ? "done" : view && !inPlay.has(n) ? "dim" : "";
              return <path key={s.name} d={s.d} data-name={s.name} className={`mp ${cls}`} onClick={() => click(s.name)}><title>{solved.has(n) || (wrong && isCur) ? s.name : ""}</title></path>;
            })}
            <path d={data.borders} className="mp-borders" />
          </svg>
        )}
      </div>
    </div>
  );
}

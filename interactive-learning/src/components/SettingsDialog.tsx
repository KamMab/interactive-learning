"use client";
import { useEffect, useState } from "react";
import { ICON } from "./icons";
import { MODES, MODE_INFO } from "@/lib/types";
import {
  PLAYING, TIMERS, allQuarters, dayKey, fmtD, fmtDur, parseDay, quarterAgg, quarterFor, resetStudyTime, setSetting, shiftQ, store,
} from "@/lib/store";

function Bar({ v, max }: { v: number; max: number }) {
  return <span className="tbar"><i style={{ width: `${max ? Math.max(v ? 3 : 0, (v / max) * 100) : 0}%` }} /></span>;
}

// Same two tabs as Ledger Rush: Preferences (theme, quick-fire countdown) and Study time (by quarter).
export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"prefs" | "time">("prefs");
  const [qOff, setQOff] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [, force] = useState(0);
  const st = store().settings;

  useEffect(() => {
    PLAYING.paused = true;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", esc);
    return () => { PLAYING.paused = false; removeEventListener("keydown", esc); };
  }, [onClose]);

  const set = <K extends "theme" | "timer">(k: K, v: K extends "theme" ? "light" | "dark" : number) => {
    setSetting(k, v as never);
    force((x) => x + 1);
  };

  let timeView: React.ReactNode = null;
  if (tab === "time") {
    const S = store();
    const now = new Date(), q = shiftQ(quarterFor(now), qOff), A = quarterAgg(q), isCur = qOff === 0, today = S.time.days[dayKey()] || 0;
    const nWeeks = Math.ceil(((+q.end - +q.start) / 864e5 + 1) / 7);
    const weeks = Array.from({ length: nWeeks }, (_, w) => {
      const s = new Date(q.start); s.setDate(s.getDate() + w * 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      let v = 0;
      for (const [k, x] of Object.entries(A.days)) { const d = parseDay(k); if (d >= s && d <= e) v += x; }
      return { w: w + 1, s, e, v, now: isCur && now >= s && now <= new Date(e.getTime() + 864e5 - 1) };
    });
    const maxW = Math.max(60, ...weeks.map((w) => w.v));
    const chIds = Array.from(new Set([...Object.keys(S.names), ...Object.keys(A.ch)]));
    const qs = allQuarters(), qTot = (x: typeof q) => quarterAgg(x).total, qMax = Math.max(1, ...qs.map(qTot));
    timeView = (
      <>
        <div className="set">
          <div className="qnav">
            <button className="x" aria-label="Previous quarter" onClick={() => setQOff(qOff - 1)}>‹</button>
            <div className="qname"><b>{q.name}</b><span>{fmtD(q.start)} – {fmtD(q.end)}{isCur ? " · current" : ""}</span></div>
            <button className="x" aria-label="Next quarter" disabled={isCur} onClick={() => qOff < 0 && setQOff(qOff + 1)}>›</button>
          </div>
          <div className="tstats">
            <div><b>{fmtDur(A.total)}</b><span>This quarter</span></div>
            <div><b>{fmtDur(today)}</b><span>Today</span></div>
            <div><b>{fmtDur(S.time.total)}</b><span>All time</span></div>
          </div>
          <div className="tweek" style={{ gridTemplateColumns: `repeat(${nWeeks},minmax(0,1fr))` }} role="img" aria-label={`Study time by week in ${q.name}`}>
            {weeks.map((w) => (
              <div key={w.w} className={`tday${w.now ? " today" : ""}`} title={`Week ${w.w} (${fmtD(w.s)}–${fmtD(w.e)}): ${fmtDur(w.v)}`}>
                <span className="tcol"><i style={{ height: `${(w.v / maxW) * 100}%` }} /></span><span className="tlbl">{w.w}</span>
              </div>
            ))}
          </div>
          <p className="note">
            Weeks of the quarter.{" "}
            {weeks.some((w) => w.v)
              ? `Busiest: week ${weeks.reduce((a, b) => (b.v > a.v ? b : a)).w} (${fmtDur(Math.max(...weeks.map((w) => w.v)))}).`
              : "No study time yet this quarter."}
          </p>
        </div>
        <div className="set">
          <h3>By chapter · {q.name}</h3>
          {chIds.length === 0 && <p className="note">Play any chapter and it shows up here.</p>}
          {chIds.map((id) => {
            const c = A.ch[id] || { total: 0, modes: {} };
            const modes = MODES.map((k) => [k, c.modes[k] || 0] as const).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
            const mMax = Math.max(1, ...modes.map((x) => x[1]));
            return (
              <div key={id} className="tch">
                <div className="tch-h"><span>{S.names[id] ?? "Chapter"}</span><b className="mono">{fmtDur(c.total)}</b></div>
                {c.total ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="eyebrow">By mode</span>
                    {modes.map(([k, v]) => <div key={k} className="trow"><span>{MODE_INFO[k].name}</span><Bar v={v} max={mMax} /><span className="mono">{fmtDur(v)}</span></div>)}
                  </div>
                ) : <p className="note">No study time in {q.name}.</p>}
              </div>
            );
          })}
        </div>
        <div className="set">
          <h3>All quarters</h3>
          {qs.map((x) => {
            const t = qTot(x);
            return (
              <button key={x.key} className={`trow${x.key === q.key ? " sel" : ""}`}
                onClick={() => { const cur = quarterFor(new Date()); let o = 0, y = cur; while (y.key !== x.key && o > -40) { o--; y = shiftQ(cur, o); } setQOff(o); }}>
                <span>{x.name}</span><Bar v={t} max={qMax} /><span className="mono">{fmtDur(t)}</span>
              </button>
            );
          })}
        </div>
        <p className="note">Time counts only while a question, card or match board is on screen and you&apos;ve been active in the last 2 minutes. Quarter dates are approximate UCLA dates. Saved in this browser.</p>
        <p className="note">
          {confirmReset ? (
            <>Erase all study time? <button className="linkish" onClick={() => { resetStudyTime(); setConfirmReset(false); setQOff(0); }}>Yes, reset</button> · <button className="linkish" onClick={() => setConfirmReset(false)}>Cancel</button></>
          ) : <button className="linkish" onClick={() => setConfirmReset(true)}>Reset study time</button>}
        </p>
      </>
    );
  }

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="set-h">
        <div className="dialog-h"><h2 id="set-h">Settings</h2><button className="x" aria-label="Close settings" onClick={onClose}>{ICON.close}</button></div>
        <div className="seg" role="group" aria-label="Settings section">
          <button aria-pressed={tab === "prefs"} onClick={() => setTab("prefs")}>Preferences</button>
          <button aria-pressed={tab === "time"} onClick={() => setTab("time")}>{ICON.clock}Study time</button>
        </div>
        {tab === "time" ? timeView : (
          <>
            <div className="set">
              <h3>Appearance</h3>
              <div className="seg" role="group" aria-label="Theme">
                <button aria-pressed={st.theme === "light"} onClick={() => set("theme", "light")}>{ICON.sun}Light</button>
                <button aria-pressed={st.theme === "dark"} onClick={() => set("theme", "dark")}>{ICON.moon}Dark</button>
              </div>
            </div>
            <div className="set">
              <h3>Quick-fire countdown</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Seconds per question">
                {TIMERS.map((t) => <button key={t} className="chip" aria-pressed={st.timer === t} onClick={() => set("timer", t)}>{t ? t + "s" : "Off"}</button>)}
              </div>
              <p className="note">
                {st.timer
                  ? `You get ${st.timer} seconds per question for a speed bonus. Answer faster for a bigger bonus. If time runs out you just lose the bonus, and you can keep working on the question.`
                  : "No clock and no speed bonus. Take as long as you need."}
              </p>
            </div>
          </>
        )}
        <button className="btn" onClick={onClose} autoFocus>Done</button>
      </div>
    </div>
  );
}

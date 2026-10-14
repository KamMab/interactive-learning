"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult } from "@/lib/progress";
import { store } from "@/lib/store";
import { shuffle } from "@/lib/id";
import Results from "./Results";
import type { GP } from "./GameHost";
import Combo from "../Combo";

const take = <T,>(arr: T[], n?: number) => (n && n > 0 ? arr.slice(0, n) : arr);

export default function Entries({ chapter, opts, onBack }: GP) {
  const { content, settings } = chapter;
  type Row = { account: string; debit: string; credit: string };
  const blank = (): Row => ({ account: "", debit: "", credit: "" });
  const norm = (s: string) => s.trim().toLowerCase();
  const [round, setRound] = useState(0);
  const entries = useMemo(() => take(settings.shuffle ? shuffle(content.entries) : content.entries, opts.count), [round]);
  const accounts = useMemo(() => Array.from(new Set(content.entries.flatMap(e => e.lines.map(l => l.account)))).sort(), []);
  const [i, setI] = useState(0), [rows, setRows] = useState<Row[]>([blank(), blank()]), [checked, setChecked] = useState<boolean | null>(null), [score, setScore] = useState(0), [done, setDone] = useState(false);
  const entry = entries[i];
  function check() {
    const mine = rows.filter(r => r.account && (r.debit || r.credit)).map(r => `${norm(r.account)}|${Number(r.debit || 0)}|${Number(r.credit || 0)}`).sort();
    const key = entry.lines.map(l => `${norm(l.account)}|${l.debit || 0}|${l.credit || 0}`).sort();
    const ok = mine.length === key.length && mine.every((m, idx) => m === key[idx]);
    setChecked(ok); if (ok) setScore(s => s + 1);
  }
  const next = () => { if (i + 1 >= entries.length) { recordResult(chapter.id, "entries", score, entries.length); setDone(true); } else { setI(i + 1); setRows([blank(), blank()]); setChecked(null); } };
  const set = (idx: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => j === idx ? { ...r, ...patch } : r));
  const dr = rows.reduce((s, r) => s + Number(r.debit || 0), 0), cr = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
  if (done) return <Results title="Journal Entries" score={score} total={entries.length} onBack={onBack} onReplay={() => { setRound(r => r + 1); setI(0); setScore(0); setRows([blank(), blank()]); setChecked(null); setDone(false); }} />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="track"><i style={{ width: `${(i + (checked !== null ? 1 : 0)) / entries.length * 100}%` }} /></div>
      <span className="mono text-[13px] text-muted">Entry {i + 1} of {entries.length}</span>
      <div className="sheet enter" key={entry.id}>
        <span className="tag">Journal entry</span>
        <p className="mb-4 mt-3 text-[17px] leading-relaxed">{entry.scenario}</p>
        <div className="je-wrap">
          <table className="je">
            <thead><tr><th>Account</th><th className="amt">Debit</th><th className="amt">Credit</th><th style={{ width: 32 }} /></tr></thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ paddingLeft: r.credit ? 28 : 8 }}><Combo id={`acct-${idx}`} options={accounts} placeholder="Start typing an account" value={r.account} disabled={checked !== null} onChange={v => set(idx, { account: v })} /></td>
                  <td className="amt"><input id={`dr-${idx}`} inputMode="decimal" className="input mono text-right" value={r.debit} disabled={checked !== null} onChange={e => set(idx, { debit: e.target.value.replace(/[^0-9.]/g, ""), credit: "" })} /></td>
                  <td className="amt"><input id={`cr-${idx}`} inputMode="decimal" className="input mono text-right" value={r.credit} disabled={checked !== null} onChange={e => set(idx, { credit: e.target.value.replace(/[^0-9.]/g, ""), debit: "" })} /></td>
                  <td>{rows.length > 1 && checked === null && <button className="x" aria-label="Remove line" onClick={() => setRows(rows.filter((_, j) => j !== idx))}>×</button>}</td>
                </tr>))}
              <tr>
                <td>{checked === null && <button className="link" onClick={() => setRows([...rows, blank()])}>+ Add line</button>}</td>
                <td className="amt mono text-muted">{dr.toLocaleString()}</td><td className="amt mono text-muted">{cr.toLocaleString()}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
        {checked === null ? <button className="btn mt-4" onClick={check}>Check entry</button> : (
          <div className={`fb${checked ? "" : " bad"} enter`}>
            <strong>{checked ? "Posted correctly" : "Not quite"}</strong>
            {!checked && <ul className="mono mt-2 list-none p-0 text-sm">{entry.lines.map((l, idx) => <li key={idx} style={{ paddingLeft: l.credit ? 24 : 0 }}>{l.credit ? "Cr" : "Dr"} {l.account} {(l.debit || l.credit).toLocaleString()}</li>)}</ul>}
            {settings.showExplanations && <p className="mt-2">{entry.explanation}</p>}
            <button className="btn mt-3" onClick={next}>{i + 1 >= entries.length ? "See results" : "Next entry"}</button>
          </div>)}
      </div>
    </div>);
}


"use client";
import { useEffect, useRef, useState } from "react";

// Present/future value factor tables students can open while answering (for chapters with tools: ["interest-tables"]).
// A floating "Tables" button opens a panel: pick a table, tap a rate and a period, read the factor.
type Data = { rates: number[]; periods: number[]; tables: { id: string; title: string; short: string; rows: number[][] }[] };
let cache: Promise<Data> | null = null;
const load = () => (cache ??= fetch("/tables/interest.json").then((r) => r.json()));

const FORMULA: Record<string, string> = {
  t1: "FV = $1 × (1 + i)ⁿ",
  t2: "PV = $1 ÷ (1 + i)ⁿ",
  t3: "FVA = [(1 + i)ⁿ − 1] ÷ i",
  t4: "PVA = [1 − 1 ÷ (1 + i)ⁿ] ÷ i",
  t5: "FVAD = FVA × (1 + i)",
  t6: "PVAD = PVA × (1 + i)",
};
const USE: Record<string, string> = {
  t1: "One amount today → its value later.",
  t2: "One amount later → its value today (e.g. a bond's face value).",
  t3: "Equal payments at the end of each period → value later.",
  t4: "Equal payments at the end of each period → value today (e.g. a bond's interest payments).",
  t5: "Equal payments at the start of each period → value later.",
  t6: "Equal payments at the start of each period → value today.",
};
// Same decimals as the printed tables: 4 for the future-value annuity tables, 5 for the rest.
const DP: Record<string, number> = { t3: 4, t5: 4 };
const fmtIn = (tab: string) => (v: number) => v.toFixed(DP[tab] ?? 5);
const pct = (r: number) => `${r}%`;

export default function InterestTables() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("t2");
  const [rate, setRate] = useState(5);
  const [n, setN] = useState(10);
  const grid = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    load().then(setData).catch(() => { cache = null; setFailed(true); });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", esc);
    panel.current?.focus();
    document.body.classList.add("it-open"); // wide screens: the page slides over so the question stays visible
    return () => { removeEventListener("keydown", esc); document.body.classList.remove("it-open"); };
  }, [open]);

  // Keep the picked cell in view when the table, rate or period changes.
  useEffect(() => {
    const cell = grid.current?.querySelector<HTMLElement>("td.it-hit");
    if (!cell || !grid.current) return;
    const g = grid.current, head = 34, side = 48;
    const top = cell.offsetTop - head - 8, left = cell.offsetLeft - side - 8;
    if (top < g.scrollTop || top + cell.offsetHeight + head + 16 > g.scrollTop + g.clientHeight) g.scrollTop = Math.max(0, top - g.clientHeight / 3);
    if (left < g.scrollLeft || left + cell.offsetWidth + side + 16 > g.scrollLeft + g.clientWidth) g.scrollLeft = Math.max(0, left - g.clientWidth / 3);
  }, [tab, rate, n, data]);

  const t = data?.tables.find((x) => x.id === tab);
  const ri = data ? data.rates.indexOf(rate) : -1;
  const row = t?.rows.find((r) => r[0] === n);
  const factor = row && ri >= 0 ? row[ri + 1] : null;
  const fmt = fmtIn(tab);

  return (
    <>
      <button type="button" className="it-fab" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
        Interest tables
      </button>
      {open && (
        <div className="it-wrap">
          <div ref={panel} className="it-panel" role="dialog" aria-modal="false" aria-label="Interest tables" tabIndex={-1}>
            <div className="it-head">
              <div className="min-w-0">
                <span className="eyebrow">Present and future value tables</span>
                <h2 className="text-[19px] font-bold leading-tight">{t?.title.replace(/^Table \d: /, "") ?? "Interest tables"}</h2>
              </div>
              <button type="button" className="it-x" onClick={() => setOpen(false)} aria-label="Close tables">✕</button>
            </div>

            <div className="it-tabs" role="tablist">
              {(data?.tables ?? []).map((x, i) => (
                <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
                  <b>{i + 1}</b>{x.short}
                </button>
              ))}
            </div>

            {failed ? <p className="fb bad m-4">The tables didn&apos;t load. Check your connection and open them again.</p> : !data || !t ? <div className="m-4 h-64 animate-pulse rounded-xl bg-[var(--surface-2)]" /> : (
              <>
                <div className="it-look">
                  <label>Rate (i)
                    <select className="input" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                      {data.rates.map((r) => <option key={r} value={r}>{pct(r)}</option>)}
                    </select>
                  </label>
                  <label>Periods (n)
                    <select className="input" value={n} onChange={(e) => setN(Number(e.target.value))}>
                      {data.periods.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <div className="it-factor" aria-live="polite">
                    <span>Factor</span>
                    <b className="mono">{factor != null ? fmt(factor) : "—"}</b>
                  </div>
                </div>
                <p className="it-note"><span className="mono">{FORMULA[tab]}</span> · {USE[tab]} Semiannual payments: halve the annual rate and double the years.</p>
                <div ref={grid} className="it-grid" tabIndex={0} aria-label={`${t.title}. Tap a cell to pick it.`}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col" className="it-corner">n \ i</th>
                        {data.rates.map((r) => <th key={r} scope="col" className={r === rate ? "on" : ""}><button type="button" onClick={() => setRate(r)}>{pct(r)}</button></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((r) => (
                        <tr key={r[0]} className={r[0] === n ? "on" : ""}>
                          <th scope="row"><button type="button" onClick={() => setN(r[0])}>{r[0]}</button></th>
                          {r.slice(1).map((v, i) => {
                            const hit = r[0] === n && data.rates[i] === rate;
                            return (
                              <td key={i} className={`${hit ? "it-hit" : ""}${data.rates[i] === rate ? " col" : ""}`} onClick={() => { setN(r[0]); setRate(data.rates[i]); }}>
                                {fmt(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

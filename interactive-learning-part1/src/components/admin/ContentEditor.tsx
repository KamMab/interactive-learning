"use client";
import { useState } from "react";
import { uid } from "@/lib/id";
import type { ChapterContent, EntryLine, JournalEntry, MapSet, Question, Term } from "@/lib/types";
import { MAP_NAMES } from "@/lib/map-names";

type Tab = "terms" | "questions" | "entries" | "map";

export default function ContentEditor({ content, onChange }: { content: ChapterContent; onChange: (c: ChapterContent) => void }) {
  const [tab, setTab] = useState<Tab>("terms");

  const update = <K extends Tab>(key: K, list: ChapterContent[K]) => onChange({ ...content, [key]: list });

  return (
    <div>
      <div className="flex gap-1 border-b border-line">
        {(["terms", "questions", "entries", "map"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-accent text-accent" : "border-transparent text-muted"}`}>
            {t === "entries" ? "Journal entries" : t} ({t === "map" ? content.map?.items.length ?? 0 : content[t].length})
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "terms" && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Card front is called</label><input className="input" placeholder="Term" value={content.labels?.front ?? ""}
              onChange={(e) => onChange({ ...content, labels: { front: e.target.value, back: content.labels?.back ?? "Definition" } })} /></div>
            <div><label className="label">Card back is called</label><input className="input" placeholder="Definition" value={content.labels?.back ?? ""}
              onChange={(e) => onChange({ ...content, labels: { front: content.labels?.front ?? "Term", back: e.target.value } })} /></div>
          </div>
        )}
        {tab === "terms" && <Terms items={content.terms} onChange={(l) => update("terms", l)} />}
        {tab === "map" && <MapEditor map={content.map ?? null} onChange={(m) => onChange({ ...content, map: m })} />}
        {tab === "questions" && <Questions items={content.questions} onChange={(l) => update("questions", l)} />}
        {tab === "entries" && <Entries items={content.entries} onChange={(l) => update("entries", l)} />}
      </div>
    </div>
  );
}

function listOps<T extends { id: string }>(items: T[], onChange: (l: T[]) => void) {
  return {
    set: (id: string, patch: Partial<T>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    remove: (id: string) => onChange(items.filter((x) => x.id !== id)),
    add: (item: T) => onChange([...items, item]),
  };
}

function Terms({ items, onChange }: { items: Term[]; onChange: (l: Term[]) => void }) {
  const ops = listOps(items, onChange);
  return (
    <div className="grid gap-2">
      {items.map((t) => (
        <div key={t.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input className="input font-medium" value={t.term} onChange={(e) => ops.set(t.id, { term: e.target.value })} placeholder="Term" />
          <textarea className="input" rows={1} value={t.definition} onChange={(e) => ops.set(t.id, { definition: e.target.value })} placeholder="Definition" />
          <button className="text-muted hover:text-bad" onClick={() => ops.remove(t.id)} aria-label="Delete">×</button>
        </div>
      ))}
      <button className="btn-ghost justify-self-start text-sm" onClick={() => ops.add({ id: uid(), term: "", definition: "" })}>+ Add term</button>
    </div>
  );
}

function Questions({ items, onChange }: { items: Question[]; onChange: (l: Question[]) => void }) {
  const ops = listOps(items, onChange);
  return (
    <div className="grid gap-4">
      {items.map((q, n) => (
        <div key={q.id} className="rounded-xl border border-line p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2 text-sm font-semibold text-muted">{n + 1}.</span>
            <textarea className="input" rows={2} value={q.prompt} onChange={(e) => ops.set(q.id, { prompt: e.target.value })} placeholder="Question" />
            <button className="mt-2 text-muted hover:text-bad" onClick={() => ops.remove(q.id)} aria-label="Delete">×</button>
          </div>
          <div className="mt-3 grid gap-2 pl-6">
            {q.choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name={`ans-${q.id}`} checked={q.answer === i} onChange={() => ops.set(q.id, { answer: i })} title="Correct answer" />
                <input className="input" value={c} onChange={(e) => ops.set(q.id, { choices: q.choices.map((x, j) => (j === i ? e.target.value : x)) })} />
                {q.choices.length > 2 && (
                  <button className="text-muted hover:text-bad" onClick={() => ops.set(q.id, {
                    choices: q.choices.filter((_, j) => j !== i),
                    answer: q.answer === i ? 0 : q.answer > i ? q.answer - 1 : q.answer,
                  })}>×</button>
                )}
              </div>
            ))}
            {q.choices.length < 6 && (
              <button className="justify-self-start text-sm text-accent" onClick={() => ops.set(q.id, { choices: [...q.choices, ""] })}>+ Choice</button>
            )}
            <textarea className="input text-sm" rows={2} value={q.explanation} onChange={(e) => ops.set(q.id, { explanation: e.target.value })} placeholder="Explanation" />
          </div>
        </div>
      ))}
      <button className="btn-ghost justify-self-start text-sm"
        onClick={() => ops.add({ id: uid(), prompt: "", choices: ["", "", "", ""], answer: 0, explanation: "" })}>+ Add question</button>
    </div>
  );
}

function Entries({ items, onChange }: { items: JournalEntry[]; onChange: (l: JournalEntry[]) => void }) {
  const ops = listOps(items, onChange);
  const setLine = (e: JournalEntry, i: number, patch: Partial<EntryLine>) =>
    ops.set(e.id, { lines: e.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className="grid gap-4">
      {items.map((e) => {
        const dr = e.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        const cr = e.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
        return (
          <div key={e.id} className="rounded-xl border border-line p-4">
            <div className="flex gap-2">
              <textarea className="input" rows={2} value={e.scenario} onChange={(ev) => ops.set(e.id, { scenario: ev.target.value })} placeholder="Scenario" />
              <button className="text-muted hover:text-bad" onClick={() => ops.remove(e.id)} aria-label="Delete">×</button>
            </div>
            <div className="mt-3 grid gap-2">
              {e.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_110px_auto] gap-2">
                  <input className="input" value={l.account} onChange={(ev) => setLine(e, i, { account: ev.target.value })} placeholder="Account" />
                  <input className="input text-right" type="number" value={l.debit || ""} onChange={(ev) => setLine(e, i, { debit: Number(ev.target.value), credit: 0 })} placeholder="Debit" />
                  <input className="input text-right" type="number" value={l.credit || ""} onChange={(ev) => setLine(e, i, { credit: Number(ev.target.value), debit: 0 })} placeholder="Credit" />
                  <button className="text-muted hover:text-bad" onClick={() => ops.set(e.id, { lines: e.lines.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <button className="text-accent" onClick={() => ops.set(e.id, { lines: [...e.lines, { account: "", debit: 0, credit: 0 }] })}>+ Line</button>
                <span className={dr === cr ? "text-muted" : "font-medium text-bad"}>Dr {dr.toLocaleString()} · Cr {cr.toLocaleString()}{dr !== cr && " · doesn't balance"}</span>
              </div>
              <textarea className="input text-sm" rows={2} value={e.explanation} onChange={(ev) => ops.set(e.id, { explanation: ev.target.value })} placeholder="Explanation" />
            </div>
          </div>
        );
      })}
      <button className="btn-ghost justify-self-start text-sm"
        onClick={() => ops.add({ id: uid(), scenario: "", explanation: "", lines: [{ account: "", debit: 0, credit: 0 }, { account: "", debit: 0, credit: 0 }] })}>
        + Add journal entry
      </button>
    </div>
  );
}

function MapEditor({ map, onChange }: { map: MapSet | null; onChange: (m: MapSet | null) => void }) {
  const m: MapSet = map ?? { region: "us-states", ask: "Find", items: [] };
  const names = MAP_NAMES[m.region] as readonly string[];
  const set = (patch: Partial<MapSet>) => onChange({ ...m, ...patch });
  return (
    <div className="grid gap-3">
      <p className="note">Map mode: students click the right state or country. Leave empty for subjects that aren&apos;t geography.</p>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div><label className="label">Map</label>
          <select className="input" value={m.region} onChange={(e) => set({ region: e.target.value as MapSet["region"], items: [] })}>
            <option value="us-states">US states</option><option value="world">World countries</option>
          </select></div>
        <div><label className="label">Instruction</label><input className="input" value={m.ask} onChange={(e) => set({ ask: e.target.value })} placeholder="Click the state whose capital is" /></div>
      </div>
      <datalist id="map-places">{names.map((n) => <option key={n} value={n} />)}</datalist>
      {m.items.map((it) => (
        <div key={it.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input className="input" value={it.prompt} placeholder="Shown to students (Sacramento)" onChange={(e) => set({ items: m.items.map((x) => x.id === it.id ? { ...x, prompt: e.target.value } : x) })} />
          <input className="input" list="map-places" value={it.place} placeholder="Place on the map (California)" onChange={(e) => set({ items: m.items.map((x) => x.id === it.id ? { ...x, place: e.target.value } : x) })} />
          <button className="text-muted hover:text-bad" onClick={() => set({ items: m.items.filter((x) => x.id !== it.id) })} aria-label="Delete">×</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button className="btn-ghost justify-self-start text-sm" onClick={() => set({ items: [...m.items, { id: uid(), place: "", prompt: "" }] })}>+ Add place</button>
        {m.items.length > 0 && <button className="text-sm text-muted underline" onClick={() => onChange(null)}>Remove map</button>}
      </div>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { searchItems, type SearchItem } from "@/lib/search";

const SearchIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
const TermIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="14" height="14" rx="2.5" /><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17" /></svg>
);
const PersonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
);
const GROUPS: Record<SearchItem["kind"], string> = { course: "Courses", professor: "Professors", person: "Students", chapter: "Sets & chapters", term: "Terms" };

function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "ig"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

// Header search across every published course, chapter and key term.
export default function SearchBar() {
  const router = useRouter();
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = () => {
    if (items) return;
    fetch("/api/search-index").then((r) => r.json()).then(setItems).catch(() => setItems([]));
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); input.current?.focus(); }
    };
    const click = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    addEventListener("keydown", key); addEventListener("mousedown", click);
    return () => { removeEventListener("keydown", key); removeEventListener("mousedown", click); };
  }, []);

  const ORDER = { course: 0, professor: 1, chapter: 2, person: 3, term: 4 };
  // Best matches first, then shown grouped by type so each heading appears once.
  const results = items ? searchItems(items, q).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]) : [];
  const go = (it: SearchItem) => { setOpen(false); setQ(""); input.current?.blur(); router.push(it.href); };

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
  }

  let lastKind = "";
  return (
    <div className="search" ref={box}>
      <label className="search-box">
        {SearchIcon}
        <input
          ref={input}
          id="site-search"
          type="search"
          placeholder="Search courses, professors, terms"
          aria-label="Search courses, professors, chapters and terms"
          autoComplete="off"
          value={q}
          onFocus={() => { load(); setOpen(true); }}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); load(); }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open && !!q.trim()}
          aria-controls="search-results"
        />
        {!q && <kbd>/</kbd>}
      </label>
      {open && q.trim() && (
        <div className="search-pop" id="search-results" role="listbox">
          {items === null && <p className="search-empty">Loading…</p>}
          {items !== null && results.length === 0 && <p className="search-empty">Nothing matches “{q.trim()}”. Try a course code like MATH 1 or a term.</p>}
          {results.map((it, i) => {
            const header = it.kind !== lastKind ? <div className="search-group">{GROUPS[it.kind]}</div> : null;
            lastKind = it.kind;
            return (
              <div key={it.kind + it.href + it.label}>
                {header}
                <button className="search-item" role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <span className={`search-ic${it.kind === "course" ? " code" : ""}`}>{it.kind === "term" ? TermIcon : it.kind === "professor" || it.kind === "person" ? PersonIcon : it.badge}</span>
                  <span className="search-txt"><b><Highlight text={it.label} query={q} /></b><span>{it.sub}</span></span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

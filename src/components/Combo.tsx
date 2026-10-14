"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A text box with a themed suggestion list (replaces the browser's plain datalist).
 * Typing filters the list; arrow keys move, Enter picks, Esc closes. Free text is still allowed.
 */
export default function Combo({ id, value, onChange, options, placeholder, disabled, className = "" }: {
  id?: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; disabled?: boolean; className?: string;
}) {
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const box = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  const q = value.trim().toLowerCase();
  const shown = (q ? [
    ...options.filter((o) => o.toLowerCase().startsWith(q)),
    ...options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q)),
  ] : options).filter((o) => o.toLowerCase() !== q).slice(0, 50);

  // Drawn in a portal at a fixed position so the list isn't cut off by scrolling tables; flips above when there's no room below.
  const place = () => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const up = innerHeight - r.bottom < 220 && r.top > innerHeight - r.bottom;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, 220), up });
  };
  useLayoutEffect(() => { if (open) place(); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (e.target !== box.current) setOpen(false); };
    addEventListener("mousedown", close); addEventListener("scroll", place, true); addEventListener("resize", place);
    return () => { removeEventListener("mousedown", close); removeEventListener("scroll", place, true); removeEventListener("resize", place); };
  }, [open]);

  const pick = (o: string) => { onChange(o); setOpen(false); box.current?.focus(); };
  const mark = (o: string) => {
    const at = q ? o.toLowerCase().indexOf(q) : -1;
    return at < 0 ? o : <>{o.slice(0, at)}<b>{o.slice(at, at + q.length)}</b>{o.slice(at + q.length)}</>;
  };

  return (
    <div className="combo">
      <input ref={box} id={id} className={`input ${className}`} value={value} placeholder={placeholder} disabled={disabled} autoComplete="off"
        role="combobox" aria-expanded={open && shown.length > 0} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, shown.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          else if (e.key === "Enter" && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
          else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
        }} />
      {open && !disabled && shown.length > 0 && pos && createPortal(
        <ul id={listId} role="listbox" className="combo-list"
          style={{ left: pos.left, width: pos.width, ...(pos.up ? { bottom: innerHeight - pos.top } : { top: pos.top }) }}>
          {shown.map((o, k) => (
            <li key={o} id={`${listId}-${k}`} role="option" aria-selected={k === active}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(k)}>
              {mark(o)}
            </li>
          ))}
        </ul>, document.body
      )}
    </div>
  );
}

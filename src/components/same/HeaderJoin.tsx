"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cleanCode } from "@/lib/same";

/** "Join game" in the top bar: type a live game code (like ioq-13b) from anywhere on the site. */
export default function HeaderJoin() {
  const [open, setOpen] = useState(false), [code, setCode] = useState(""), [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("mousedown", close); addEventListener("keydown", esc);
    return () => { removeEventListener("mousedown", close); removeEventListener("keydown", esc); };
  }, [open]);
  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = cleanCode(code);
    if (!c) { setErr("Codes have 6 characters, like ioq-13b."); return; }
    setOpen(false); setCode(""); setErr("");
    router.push(`/play/${c}`);
  }
  return (
    <div className="hjoin" ref={box}>
      <button type="button" className="gear join" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
        <span className="gl">Join game</span><span className="sm-only">Join</span>
      </button>
      {open && (
        <form className="hjoin-pop" onSubmit={go} role="dialog" aria-label="Join a game">
          <label htmlFor="hjoin-code" className="eyebrow">Enter game code</label>
          <div className="flex gap-2">
            <input id="hjoin-code" ref={input} className="input mono hjoin-in" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }}
              placeholder="abc-12d" autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={9} />
            <button className="btn">Join</button>
          </div>
          {err ? <p className="text-sm text-bad">{err}</p> : <p className="note">Your host or teacher has the code.</p>}
        </form>
      )}
    </div>
  );
}

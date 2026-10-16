"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cleanCode } from "@/lib/same";

/** "Got a code?" box: join a live game or a challenge, Kahoot-style. */
export default function JoinBox({ big = false }: { big?: boolean }) {
  const [code, setCode] = useState(""), [err, setErr] = useState("");
  const router = useRouter();
  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = cleanCode(code);
    if (!c) { setErr("Codes have 6 characters, like ioq-13b."); return; }
    router.push(`/play/${c}`);
  }
  return (
    <form onSubmit={go} className={`join-box${big ? " big" : ""}`}>
      <div className="min-w-0">
        <span className="eyebrow">Join a game</span>
        <p className="join-sub">Got a code from a friend or your class? Type it here.</p>
      </div>
      <div className="join-row">
        <input className="input mono join-in" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} placeholder="abc-12d"
          aria-label="Game code" autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={9} />
        <button className="btn">Join</button>
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
    </form>
  );
}

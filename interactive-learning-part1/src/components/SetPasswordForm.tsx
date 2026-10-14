"use client";
import Link from "next/link";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";

export default function SetPasswordForm() {
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    setBusy(true); setErr("");
    const { error } = await browserSupabase()!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr(/different from the old/i.test(error.message) ? "That's already your password." : error.message);
    else setDone(true);
  }

  if (done) return (
    <div className="card flex flex-col gap-4 p-[22px]">
      <p className="fb mt-0"><strong>Password saved</strong><br />Next time, sign in with your email and this password.</p>
      <Link href="/" className="btn self-start">Go home</Link>
    </div>
  );
  return (
    <form onSubmit={save} className="card flex flex-col gap-3 p-[22px]">
      <label className="label" htmlFor="np">New password</label>
      <input id="np" type="password" className="input" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} required minLength={8} autoFocus />
      <label className="label" htmlFor="np2">Type it again</label>
      <input id="np2" type="password" className="input" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }} required />
      {err && <p className="text-sm text-bad">{err}</p>}
      <button className="btn big" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
    </form>
  );
}

"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";

// Any email works: Google, or a one-time sign-in link sent by email.
export default function SignInForm({ next }: { next: string }) {
  const sb = browserSupabase();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const redirectTo = () => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    await sb?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo(), queryParams: { prompt: "select_account" } } });
  }

  async function emailLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setState("error"); setMsg("Enter a full email address, like name@example.com."); return; }
    setState("sending");
    const { error } = await sb!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    if (error) { setState("error"); setMsg(error.message); }
    else setState("sent");
  }

  if (!sb) return null;
  return (
    <div className="card flex flex-col gap-5 p-[22px]">
      {state === "sent" ? (
        <p className="fb"><strong>Check your inbox</strong><br />We sent a sign-in link to {email.trim()}. Open it on this device.</p>
      ) : (
        <form onSubmit={emailLink} className="flex flex-col gap-3">
          <label className="label" htmlFor="si-email">Email</label>
          <input id="si-email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setState("idle"); }} required />
          {state === "error" && <p className="text-sm text-bad">{msg}</p>}
          <button className="btn big" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
        </form>
      )}
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <button className="btn-ghost" onClick={google}>Continue with Google</button>
    </div>
  );
}

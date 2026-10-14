"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";

type Step = "email" | "password" | "create";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Email first, then a password (or a new account). Email links and Google still work as fallbacks.
export default function SignInForm({ next }: { next: string }) {
  const sb = browserSupabase();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [sent, setSent] = useState("");
  const redirectTo = (to = next) => `${location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const addr = email.trim();
  const go = () => { location.href = next; };
  const fail = (m: string) => { setErr(m); setBusy(false); };

  if (!sb) return null;

  function toPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(addr)) return setErr("Enter a full email address, like name@example.com.");
    setErr(""); setStep("password");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await sb!.auth.signInWithPassword({ email: addr, password: pw });
    if (!error) return go();
    if (/confirm/i.test(error.message)) return fail("Confirm your email first: open the link we sent when you made your account.");
    if (/invalid/i.test(error.message)) return fail("That password didn't match. If you've only used email links before, choose \"Forgot or never set a password?\" below.");
    fail(error.message);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    setBusy(true); setErr("");
    const { data, error } = await sb!.auth.signUp({ email: addr, password: pw, options: { emailRedirectTo: redirectTo() } });
    if (error) return fail(error.message);
    if (data.user && data.user.identities?.length === 0) return fail("This email already has an account. Sign in instead, or reset the password.");
    if (data.session) return go();
    setBusy(false); setSent(`We sent a link to ${addr} to confirm your account. Open it, then sign in with your password.`);
  }

  async function link() {
    setBusy(true); setErr("");
    const { error } = await sb!.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo() } });
    if (error) return fail(error.message);
    setBusy(false); setSent(`We sent a sign-in link to ${addr}. Open it on this device.`);
  }

  async function reset() {
    setBusy(true); setErr("");
    const { error } = await sb!.auth.resetPasswordForEmail(addr, { redirectTo: redirectTo("/account/password") });
    if (error) return fail(error.message);
    setBusy(false); setSent(`We sent a link to ${addr}. Open it on this device to choose a password.`);
  }

  async function google() {
    await sb!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo(), queryParams: { prompt: "select_account" } } });
  }

  const back = () => { setStep("email"); setPw(""); setPw2(""); setErr(""); setSent(""); };
  return (
    <div className="card flex flex-col gap-5 p-[22px]">
      {sent ? (
        <div className="flex flex-col gap-3">
          <p className="fb mt-0"><strong>Check your inbox</strong><br />{sent}</p>
          <button type="button" className="link self-start" onClick={back}>Use a different email</button>
        </div>
      ) : step === "email" ? (
        <form onSubmit={toPassword} className="flex flex-col gap-3">
          <label className="label" htmlFor="si-email">Email</label>
          <input id="si-email" type="email" autoComplete="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} required autoFocus />
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn big">Continue</button>
        </form>
      ) : (
        <form onSubmit={step === "create" ? create : signIn} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate"><span className="text-muted">{step === "create" ? "New account for " : "Signing in as "}</span><b>{addr}</b></span>
            <button type="button" className="link flex-none" onClick={back}>Change</button>
          </div>
          <label className="label" htmlFor="si-pw">{step === "create" ? "Choose a password" : "Password"}</label>
          <input id="si-pw" type="password" className="input" autoComplete={step === "create" ? "new-password" : "current-password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} required autoFocus minLength={step === "create" ? 8 : undefined} />
          {step === "create" && (
            <>
              <label className="label" htmlFor="si-pw2">Type it again</label>
              <input id="si-pw2" type="password" className="input" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }} required />
            </>
          )}
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn big" disabled={busy}>{busy ? "One moment…" : step === "create" ? "Create account" : "Sign in"}</button>
          <div className="flex flex-col gap-2 pt-1 text-sm">
            {step === "password"
              ? <p className="text-muted">New here? <button type="button" className="underline text-ink" onClick={() => { setStep("create"); setErr(""); }}>Create an account</button></p>
              : <p className="text-muted">Already have an account? <button type="button" className="underline text-ink" onClick={() => { setStep("password"); setErr(""); }}>Sign in</button></p>}
            <p className="text-muted">
              <button type="button" className="underline" disabled={busy} onClick={reset}>Forgot or never set a password?</button>
              {" · "}
              <button type="button" className="underline" disabled={busy} onClick={link}>Email me a sign-in link</button>
            </p>
          </div>
        </form>
      )}
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <button className="btn-ghost" onClick={google}>Continue with Google</button>
    </div>
  );
}

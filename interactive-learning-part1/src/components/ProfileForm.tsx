"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setDisplayName } from "@/app/leaderboard/actions";

export default function ProfileForm({ name: initial }: { name: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="card flex flex-col gap-3 p-[22px]" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await setDisplayName(name);
      setBusy(false);
      if ("error" in r && r.error) setMsg({ ok: false, text: r.error });
      else { setMsg({ ok: true, text: "Saved. Everything you've published now shows this name." }); router.refresh(); }
    }}>
      <label className="label" htmlFor="pf-name">Display name</label>
      <input id="pf-name" className="input" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setMsg(null); }} required />
      <p className="text-[13px] text-muted">Shown as &ldquo;Published by&rdquo; on everything you share, on your public page and on the leaderboard.</p>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      <button className="btn self-start" disabled={busy || name.trim() === initial}>{busy ? "Saving…" : "Save name"}</button>
    </form>
  );
}

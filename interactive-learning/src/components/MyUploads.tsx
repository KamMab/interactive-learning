"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMyNote, deleteMySet } from "@/app/mine/actions";
import type { MyUpload } from "@/lib/db";

const kb = (n: number | null) => (n == null ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

// "Your uploads": each study set you made with the note files behind it. Delete a file or the whole set.
export default function MyUploads({ items }: { items: MyUpload[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function run(key: string, fn: () => Promise<{ error?: string; ok?: boolean }>) {
    setBusy(key); setErr("");
    const res = await fn();
    setBusy(null); setConfirm(null);
    if (res.error) setErr(res.error); else router.refresh();
  }

  if (!items.length) return <p className="card p-5 text-muted">Nothing uploaded yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      {err && <p className="fb bad">{err}</p>}
      {items.map((it) => {
        const setKey = "set:" + it.chapterId;
        return (
          <section key={it.chapterId} className="card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="eyebrow">{it.course}</span>
                <p className="truncate font-bold">{it.href ? <Link href={it.href} className="hover:underline">{it.title}</Link> : it.title}</p>
                {!it.published && <span className="tag">Not built yet</span>}
              </div>
              {confirm === setKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">Delete this set and its files?</span>
                  <button className="btn-ghost danger" disabled={busy === setKey} onClick={() => run(setKey, () => deleteMySet(it.chapterId))}>{busy === setKey ? "Deleting…" : "Delete"}</button>
                  <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-ghost" onClick={() => setConfirm(setKey)}>Delete set</button>
              )}
            </div>
            {it.notes.length > 0 && (
              <ul className="file-list">
                {it.notes.map((n) => {
                  const key = "note:" + n.id;
                  return (
                    <li key={n.id}>
                      <span className="fname">{n.name}</span><span className="fsize">{kb(n.size)}</span>
                      {confirm === key ? (
                        <>
                          <button type="button" className="link danger" disabled={busy === key} onClick={() => run(key, () => deleteMyNote(n.id))}>{busy === key ? "Deleting…" : "Yes, delete"}</button>
                          <button type="button" className="link" onClick={() => setConfirm(null)}>Keep</button>
                        </>
                      ) : (
                        <button type="button" className="x" aria-label={`Delete ${n.name}`} onClick={() => setConfirm(key)}>✕</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {it.notes.length > 0 && <p className="text-[13px] text-muted">Deleting a file removes the notes you uploaded. The study set built from them stays until you delete the set.</p>}
          </section>
        );
      })}
    </div>
  );
}

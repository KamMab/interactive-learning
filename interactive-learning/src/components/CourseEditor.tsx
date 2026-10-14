"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMySet, updateMyChapter, updateMyCourse } from "@/app/mine/actions";

type C = { id: string; kind: "class" | "fun"; code: string; title: string; professor: string | null; visibility: "public" | "private" };
type Ch = { id: string; number: number; title: string };

function ChapterRow({ ch, fun, onDone }: { ch: Ch; fun: boolean; onDone: (msg: string) => void }) {
  const [title, setTitle] = useState(ch.title), [num, setNum] = useState(ch.number);
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [err, setErr] = useState("");
  const dirty = title.trim() !== ch.title || num !== ch.number;
  return (
    <li className="edit-row">
      {!fun && <input className="input w-[72px] flex-none" type="number" min={1} value={num} onChange={(e) => setNum(Number(e.target.value))} aria-label="Chapter number" />}
      <input className="input min-w-0 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-label={fun ? "Game name" : "Chapter name"} />
      <button type="button" className="btn-ghost" disabled={!dirty || busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await updateMyChapter(ch.id, { title, number: fun ? ch.number : num });
        setBusy(false);
        if (r.error) setErr(r.error); else onDone("Saved.");
      }}>Save</button>
      {confirm
        ? <button type="button" className="btn-ghost danger" disabled={busy} onClick={async () => { setBusy(true); const r = await deleteMySet(ch.id); setBusy(false); if (r.error) setErr(r.error); else onDone("Deleted."); }}>Delete for good</button>
        : <button type="button" className="btn-ghost" onClick={() => setConfirm(true)}>Delete</button>}
      {err && <p className="w-full text-sm text-bad">{err}</p>}
    </li>
  );
}

/** "Edit" on your own course or category page: its details and every chapter's name and number. */
export default function CourseEditor({ course, chapters }: { course: C; chapters: Ch[] }) {
  const router = useRouter();
  const fun = course.kind === "fun";
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(course.code), [title, setTitle] = useState(course.title), [prof, setProf] = useState(course.professor ?? "");
  const [vis, setVis] = useState(course.visibility), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const done = (text: string) => { setMsg({ ok: true, text }); router.refresh(); };

  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>Edit {fun ? "category" : "course"}</button>;
  return (
    <section className="card flex w-full flex-col gap-5 p-[22px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Edit {fun ? "category" : "course"}</h2>
        <button type="button" className="link" onClick={() => setOpen(false)}>Close</button>
      </div>
      <form className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null);
        const r = await updateMyCourse(course.id, { code, title, professor: prof, visibility: vis });
        setBusy(false);
        if (r.error) setMsg({ ok: false, text: r.error }); else done("Saved.");
      }}>
        {!fun && <div><label className="label" htmlFor="ce-code">Course code</label><input id="ce-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} /></div>}
        <div className={fun ? "sm:col-span-2" : ""}><label className="label" htmlFor="ce-title">{fun ? "Category name" : "Course name"}</label><input id="ce-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        {!fun && <div><label className="label" htmlFor="ce-prof">Professor</label><input id="ce-prof" className="input" placeholder="Prof. Lee" value={prof} onChange={(e) => setProf(e.target.value)} /></div>}
        <div className="flex flex-wrap items-end gap-3 sm:col-span-3">
          <div className="seg max-w-xs"><button type="button" aria-pressed={vis === "public"} onClick={() => setVis("public")}>Everyone</button><button type="button" aria-pressed={vis === "private"} onClick={() => setVis("private")}>Just me</button></div>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
        </div>
      </form>
      <div className="flex flex-col gap-2">
        <span className="label">{fun ? "Games" : "Chapters"}</span>
        <ul className="flex list-none flex-col gap-2 p-0">
          {chapters.map((ch) => <ChapterRow key={ch.id + ch.number + ch.title} ch={ch} fun={fun} onDone={done} />)}
        </ul>
        <p className="text-[13px] text-muted">Deleting {fun ? "a game" : "a chapter"} also deletes the notes uploaded for it. Deleting the last one removes the whole {fun ? "category" : "course"}.</p>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </section>
  );
}

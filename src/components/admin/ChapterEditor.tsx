"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  MODES,
  MODE_INFO,
  modeCount,
  type Chapter,
  type ChapterContent,
  type ChapterSettings,
  type Mode,
  type Note,
  type Professor,
} from "@/lib/types";
import { createNoteUpload, deleteChapter, deleteNote, recordNote, saveChapter } from "@/app/admin/actions";
import ContentEditor from "./ContentEditor";

type GenMode = "replace" | "add" | "revise";

export default function ChapterEditor({
  chapter,
  notes: initialNotes,
  courseSlug,
  professors,
  supabaseUrl,
  anonKey,
}: {
  chapter: Chapter;
  notes: Note[];
  courseSlug: string;
  professors: Professor[];
  supabaseUrl: string;
  anonKey: string;
}) {
  const [professorId, setProfessorId] = useState<string | null>(chapter.professor_id);
  const [title, setTitle] = useState(chapter.title);
  const [number, setNumber] = useState(chapter.number);
  const [instructions, setInstructions] = useState(chapter.instructions);
  const [published, setPublished] = useState(chapter.published);
  const [content, setContent] = useState<ChapterContent>(chapter.content);
  const [settings, setSettings] = useState<ChapterSettings>(chapter.settings);
  const [notes, setNotes] = useState(initialNotes);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Generation
  const [request, setRequest] = useState("");
  const [genMode, setGenMode] = useState<GenMode>(chapter.content.terms.length || chapter.content.questions.length ? "add" : "replace");
  const [allowSettings, setAllowSettings] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [changeNote, setChangeNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    setSaving(true);
    const res = await saveChapter(chapter.id, { professor_id: professorId, title, number, instructions, published, content, settings });
    setSaving(false);
    if (res?.error) setStatus(`Save failed: ${res.error}`);
    else { setDirty(false); setStatus("Saved."); setTimeout(() => setStatus(null), 2500); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const sb = createClient(supabaseUrl, anonKey);
    for (const file of Array.from(files)) {
      const signed = await createNoteUpload(chapter.id, file.name);
      if ("error" in signed) { setStatus(`Upload failed: ${signed.error}`); continue; }
      const { error } = await sb.storage.from("notes").uploadToSignedUrl(signed.path, signed.token!, file, { contentType: file.type });
      if (error) { setStatus(`Upload failed: ${error.message}`); continue; }
      const rec = await recordNote(chapter.id, { name: file.name, path: signed.path, mime: file.type, size: file.size });
      if ("note" in rec && rec.note) setNotes((n) => [...n, rec.note as Note]);
    }
    setUploading(false);
  }

  async function removeNote(id: string) {
    if (!confirm("Remove this file?")) return;
    await deleteNote(id);
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  async function generate() {
    setGenerating(true);
    setChangeNote(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, professorId, request, mode: genMode, allowSettingsChanges: allowSettings, content, settings, instructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setContent(data.content);
      if (data.settings) setSettings(data.settings);
      setChangeNote(data.changeNote || "Draft ready.");
      setDirty(true);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const setS = <K extends keyof ChapterSettings>(k: K, v: ChapterSettings[K]) => { setSettings((s) => ({ ...s, [k]: v })); setDirty(true); };
  const toggleMode = (m: Mode) => setS("modes", settings.modes.includes(m) ? settings.modes.filter((x) => x !== m) : [...settings.modes, m]);
  const moveMode = (m: Mode, dir: -1 | 1) => {
    const arr = [...settings.modes];
    const i = arr.indexOf(m);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setS("modes", arr);
  };

  return (
    <div className="pb-24">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[34px] font-extrabold leading-tight">Ch. {number}: {title}</h1>
        {chapter.published && (
          <a href={`/courses/${courseSlug}/${professors.find((p) => p.id === chapter.professor_id)?.slug ?? "all"}/${chapter.number}`} target="_blank" className="text-sm text-accent">View live →</a>
        )}
      </div>

      {/* 1. Details */}
      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-[100px_1fr_1fr]">
          <div><label className="label">Number</label><input type="number" className="input" value={number} onChange={(e) => touch(setNumber)(Number(e.target.value))} /></div>
          <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => touch(setTitle)(e.target.value)} /></div>
          <div>
            <label className="label" htmlFor="ch-prof">Professor</label>
            <select id="ch-prof" className="input" value={professorId ?? ""} onChange={(e) => touch(setProfessorId)(e.target.value || null)}>
              {professors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">Shared by every professor</option>
            </select>
          </div>
        </div>
        {professorId && professors.find((p) => p.id === professorId)?.instructions && (
          <p className="note mt-3">Claude also follows {professors.find((p) => p.id === professorId)!.name}&apos;s instructions from the course page.</p>
        )}
        <div className="mt-4">
          <label className="label">Chapter instructions for Claude (saved, used every time you generate)</label>
          <textarea
            className="input"
            rows={4}
            value={instructions}
            onChange={(e) => touch(setInstructions)(e.target.value)}
            placeholder="e.g. Focus on the 5-step revenue model. The professor said bundled-contract allocation will be on the midterm, so include at least 5 computation questions on it. Skip the appendix."
          />
        </div>
        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" checked={published} onChange={(e) => touch(setPublished)(e.target.checked)} /> Published (visible to students)
        </label>
      </Section>

      {/* 2. Notes */}
      <Section title="Notes" hint="PDF, Word (.docx), text/markdown, or images of handwritten notes.">
        <ul className="grid gap-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
              <span className="truncate">📄 {n.name} <span className="text-muted">{n.size ? `· ${(n.size / 1024).toFixed(0)} KB` : ""}</span></span>
              <button className="text-muted hover:text-bad" onClick={() => removeNote(n.id)}>Remove</button>
            </li>
          ))}
          {notes.length === 0 && <li className="text-sm text-muted">No notes uploaded yet.</li>}
        </ul>
        <label className="btn-ghost mt-3 cursor-pointer">
          {uploading ? "Uploading…" : "+ Upload notes"}
          <input type="file" multiple className="hidden" accept=".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/webp"
            onChange={(e) => { upload(e.target.files); e.target.value = ""; }} disabled={uploading} />
        </label>
      </Section>

      {/* 3. Claude */}
      <Section title="Generate with Claude" hint="Claude reads the notes plus your course and chapter instructions. The result is a draft until you click Save.">
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["replace", "Build from scratch", "Replace everything with a fresh set"],
            ["add", "Add more", "Keep what's here, add new material"],
            ["revise", "Revise existing", "Edit the current set per your request"],
          ] as const).map(([v, name, desc]) => (
            <button key={v} onClick={() => setGenMode(v)}
              className={`rounded-xl border p-3 text-left text-sm ${genMode === v ? "border-accent bg-accent-soft" : "border-line"}`}>
              <div className="font-medium">{name}</div>
              <div className="text-muted">{desc}</div>
            </button>
          ))}
        </div>
        <textarea
          className="input mt-3"
          rows={3}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={
            genMode === "revise"
              ? "e.g. Make the questions harder, rewrite definitions in simpler words, and turn off Match mode."
              : "Optional extra instructions for this run, e.g. 25 questions, mostly computations, 8 journal entries."
          }
        />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowSettings} onChange={(e) => setAllowSettings(e.target.checked)} />
          Let Claude change study settings if my instructions ask for it
        </label>
        <button className="btn mt-3" onClick={generate} disabled={generating}>
          {generating ? "Claude is working… (can take a minute)" : "Generate draft"}
        </button>
        {changeNote && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">✓ {changeNote} Review below, then Save.</p>}
      </Section>

      {/* 4. Study settings */}
      <Section title="How students study this chapter">
        <p className="label">Study modes (in display order). The first one opens when a student picks the chapter.</p>
        <div className="grid gap-2">
          {[...settings.modes, ...MODES.filter((m) => !settings.modes.includes(m))].map((m) => {
            const on = settings.modes.includes(m);
            const count = modeCount(m, content);
            return (
              <div key={m} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${on ? "border-line" : "border-dashed border-line opacity-60"}`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={on} onChange={() => toggleMode(m)} />
                  <span className="font-medium">{MODE_INFO[m].name}</span>
                  {on && count === 0 && <span className="text-xs text-bad">needs {MODE_INFO[m].needs.join(" or ")}; hidden until added</span>}
                </label>
                {on && (
                  <span className="flex gap-1 text-muted">
                    <button onClick={() => moveMode(m, -1)} className="px-2 hover:text-ink">↑</button>
                    <button onClick={() => moveMode(m, 1)} className="px-2 hover:text-ink">↓</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><label className="label">Quiz questions per session (0 = all)</label>
            <input type="number" min={0} className="input" value={settings.questionCount} onChange={(e) => setS("questionCount", Number(e.target.value))} /></div>
          <div><label className="label">Rush time limit (seconds)</label>
            <input type="number" min={10} className="input" value={settings.rushSeconds} onChange={(e) => setS("rushSeconds", Number(e.target.value))} /></div>
          <div><label className="label">Match pairs per round</label>
            <input type="number" min={2} max={12} className="input" value={settings.matchPairs} onChange={(e) => setS("matchPairs", Number(e.target.value))} /></div>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.shuffle} onChange={(e) => setS("shuffle", e.target.checked)} /> Shuffle order each session</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showExplanations} onChange={(e) => setS("showExplanations", e.target.checked)} /> Show explanations after each answer</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.requireFlashcardsFirst} onChange={(e) => setS("requireFlashcardsFirst", e.target.checked)} /> Lock other modes until flashcards are finished once</label>
        </div>
      </Section>

      {/* 5. Content */}
      <Section title="Study content">
        <div className="mb-4">
          <label className="label">Chapter summary (shown to students)</label>
          <textarea className="input" rows={2} value={content.summary ?? ""} onChange={(e) => { setContent({ ...content, summary: e.target.value }); setDirty(true); }} />
        </div>
        <ContentEditor content={content} onChange={(c) => { setContent(c); setDirty(true); }} />
      </Section>

      <div className="mt-8">
        <button className="btn-danger" onClick={() => { if (confirm("Delete this chapter and its notes?")) deleteChapter(chapter.id, chapter.course_id); }}>
          Delete chapter
        </button>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-muted">{status ?? (dirty ? "Unsaved changes" : "All changes saved")}</span>
          <button className="btn" onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : published ? "Save & publish" : "Save draft"}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-[22px] font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

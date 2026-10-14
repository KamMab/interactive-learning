"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";
import { finishUpload, importSet, startUpload } from "@/app/upload/actions";
import { copyPrompt, parseImport } from "@/lib/import-format";

type Phase = "idle" | "uploading" | "building" | "error";
type Picked = { file: File; on: boolean };
const baseName = (n: string) => n.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

// Upload in two questions: for class or for fun, and let Claude build it or paste a quiz made elsewhere.
export default function UploadForm({ courses, authorName }: { courses: { code: string; title: string }[]; authorName: string }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<"class" | "fun">("class");
  const [how, setHow] = useState<"build" | "paste">("build");
  const [title, setTitle] = useState(""), [code, setCode] = useState(""), [chapterTitle, setChapterTitle] = useState("");
  const [more, setMore] = useState(false), [courseTitle, setCourseTitle] = useState(""), [professor, setProfessor] = useState(""), [number, setNumber] = useState(1), [focus, setFocus] = useState("");
  const [idea, setIdea] = useState(""), [picked, setPicked] = useState<Picked[]>([]), [separate, setSeparate] = useState(false), [step, setStep] = useState(""), [pasted, setPasted] = useState("");
  const [share, setShare] = useState(false), [name, setName] = useState(authorName);
  const [phase, setPhase] = useState<Phase>("idle"), [msg, setMsg] = useState(""), [copied, setCopied] = useState(false);
  const fun = purpose === "fun";
  const files = picked.filter((p) => p.on).map((p) => p.file);
  const addFiles = (list: FileList | null) => {
    const add = Array.from(list ?? []);
    setPicked((cur) => [...cur, ...add.filter((f) => !cur.some((c) => c.file.name === f.name && c.file.size === f.size)).map((file) => ({ file, on: true }))]);
  };
  const known = courses.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  const check = how === "paste" && pasted.trim() ? parseImport(pasted) : null;
  const topic = fun ? title : [code, chapterTitle].filter(Boolean).join(" ");

  const meta = (list: File[] = files, over: { title?: string; number?: number; chapterTitle?: string } = {}) => ({
    purpose, share, authorName: name, idea, code, title: over.title ?? (fun ? title : courseTitle || known?.title || ""), professor,
    number: over.number ?? number, chapterTitle: over.chapterTitle ?? chapterTitle, instructions: focus,
    files: list.map((f) => ({ name: f.name, type: f.type, size: f.size })),
  });

  async function copy() {
    const text = copyPrompt(topic);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setMsg(text); setPhase("error"); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (how === "paste") {
      setPhase("building");
      const res = await importSet(meta(), pasted);
      if ("error" in res) { setPhase("error"); setMsg(res.error ?? "That didn't work."); return; }
      router.push(res.href);
      return;
    }
    // One set from every chosen file, or (when asked) a separate set for each file.
    const jobs = separate && files.length > 1
      ? files.map((f, i) => ({ list: [f], over: fun ? { title: `${title.trim()}: ${baseName(f.name)}` } : { number: number + i, chapterTitle: baseName(f.name) } }))
      : [{ list: files, over: {} }];
    let last = "";
    for (let j = 0; j < jobs.length; j++) {
      const { list, over } = jobs[j];
      const tag = jobs.length > 1 ? ` (${j + 1} of ${jobs.length}${j ? `, ${j} done` : ""})` : "";
      setStep(tag);
      setPhase("uploading");
      const start = await startUpload(meta(list, over));
      if ("error" in start) { setPhase("error"); setMsg((start.error ?? "Upload failed.") + (j ? `\n${j} of ${jobs.length} sets were made. See Your chapters.` : "")); return; }
      const sb = browserSupabase();
      const done: { name: string; path: string; mime: string; size: number }[] = [];
      for (let i = 0; i < list.length; i++) {
        const f = list[i], slot = start.files[i];
        const { error } = await sb!.storage.from("notes").uploadToSignedUrl(slot.path, slot.token, f, { contentType: f.type });
        if (error) { setPhase("error"); setMsg(`${f.name} didn't upload: ${error.message}`); return; }
        done.push({ name: f.name, path: slot.path, mime: f.type, size: f.size });
      }
      setPhase("building");
      const fin = await finishUpload(start.uploadId, done);
      if ("error" in fin) { setPhase("error"); setMsg((fin.error ?? "Claude couldn't build it.") + (j ? `\n${j} of ${jobs.length} sets were made. See Your chapters.` : "")); return; }
      last = fin.href;
    }
    router.push(jobs.length > 1 ? "/mine" : last);
  }

  const busy = phase === "uploading" || phase === "building";
  const ready = (fun ? title.trim() : code.trim()) && (how === "paste" ? check && !("error" in check) : files.length || idea.trim());
  return (
    <form onSubmit={submit} className="card flex flex-col gap-6 p-[22px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset><legend className="label">1. What is it for?</legend>
          <div className="seg"><button type="button" aria-pressed={!fun} onClick={() => { setPurpose("class"); setShare(false); }}>For class</button><button type="button" aria-pressed={fun} onClick={() => { setPurpose("fun"); setShare(true); }}>For fun</button></div></fieldset>
        <fieldset><legend className="label">2. How?</legend>
          <div className="seg"><button type="button" aria-pressed={how === "build"} onClick={() => setHow("build")}>Claude builds it</button><button type="button" aria-pressed={how === "paste"} onClick={() => setHow("paste")}>Paste a quiz</button></div></fieldset>
      </div>

      <datalist id="course-codes">{courses.map((c) => <option key={c.code} value={c.code}>{c.title}</option>)}</datalist>
      {fun ? (
        <div><label className="label" htmlFor="u-title">Name</label><input id="u-title" className="input" placeholder="US State Capitals" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div><label className="label" htmlFor="u-code">Course</label><input id="u-code" list="course-codes" className="input" placeholder="MGMT 120B" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><label className="label" htmlFor="u-ch">Chapter</label><input id="u-ch" className="input" placeholder="Ch. 13 Current Liabilities" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} /></div>
        </div>
      )}

      {how === "build" ? (
        <div className="flex flex-col gap-3">
          <label className="label" htmlFor="u-idea">{fun ? "What should it cover?" : "Upload your notes, or describe what to cover"}</label>
          <textarea id="u-idea" className="input" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)}
            placeholder={fun ? "All 50 states and their capitals." : "Optional if you upload files. e.g. Notes payable, contingencies, warranties."} />
          <label className="dropzone">
            <input id="u-files" type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/webp" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <b>{picked.length ? "Add more files" : "Add files (optional)"}</b>
            <span>PDF, Word, text, or photos of notes. Up to 6 per set.</span>
          </label>
          {picked.length > 0 && (
            <ul className="file-list" aria-label="Chosen files">
              {picked.map((p, i) => (
                <li key={p.file.name + p.file.size} className={p.on ? "" : "off"}>
                  <input type="checkbox" checked={p.on} aria-label={`Use ${p.file.name}`} onChange={() => setPicked((cur) => cur.map((c, k) => (k === i ? { ...c, on: !c.on } : c)))} />
                  <span className="fname">{p.file.name}</span><span className="fsize">{kb(p.file.size)}</span>
                  <button type="button" className="x" aria-label={`Remove ${p.file.name}`} onClick={() => setPicked((cur) => cur.filter((_, k) => k !== i))}>✕</button>
                </li>
              ))}
            </ul>
          )}
          {files.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="label">{files.length} files selected. Make…</legend>
              <div className="seg max-w-md"><button type="button" aria-pressed={!separate} onClick={() => setSeparate(false)}>One set from all</button><button type="button" aria-pressed={separate} onClick={() => setSeparate(true)}>A set for each file</button></div>
              {separate && <p className="text-[13px] text-muted">{fun ? "Each file becomes its own game, named after the file." : `Each file becomes its own chapter, numbered from ${number} and named after the file. Change the starting number under More options.`} Each one counts toward your 5 a day.</p>}
            </fieldset>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ol className="flex list-none flex-col gap-2 p-0 text-sm">
            <li><b>1.</b> Copy the format and paste it into Claude (claude.ai). Say what the quiz should be about if you haven&apos;t filled in the name above.</li>
            <li><b>2.</b> Paste Claude&apos;s whole answer below.</li>
          </ol>
          <div><button type="button" className="btn-ghost" onClick={copy}>{copied ? "Copied" : "Copy the format for Claude"}</button></div>
          <textarea id="u-paste" className="input mono text-[13px]" rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"summary": "…", "terms": [ … ], "questions": [ … ] }' />
          {check && ("error" in check
            ? <p className="text-sm text-bad">{check.error}</p>
            : <p className="tag ok self-start">Looks good: {check.content.terms.length} cards · {check.content.questions.length} questions{check.content.map ? ` · ${check.content.map.items.length} map places` : ""}</p>)}
        </div>
      )}

      <div>
        <button type="button" className="link" onClick={() => setMore(!more)}>{more ? "Fewer options" : "More options"}</button>
        {more && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {!fun && <div><label className="label" htmlFor="u-ct">Course name</label><input id="u-ct" className="input" placeholder={known?.title || "Intermediate Accounting"} value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} /></div>}
            {!fun && <div><label className="label" htmlFor="u-prof">Professor</label><input id="u-prof" className="input" placeholder="Prof. Smith" value={professor} onChange={(e) => setProfessor(e.target.value)} /></div>}
            {!fun && <div><label className="label" htmlFor="u-num">Chapter number</label><input id="u-num" type="number" min={1} className="input" value={number} onChange={(e) => setNumber(Number(e.target.value))} /></div>}
            {how === "build" && <div className="sm:col-span-3"><label className="label" htmlFor="u-focus">Anything Claude should focus on?</label><input id="u-focus" className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Lots of journal entries; skip the appendix." /></div>}
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label">3. Who can see it?</legend>
        <div className="seg max-w-sm"><button type="button" aria-pressed={share} onClick={() => setShare(true)}>Everyone</button><button type="button" aria-pressed={!share} onClick={() => setShare(false)}>Just me</button></div>
        {share && <div className="mt-1 max-w-sm"><label className="label" htmlFor="u-name">Published by</label><input id="u-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>}
      </fieldset>

      {phase === "error" && <p className="fb bad"><strong>Something went wrong</strong><br /><span className="whitespace-pre-wrap">{msg}</span></p>}
      {busy && <p className="fb"><strong>{how === "paste" ? "Publishing…" : phase === "uploading" ? `Uploading…${step}` : `Claude is building it…${step}`}</strong><br />{how === "build" && phase === "building" ? "This usually takes under a minute. Keep this tab open." : ""}</p>}
      <div><button className="btn big" disabled={busy || !ready}>{busy ? "Working…" : how === "paste" ? "Publish" : separate && files.length > 1 ? `Build ${files.length} ${fun ? "games" : "study sets"}` : fun ? "Build my game" : "Build my study set"}</button></div>
    </form>
  );
}

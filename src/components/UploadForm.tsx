"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";
import { finishUpload, importSet, startUpload } from "@/app/upload/actions";
import { copyPrompt, parseImport } from "@/lib/import-format";
import type { Mode } from "@/lib/types";

type Phase = "idle" | "uploading" | "building" | "error";
type Picked = { file: File; on: boolean };
export type MyCourse = { id: string; kind: "class" | "fun"; code: string; title: string; professor?: string | null; chapters: number };
export type UploadPreset = { courseId?: string; newCourse?: boolean; code?: string; title?: string; fun?: boolean };

const baseName = (n: string) => n.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** Same rule as the server: "Ch. 3 …" carries its own chapter number. */
const numberInTitle = (t: string) => /\b(?:ch(?:apter)?|unit|week|lecture|module)\.?\s*\d{1,3}\b/i.test(t);

// Optional extra ways to study (Learn, Flashcards and Quick-fire are always included).
const EXTRAS: { mode: Mode; name: string; hint: string }[] = [
  { mode: "match", name: "Match", hint: "Pair both sides against the clock" },
  { mode: "rush", name: "Rush", hint: "Rapid-fire questions on a timer" },
  { mode: "entries", name: "Journal entries", hint: "Accounting: build each entry" },
  { mode: "map", name: "Map", hint: "Geography: click places on a map" },
];

export default function UploadForm({ myCourses, knownCodes, authorName, preset }: {
  myCourses: MyCourse[]; knownCodes: { code: string; title: string }[]; authorName: string; preset?: UploadPreset;
}) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<"class" | "fun">(preset?.fun ? "fun" : "class");
  // "" = make a new course (or category); otherwise the id of one of the student's own.
  const firstOf = (k: "class" | "fun") => myCourses.find((c) => c.kind === k)?.id ?? "";
  const [courseId, setCourseId] = useState(
    preset?.courseId && myCourses.some((c) => c.id === preset.courseId) ? preset.courseId : preset?.newCourse ? "" : firstOf(preset?.fun ? "fun" : "class"));
  const [code, setCode] = useState(preset?.code ?? ""), [courseTitle, setCourseTitle] = useState(preset?.title ?? ""), [professor, setProfessor] = useState("");
  const [title, setTitle] = useState(""), [chapterTitle, setChapterTitle] = useState("");
  const [how, setHow] = useState<"build" | "paste">("build");
  const [more, setMore] = useState(false), [number, setNumber] = useState(0), [focus, setFocus] = useState("");
  const [idea, setIdea] = useState(""), [picked, setPicked] = useState<Picked[]>([]), [separate, setSeparate] = useState(false), [step, setStep] = useState(""), [pasted, setPasted] = useState("");
  const [extras, setExtras] = useState<Mode[]>([]), [studyIdea, setStudyIdea] = useState(""), [other, setOther] = useState(false);
  const [share, setShare] = useState(true);
  const [party, setParty] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle"), [msg, setMsg] = useState(""), [copied, setCopied] = useState(false);

  const fun = purpose === "fun";
  const choices = myCourses.filter((c) => c.kind === purpose);
  const useMine = !!courseId && choices.some((c) => c.id === courseId);
  const switchPurpose = (p: "class" | "fun") => { setPurpose(p); setCourseId(myCourses.find((c) => c.kind === p)?.id ?? ""); };
  const myCourse = myCourses.find((c) => c.id === courseId);
  const files = picked.filter((p) => p.on).map((p) => p.file);
  const addFiles = (list: FileList | null) => {
    const add = Array.from(list ?? []);
    setPicked((cur) => [...cur, ...add.filter((f) => !cur.some((c) => c.file.name === f.name && c.file.size === f.size)).map((file) => ({ file, on: true }))]);
  };
  const known = knownCodes.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  const mineSameCode = !useMine && myCourses.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  const check = how === "paste" && pasted.trim() ? parseImport(pasted) : null;
  const topic = fun ? [useMine ? myCourse?.title : title, chapterTitle].filter(Boolean).join(": ") : [useMine ? myCourse?.code : code, chapterTitle].filter(Boolean).join(" ");
  const toggle = (m: Mode) => setExtras((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m]));

  const meta = (list: File[] = files, over: { title?: string; number?: number; chapterTitle?: string } = {}) => ({
    purpose, share, authorName, idea,
    courseId: useMine ? courseId : undefined,
    code: useMine ? "" : code, title: over.title ?? (fun ? title : courseTitle || known?.title || ""), professor,
    number: over.number ?? number, chapterTitle: over.chapterTitle ?? chapterTitle, instructions: focus,
    files: list.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    extras: party ? [] : extras, studyIdea: other && !party ? studyIdea : "", party: how === "build" && party,
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
      ? files.map((f, i) => ({ list: [f], over: (fun ? { chapterTitle: baseName(f.name) } : { number: number ? number + i : 0, chapterTitle: baseName(f.name) }) as { number?: number; chapterTitle?: string } }))
      : [{ list: files, over: {} as { number?: number; chapterTitle?: string } }];
    let last = "";
    for (let j = 0; j < jobs.length; j++) {
      const { list, over } = jobs[j];
      setStep(jobs.length > 1 ? ` (${j + 1} of ${jobs.length})` : "");
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
      const fin = await finishUpload(start.uploadId, done, { extras: party ? [] : extras, studyIdea: other && !party ? studyIdea : "", party, autoNumber: !fun && !(over.number ?? number) && !numberInTitle(over.chapterTitle ?? chapterTitle) });
      if ("error" in fin) { setPhase("error"); setMsg((fin.error ?? "Claude couldn't build it.") + (j ? `\n${j} of ${jobs.length} sets were made. See Your chapters.` : "")); return; }
      last = fin.href;
    }
    router.push(jobs.length > 1 ? "/mine" : last);
  }

  const busy = phase === "uploading" || phase === "building";
  const courseReady = useMine || (fun ? !!title.trim() : !!code.trim());
  const ready = courseReady && (how === "paste" ? check && !("error" in check) : files.length || idea.trim() || (!fun && chapterTitle.trim()));

  return (
    <form onSubmit={submit} className="card flex flex-col gap-7 p-[22px]">
      <fieldset><legend className="label">1. What is it for?</legend>
        <div className="seg max-w-md"><button type="button" aria-pressed={!fun} onClick={() => switchPurpose("class")}>For class</button><button type="button" aria-pressed={fun} onClick={() => switchPurpose("fun")}>For fun</button></div>
      </fieldset>

      <fieldset className="flex flex-col gap-3"><legend className="label">2. {fun ? "Which category?" : "Which course?"}</legend>
        <div className="picks" role="radiogroup" aria-label={fun ? "Category" : "Course"}>
          {choices.map((c) => (
            <button key={c.id} type="button" role="radio" className="pick" aria-checked={courseId === c.id} aria-pressed={courseId === c.id} onClick={() => setCourseId(c.id)}>
              <span className="pick-code">{fun ? c.title : c.code}</span>
              {!fun && <span className="pick-ttl">{c.title}</span>}
              <span className="pick-meta">{c.chapters} {fun ? (c.chapters === 1 ? "game" : "games") : (c.chapters === 1 ? "chapter" : "chapters")}{c.professor ? ` · ${c.professor}` : ""}</span>
            </button>
          ))}
          <button type="button" role="radio" className="pick add" aria-checked={!useMine} aria-pressed={!useMine} onClick={() => setCourseId("")}>
            + New {fun ? "category" : "course"}
          </button>
        </div>
        {!useMine && (fun ? (
          <div className="max-w-md">
            <label className="label" htmlFor="u-title">Category name</label>
            <input id="u-title" className="input" placeholder="US States" value={title} onChange={(e) => setTitle(e.target.value)} />
            <p className="mt-1 text-[13px] text-muted">A category holds several games, like US States → capitals, flags, locations.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr]">
              <div><label className="label" htmlFor="u-code">Course code</label><input id="u-code" className="input" placeholder="MATH 1" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} /></div>
              <div><label className="label" htmlFor="u-ct">Course name</label><input id="u-ct" className="input" placeholder={known?.title || "Calculus"} value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} /></div>
              <div><label className="label" htmlFor="u-prof">Professor</label><input id="u-prof" className="input" placeholder="Prof. Lee" value={professor} onChange={(e) => setProfessor(e.target.value)} /></div>
            </div>
            {mineSameCode
              ? <p className="text-[13px] text-muted">You already have {mineSameCode.code}, so this chapter will be added to it.</p>
              : <p className="text-[13px] text-muted">Shown as &ldquo;{code.trim().toUpperCase() || "MATH 1"} by {authorName}&rdquo;{professor.trim() ? ` · ${professor.trim()}` : ""}. Adding the professor tells students whose notes they&apos;re studying.</p>}
          </>
        ))}
        <div>
          <label className="label" htmlFor="u-ch">{fun ? "Name this game" : "Chapter"}</label>
          <input id="u-ch" className="input" placeholder={fun ? "State capitals" : "Ch. 3 Derivatives"} value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} />
          {!fun && <p className="mt-1 text-[13px] text-muted">Just &ldquo;Ch. 3&rdquo; is fine: the full title is taken from your notes. Without a number, it goes after your last chapter.</p>}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3"><legend className="label">3. How?</legend>
        <div className="seg max-w-md"><button type="button" aria-pressed={how === "build"} onClick={() => setHow("build")}>Claude builds it</button><button type="button" aria-pressed={how === "paste"} onClick={() => setHow("paste")}>Paste a quiz</button></div>
        {how === "build" ? (
          <div className="flex flex-col gap-3">
            <label className="label" htmlFor="u-idea">{fun ? "What should it cover?" : "Upload your notes, or describe what to cover"}</label>
            <textarea id="u-idea" className="input" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)}
              placeholder={fun ? "All 50 states and their capitals." : "Optional if you upload files. e.g. Limits, the chain rule, related rates."} />
            <label className="dropzone">
              <input id="u-files" type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/webp" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <b>{picked.length ? "Add more files" : "Add files (optional)"}</b>
              <span>PDF, Word, text, or photos of notes. Long chapters are split into sections you can study one at a time.</span>
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
              <div className="flex flex-col gap-2">
                <span className="label">{files.length} files selected. Make…</span>
                <div className="seg max-w-md"><button type="button" aria-pressed={!separate} onClick={() => setSeparate(false)}>One chapter from all</button><button type="button" aria-pressed={separate} onClick={() => setSeparate(true)}>A chapter for each file</button></div>
                {separate && <p className="text-[13px] text-muted">{fun ? "Each file becomes its own game, named after the file." : "Each file becomes its own chapter, named after the file."} Each one counts toward your daily limit.</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="flex list-none flex-col gap-2 p-0 text-sm">
              <li><b>1.</b> Copy the format and paste it into Claude (claude.ai). Say what the quiz should be about if you haven&apos;t named it above.</li>
              <li><b>2.</b> Paste Claude&apos;s whole answer below, or choose the file if Claude gave you one.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={copy}>{copied ? "Copied" : "Copy the format for Claude"}</button>
              <label className="btn-ghost cursor-pointer">
                Choose a quiz file
                <input type="file" accept=".json,.txt,application/json,text/plain" className="sr-only"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPasted(await f.text()); e.target.value = ""; }} />
              </label>
            </div>
            <textarea id="u-paste" className="input mono text-[13px]" rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"summary": "…", "terms": [ … ], "questions": [ … ] }' />
            {check && ("error" in check
              ? <p className="text-sm text-bad">{check.error}</p>
              : <p className="tag ok self-start">Looks good: {check.content.terms.length} cards · {check.content.questions.length} questions{check.content.sections?.length ? ` · ${check.content.sections.length} sections` : ""}{check.content.entries.length ? ` · ${check.content.entries.length} journal entries` : ""}{check.content.map ? ` · ${check.content.map.items.length} map places` : ""}{check.content.tools?.includes("interest-tables") ? " · interest tables" : ""}</p>)}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3"><legend className="label">4. Ways to study</legend>
        {how === "build" && (
          <button type="button" className={`party-pick${party ? " on" : ""}`} aria-pressed={party} onClick={() => setParty(!party)}>
            <span className="party-check" aria-hidden>{party ? "✓" : ""}</span>
            <span className="min-w-0">
              <b>Make it a live party game: &ldquo;Don&apos;t Say the Same Thing as Me&rdquo;</b>
              <span>Players name something that fits each prompt without matching the site. Play solo for the leaderboard, or host a live game with a join code for friends or a class.</span>
            </span>
          </button>
        )}
        {!(how === "build" && party) && <>
        <p className="text-sm text-muted">Every set gets <b className="text-ink">Learn</b>, <b className="text-ink">Flashcards</b> and <b className="text-ink">Quick-fire</b>. Add more if they fit your material{how === "build" ? ", or leave these off and Claude adds what fits" : ""}.</p>
        <div className="flex flex-wrap gap-2">
          {EXTRAS.map((x) => (
            <span key={x.mode} className="contents">
              <button type="button" className="chip" aria-pressed={extras.includes(x.mode)} onClick={() => toggle(x.mode)} title={x.hint}>
                {extras.includes(x.mode) ? "✓ " : "+ "}{x.name}
              </button>
              {x.mode === "rush" && how === "build" && (
                <button type="button" className="chip" aria-pressed={other} onClick={() => setOther(!other)} title="Describe your own way to study">
                  {other ? "✓ " : "+ "}Other
                </button>
              )}
            </span>
          ))}
        </div>
        {how === "build" && other && (
          <div>
            <label className="label" htmlFor="u-studyidea">Describe how you&apos;d like to study it</label>
            <textarea id="u-studyidea" className="input" rows={2} value={studyIdea} onChange={(e) => setStudyIdea(e.target.value)}
              placeholder="e.g. Quiz me on which formula to use for each word problem." />
          </div>
        )}
        </>}
        {how === "build" && party && <p className="text-sm text-muted">Say what players should name in the idea box above, e.g. &ldquo;US state capitals&rdquo; or &ldquo;US presidents&rdquo;. Claude writes the prompts from broad to narrow.</p>}
      </fieldset>

      <div>
        <button type="button" className="link" onClick={() => setMore(!more)}>{more ? "Fewer options" : "More options"}</button>
        {more && (
          <div className="mt-3 grid gap-4 sm:grid-cols-[160px_1fr]">
            {!fun && <div><label className="label" htmlFor="u-num">Chapter number</label><input id="u-num" type="number" min={0} className="input" value={number || ""} placeholder="Auto" onChange={(e) => setNumber(Number(e.target.value) || 0)} /></div>}
            {how === "build" && <div className={fun ? "sm:col-span-2" : ""}><label className="label" htmlFor="u-focus">Anything Claude should focus on?</label><input id="u-focus" className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Lots of practice problems; skip the appendix." /></div>}
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2"><legend className="label">5. Who can see it?</legend>
        <div className="seg max-w-sm"><button type="button" aria-pressed={share} onClick={() => setShare(true)}>Everyone</button><button type="button" aria-pressed={!share} onClick={() => setShare(false)}>Just me</button></div>
        {share
          ? <p className="mt-1 text-sm text-muted">Published by <b className="text-ink">{authorName}</b> · <a href="/account" target="_blank" rel="noreferrer" className="underline">Change your display name</a></p>
          : !fun && <p className="mt-1 text-sm text-muted">The whole course is private until you share it.</p>}
      </fieldset>

      {phase === "error" && <p className="fb bad"><strong>Something went wrong</strong><br /><span className="whitespace-pre-wrap">{msg}</span></p>}
      {busy && <p className="fb"><strong>{how === "paste" ? "Publishing…" : phase === "uploading" ? `Uploading…${step}` : `Claude is building it…${step}`}</strong><br />{how === "build" && phase === "building" ? "Long chapters can take a minute or two. Keep this tab open." : ""}</p>}
      <div><button className="btn big" disabled={busy || !ready}>{busy ? "Working…" : how === "paste" ? "Publish" : separate && files.length > 1 ? `Build ${files.length} ${fun ? "games" : "chapters"}` : fun ? "Build my game" : "Build my chapter"}</button></div>
    </form>
  );
}

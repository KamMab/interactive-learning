"use server";
import { admin, adminGetProfessor, adminListNotes } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { generateStudySet } from "@/lib/claude";
import { slugify } from "@/lib/id";
import { UPLOADS_PER_DAY } from "@/lib/config";
import { ensureProfile } from "@/lib/profiles";
import { parseImport } from "@/lib/import-format";
import { CORE_MODES, DEFAULT_SETTINGS, EXTRA_MODES, MODE_INFO, modeCount, normalizeContent, normalizeSettings, type Chapter, type ChapterContent, type Course, type Mode } from "@/lib/types";

export type UploadMeta = {
  purpose: "class" | "fun";
  share: boolean;         // true = everyone can find it (shows the author's name), false = only the student
  authorName: string;     // name shown on shared sets
  idea: string;           // for fun (or class) without files: what to build, e.g. "US state capitals"
  courseId?: string;     // add to one of the student's own courses (class only)
  code: string;           // new course code, e.g. "MATH 1" (class only)
  title: string;          // course title (or the game's name for fun)
  professor: string;      // optional label on a new course, e.g. "Prof. Lee"
  number: number;         // chapter number (0 = work it out from the title, or the next one)
  chapterTitle: string;
  instructions: string;   // what the student wants to focus on
  files: { name: string; type: string; size: number }[];
  extras?: Mode[];        // extra ways to study the student picked (Learn, Flashcards and Quick-fire are always on)
  studyIdea?: string;     // "describe another way to study", passed to Claude
};

/** Learn, Flashcards and Quick-fire first, then the extras that fit: the student's picks, or Claude's if they picked none. */
function finalModes(content: ChapterContent, picked: Mode[] | undefined, suggested: Mode[] | undefined): Mode[] {
  const fits = (m: Mode) => modeCount(m, content) > 0;
  const want = (picked?.length ? picked : suggested ?? []).filter((m) => EXTRA_MODES.includes(m));
  const extras = [...new Set(want)].filter(fits);
  return [...CORE_MODES.filter(fits), ...extras];
}

function studyRequest(meta: UploadMeta) {
  const extras = (meta.extras ?? []).filter((m) => EXTRA_MODES.includes(m));
  return [
    "Every set is studied with Learn, Flashcards and Quick-fire, so always include terms and multiple-choice questions.",
    extras.length && `The student also wants these ways to study, so include the content they need: ${extras.map((m) => `${MODE_INFO[m].name} (${MODE_INFO[m].blurb})`).join("; ")}.`,
    meta.studyIdea?.trim() && `The student described another way they'd like to study. Shape the terms and questions to support it as well as the available modes allow:\n${meta.studyIdea.trim().slice(0, 600)}`,
  ].filter(Boolean).join("\n");
}

/** Titles that only say which chapter it is ("Ch. 3", "Chapter 3", "3") or the placeholder we made. */
const isGenericTitle = (t: string) => /^\s*(?:(?:ch(?:apter)?|unit|week|lecture|module)\.?\s*)?\d{0,3}\s*$/i.test(t);

/** "Ch. 13 Current Liabilities" -> 13. */
const numberFromTitle = (t: string) => {
  const m = t.match(/\b(?:ch(?:apter)?|unit|week|lecture|module)\.?\s*(\d{1,3})\b/i);
  return m ? Number(m[1]) : 0;
};

const MAX_FILES = 6, MAX_BYTES = 25 * 1024 * 1024;
const OK_TYPE = /\.(pdf|docx|txt|md|csv|png|jpe?g|webp)$/i;
const rand = () => Math.random().toString(36).slice(2, 8);

/** Step 1: check the student, create their private course/chapter, and hand back one-time upload links. */
export async function startUpload(meta: UploadMeta) {
  const user = await currentUser();
  if (!user) return { error: "Sign in to upload." };
  const fun = meta.purpose === "fun";
  const code = fun ? "FUN" : meta.code.trim().toUpperCase().replace(/\s+/g, " ");
  if (!fun && !meta.courseId && !code) return { error: "Add the course code, like MATH 1." };
  if (fun && !meta.courseId && !meta.title.trim()) return { error: "Name your category, like US States." };
  if (!meta.files.length && !meta.idea.trim() && !meta.chapterTitle.trim()) return { error: fun ? "Describe what the game should cover, or upload a file." : "Choose at least one file of notes, or describe what to build." };
  if (meta.files.length > MAX_FILES) return { error: `Upload up to ${MAX_FILES} files at a time.` };
  const bad = meta.files.find((f) => !OK_TYPE.test(f.name) || f.size > MAX_BYTES);
  if (bad) return { error: `${bad.name} can't be used. Upload PDF, Word, text or photos up to 25 MB each.` };

  const db = admin();
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await db.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= UPLOADS_PER_DAY) return { error: `You've hit today's limit of ${UPLOADS_PER_DAY} uploads. Try again tomorrow.` };

  const made = await ensureChapter(user, meta);
  if ("error" in made) return made;
  const { c, chapterId } = made;

  const up = await db.from("uploads").insert({ user_id: user.id, user_email: user.email, course_id: c.id, chapter_id: chapterId }).select("id").single();
  if (up.error) return { error: up.error.message };

  const files = [];
  for (const f of meta.files) {
    const path = `${chapterId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await db.storage.from("notes").createSignedUploadUrl(path);
    if (error) return { error: error.message };
    files.push({ name: f.name, path, token: data.token });
  }
  return { uploadId: up.data.id as string, files };
}


type Viewer = { id: string; email: string };

/** Finds or creates the student's course (and professor) and the chapter an upload goes into. */
async function ensureChapter(user: Viewer, meta: UploadMeta): Promise<{ c: Course; chapterId: string } | { error: string }> {
  const db = admin();
  const fun = meta.purpose === "fun";
  const code = fun ? "FUN" : meta.code.trim().toUpperCase().replace(/\s+/g, " ");
  if (meta.share) await ensureProfile(user.id, user.email, meta.authorName);
  const visibility = meta.share ? "public" : "private";

  // Class notes go into the student's own version of a course ("MATH 1 by kam"): one they pick, or one per course code.
  // Each for-fun upload is its own set.
  let course = null as Course | null;
  if (meta.courseId) {
    const { data } = await db.from("courses").select("*").eq("id", meta.courseId).eq("owner_id", user.id).maybeSingle();
    course = data as Course | null;
    if (!course || (course.kind === "fun") !== fun) return { error: fun ? "That category wasn't found in your categories." : "That course wasn't found in your courses." };
    if (course.visibility !== visibility) await db.from("courses").update({ visibility }).eq("id", course.id);
  } else if (!fun) {
    const { data } = await db.from("courses").select("*").eq("owner_id", user.id).eq("code", code).eq("kind", "class").maybeSingle();
    course = data as Course | null;
    if (course) {
      const patch: Record<string, unknown> = {};
      if (course.visibility !== visibility) patch.visibility = visibility;
      if (meta.professor.trim() && !course.professor) patch.professor = meta.professor.trim().slice(0, 60);
      if (Object.keys(patch).length) await db.from("courses").update(patch).eq("id", course.id);
    }
  } else {
    // For fun: a category (like "US States") holding several games (capitals, flags, locations…).
    const name = meta.title.trim().slice(0, 80);
    const { data } = await db.from("courses").select("*").eq("owner_id", user.id).eq("kind", "fun").ilike("title", name).maybeSingle();
    course = data as Course | null;
    if (course && course.visibility !== visibility) await db.from("courses").update({ visibility }).eq("id", course.id);
    if (!course) {
      const ins = await db.from("courses").insert({
        code, kind: "fun", visibility, title: name, slug: `${slugify(name)}-${rand()}`,
        owner_id: user.id, owner_email: user.email, published: true, description: "",
      }).select("*").single();
      if (ins.error) return { error: ins.error.message };
      course = ins.data as Course;
    }
  }
  if (!course) {
    const { data: official } = await db.from("courses").select("title").is("owner_id", null).eq("code", code).maybeSingle();
    const ins = await db.from("courses").insert({
      code, kind: "class", visibility, title: meta.title.trim() || official?.title || code, slug: `${slugify(code)}-${rand()}`,
      owner_id: user.id, owner_email: user.email, published: true, description: "", professor: meta.professor.trim().slice(0, 60) || null,
    }).select("*").single();
    if (ins.error) return { error: ins.error.message };
    course = ins.data as Course;
  }
  const c = course as Course;

  // Student courses don't split chapters by professor (the professor is a label on the course).
  const professorId: string | null = null;

  let number = fun ? 0 : Number(meta.number) || numberFromTitle(meta.chapterTitle);
  if (!number) {
    const { data: last } = await db.from("chapters").select("number").eq("course_id", c.id).order("number", { ascending: false }).limit(1).maybeSingle();
    number = (last?.number ?? 0) + 1;
  }
  let q = db.from("chapters").select("id").eq("course_id", c.id).eq("number", number);
  q = professorId ? q.eq("professor_id", professorId) : q.is("professor_id", null);
  const { data: ch } = await q.maybeSingle();
  let chapterId = ch?.id as string | undefined;
  if (!chapterId) {
    const ins = await db.from("chapters").insert({
      course_id: c.id, professor_id: professorId, number, title: meta.chapterTitle.trim() || (fun ? meta.idea.trim().slice(0, 60) || c.title : `Chapter ${number}`),
      instructions: [meta.idea.trim() && `What to build: ${meta.idea.trim()}`, meta.instructions.trim()].filter(Boolean).join("\n\n"), settings: DEFAULT_SETTINGS, published: false,
    }).select("id").single();
    if (ins.error) return { error: ins.error.message };
    chapterId = ins.data.id;
  } else if (meta.instructions.trim() || meta.idea.trim()) {
    await db.from("chapters").update({ instructions: [meta.idea.trim() && `What to build: ${meta.idea.trim()}`, meta.instructions.trim()].filter(Boolean).join("\n\n") }).eq("id", chapterId);
  }

  return { c, chapterId: chapterId! };
}

/**
 * "Paste a quiz": a set written in the upload format (see lib/import-format.ts), e.g. by asking Claude.
 * Published straight away. No Claude call, so it doesn't count toward the daily upload limit.
 */
export async function importSet(meta: UploadMeta, raw: string) {
  const user = await currentUser();
  if (!user) return { error: "Sign in to upload." };
  const fun = meta.purpose === "fun";
  if (!fun && !meta.courseId && !meta.code.trim()) return { error: "Add the course code, like MATH 1." };
  if (fun && !meta.courseId && !meta.title.trim()) return { error: "Name your category, like US States." };
  const parsed = parseImport(raw);
  if ("error" in parsed) return { error: parsed.error };
  const db = admin();
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await db.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= UPLOADS_PER_DAY * 6) return { error: "You've uploaded a lot today. Try again tomorrow." };

  const made = await ensureChapter(user, meta);
  if ("error" in made) return made;
  const { c, chapterId } = made;
  const settings = { ...parsed.settings, modes: finalModes(parsed.content, meta.extras, parsed.settings.modes) };
  const { data: cur } = await db.from("chapters").select("title").eq("id", chapterId).single();
  const title = parsed.title && cur && isGenericTitle(cur.title) ? parsed.title.trim().slice(0, 120) : undefined;
  await db.from("chapters").update({ content: parsed.content, settings, published: true, updated_at: new Date().toISOString(), ...(title ? { title } : {}) }).eq("id", chapterId);
  await db.from("uploads").insert({ user_id: user.id, user_email: user.email, course_id: c.id, chapter_id: chapterId, status: "ready", error: "pasted" });
  const { data: ch } = await db.from("chapters").select("number,professor_id").eq("id", chapterId).single();
  const { data: prof } = ch?.professor_id ? await db.from("professors").select("slug").eq("id", ch.professor_id).single() : { data: null };
  return { href: `/courses/${c.slug}/${prof?.slug ?? "all"}/${ch?.number ?? 1}` };
}

/** Step 2: after the files are in storage, have Claude build (or add to) the chapter's study set. */
export async function finishUpload(uploadId: string, files: { name: string; path: string; mime: string; size: number }[], study: Pick<UploadMeta, "extras" | "studyIdea"> & { autoNumber?: boolean } = {}) {
  const user = await currentUser();
  if (!user) return { error: "Your sign-in expired. Sign in again and retry." };
  const db = admin();
  const { data: up } = await db.from("uploads").select("*").eq("id", uploadId).eq("user_id", user.id).maybeSingle();
  if (!up?.chapter_id) return { error: "That upload wasn't found." };

  const fail = async (msg: string) => { await db.from("uploads").update({ status: "failed", error: msg }).eq("id", uploadId); return { error: msg }; };
  try {
    const okPaths = files.filter((f) => f.path.startsWith(`${up.chapter_id}/`));
    if (okPaths.length) await db.from("notes").insert(okPaths.map((f) => ({ chapter_id: up.chapter_id, name: f.name, path: f.path, mime: f.mime, size: f.size })));

    const { data: chRow } = await db.from("chapters").select("*").eq("id", up.chapter_id).single();
    const { data: course } = await db.from("courses").select("*").eq("id", chRow.course_id).single();
    const chapter: Chapter = { ...chRow, content: normalizeContent(chRow.content), settings: normalizeSettings(chRow.settings) };
    const [professor, notes] = await Promise.all([adminGetProfessor(chapter.professor_id), adminListNotes(chapter.id)]);
    const hasContent = chapter.content.terms.length + chapter.content.questions.length > 0;

    const extra = studyRequest({ extras: study.extras, studyIdea: study.studyIdea } as UploadMeta);
    const result = await generateStudySet({
      course: course as Course, professor, chapter,
      notes: hasContent ? notes.filter((n) => okPaths.some((f) => f.path === n.path)) : notes,
      request: extra + "\n\n" + ((course as Course).kind === "fun"
        ? "This is a for-fun study game a student made. If no notes are attached, build it from accurate general knowledge about the topic in the instructions. Keep it fun but correct. Leave journal entries empty unless the topic is accounting."
        : notes.length ? "This study set is built from a student's own uploaded class notes." : "No notes were attached: build the set from accurate general knowledge of the topic in the instructions, at a college level."),
      mode: hasContent ? "add" : "replace", allowSettingsChanges: false, chooseModes: true,
    });
    const settings = normalizeSettings({ ...(result.settings ?? chapter.settings), modes: finalModes(result.content, study.extras, result.settings?.modes), v: 2 });
    // "Ch. 3" typed by the student + "Chapter 3: Linear Algebra" in the notes -> use the notes' full title.
    const patch: Record<string, unknown> = { content: result.content, settings, published: true, updated_at: new Date().toISOString() };
    if (!hasContent && result.chapterTitle && isGenericTitle(chapter.title)) patch.title = result.chapterTitle;
    await db.from("chapters").update(patch).eq("id", chapter.id);
    if (!hasContent && study.autoNumber && result.chapterNumber && result.chapterNumber !== chapter.number && (course as Course).kind !== "fun") {
      const { error } = await db.from("chapters").update({ number: result.chapterNumber }).eq("id", chapter.id);
      if (!error) chapter.number = result.chapterNumber; // a clash with an existing chapter number just keeps the old one
    }
    await db.from("uploads").update({ status: "ready" }).eq("id", uploadId);

    const { data: prof } = chapter.professor_id ? await db.from("professors").select("slug").eq("id", chapter.professor_id).single() : { data: null };
    return { href: `/courses/${course.slug}/${prof?.slug ?? "all"}/${chapter.number}`, note: result.changeNote };
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Claude couldn't build the study set. Try again.");
  }
}

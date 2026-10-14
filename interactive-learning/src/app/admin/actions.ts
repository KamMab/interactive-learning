"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { admin } from "@/lib/db";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/admin-auth";
import { slugify } from "@/lib/id";
import {
  DEFAULT_SETTINGS,
  normalizeContent,
  normalizeSettings,
  type ChapterContent,
  type ChapterSettings,
} from "@/lib/types";

// ---------- Session ----------

export async function login(_: unknown, form: FormData) {
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "Wrong password." };
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

// ---------- Courses ----------

export async function createCourse(form: FormData) {
  await requireAdmin();
  const code = String(form.get("code") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  if (!code || !title) return;
  const { data, error } = await admin()
    .from("courses")
    .insert({ code, title, slug: slugify(code) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/admin/courses/${data.id}`);
}

export async function updateCourse(id: string, form: FormData) {
  await requireAdmin();
  const code = String(form.get("code") ?? "").trim();
  const { error } = await admin()
    .from("courses")
    .update({
      code,
      title: String(form.get("title") ?? "").trim(),
      slug: slugify(String(form.get("slug") || code)),
      description: String(form.get("description") ?? ""),
      instructions: String(form.get("instructions") ?? ""),
      sort: Number(form.get("sort") ?? 0),
      published: form.get("published") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteCourse(id: string) {
  await requireAdmin();
  await removeNotesFor((await admin().from("chapters").select("id").eq("course_id", id)).data?.map((c) => c.id) ?? []);
  await admin().from("courses").delete().eq("id", id);
  redirect("/admin");
}

// ---------- Professors ----------

export async function createProfessor(courseId: string, form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const base = slugify(name.replace(/^(prof(essor)?\.?|dr\.?)\s+/i, "")) || "professor";
  const { data: taken } = await admin().from("professors").select("slug").eq("course_id", courseId);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug) || slug === "all"; i++) slug = `${base}-${i}`;
  const { error } = await admin().from("professors").insert({
    course_id: courseId, name, slug, instructions: String(form.get("instructions") ?? ""), sort: used.size,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function updateProfessor(id: string, form: FormData) {
  await requireAdmin();
  const { error } = await admin().from("professors").update({
    name: String(form.get("name") ?? "").trim(),
    instructions: String(form.get("instructions") ?? ""),
    published: form.get("published") === "on",
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteProfessor(id: string) {
  await requireAdmin();
  const { data: p } = await admin().from("professors").select("course_id").eq("id", id).maybeSingle();
  await removeNotesFor((await admin().from("chapters").select("id").eq("professor_id", id)).data?.map((c) => c.id) ?? []);
  await admin().from("professors").delete().eq("id", id);
  revalidatePath("/", "layout");
  if (p) redirect(`/admin/courses/${p.course_id}`);
}

// ---------- Chapters ----------

export async function createChapter(courseId: string, form: FormData) {
  await requireAdmin();
  const professorId = String(form.get("professor_id") || "") || null;
  let lastQ = admin().from("chapters").select("number").eq("course_id", courseId);
  lastQ = professorId ? lastQ.eq("professor_id", professorId) : lastQ.is("professor_id", null);
  const { data: last } = await lastQ.order("number", { ascending: false }).limit(1).maybeSingle();
  const number = Number(form.get("number")) || (last?.number ?? 0) + 1;
  const title = String(form.get("title") ?? "").trim() || `Chapter ${number}`;
  const { data, error } = await admin()
    .from("chapters")
    .insert({ course_id: courseId, professor_id: professorId, number, title, settings: DEFAULT_SETTINGS })
    .select("id")
    .single();
  if (error) throw new Error(error.message.includes("chapters_course_prof_number") ? `Chapter ${number} already exists for that professor.` : error.message);
  redirect(`/admin/chapters/${data.id}`);
}

export type ChapterSave = {
  professor_id: string | null;
  title: string;
  number: number;
  instructions: string;
  published: boolean;
  content: ChapterContent;
  settings: ChapterSettings;
};

export async function saveChapter(id: string, input: ChapterSave) {
  await requireAdmin();
  const { error } = await admin()
    .from("chapters")
    .update({
      professor_id: input.professor_id,
      title: input.title.trim(),
      number: input.number,
      instructions: input.instructions,
      published: input.published,
      content: normalizeContent(input.content),
      settings: normalizeSettings(input.settings),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message.includes("chapters_course_prof_number") ? "Another chapter already uses that number for this professor." : error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteChapter(id: string, courseId: string) {
  await requireAdmin();
  await removeNotesFor([id]);
  await admin().from("chapters").delete().eq("id", id);
  redirect(`/admin/courses/${courseId}`);
}

// ---------- Notes (files go straight from the browser to storage) ----------

export async function createNoteUpload(chapterId: string, fileName: string) {
  await requireAdmin();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${chapterId}/${Date.now()}-${safe}`;
  const { data, error } = await admin().storage.from("notes").createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { path, token: data.token };
}

export async function recordNote(chapterId: string, note: { name: string; path: string; mime: string; size: number }) {
  await requireAdmin();
  const { data, error } = await admin().from("notes").insert({ chapter_id: chapterId, ...note }).select("*").single();
  if (error) return { error: error.message };
  return { note: data };
}

export async function deleteNote(id: string) {
  await requireAdmin();
  const { data } = await admin().from("notes").select("path").eq("id", id).maybeSingle();
  if (data?.path) await admin().storage.from("notes").remove([data.path]);
  await admin().from("notes").delete().eq("id", id);
  return { ok: true };
}

async function removeNotesFor(chapterIds: string[]) {
  if (!chapterIds.length) return;
  const { data } = await admin().from("notes").select("path").in("chapter_id", chapterIds);
  const paths = (data ?? []).map((n) => n.path);
  if (paths.length) await admin().storage.from("notes").remove(paths);
}

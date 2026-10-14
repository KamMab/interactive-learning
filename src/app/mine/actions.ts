"use server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";

/** True when the signed-in student owns the course this chapter belongs to. */
async function ownsChapter(userId: string, chapterId: string) {
  const db = admin();
  const { data: ch } = await db.from("chapters").select("course_id").eq("id", chapterId).maybeSingle();
  if (!ch) return null;
  const { data: c } = await db.from("courses").select("id,owner_id").eq("id", ch.course_id).maybeSingle();
  return c?.owner_id === userId ? (c.id as string) : null;
}

/** Deletes one uploaded notes file. The study set Claude already built from it stays. */
export async function deleteMyNote(noteId: string) {
  const user = await currentUser();
  if (!user) return { error: "Sign in first." };
  const db = admin();
  const { data: note } = await db.from("notes").select("id,path,chapter_id").eq("id", noteId).maybeSingle();
  if (!note || !(await ownsChapter(user.id, note.chapter_id))) return { error: "That file wasn't found." };
  await db.storage.from("notes").remove([note.path]);
  await db.from("notes").delete().eq("id", noteId);
  revalidatePath("/mine");
  return { ok: true };
}

/** Deletes a whole study set: the chapter, its notes files, and the course if nothing else is left in it. */
export async function deleteMySet(chapterId: string) {
  const user = await currentUser();
  if (!user) return { error: "Sign in first." };
  const courseId = await ownsChapter(user.id, chapterId);
  if (!courseId) return { error: "That study set wasn't found." };
  const db = admin();
  const { data: notes } = await db.from("notes").select("path").eq("chapter_id", chapterId);
  const paths = (notes ?? []).map((n: { path: string }) => n.path);
  if (paths.length) await db.storage.from("notes").remove(paths);
  await db.from("chapters").delete().eq("id", chapterId);
  const { count } = await db.from("chapters").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  if (!count) await db.from("courses").delete().eq("id", courseId);
  revalidatePath("/mine");
  revalidatePath("/");
  return { ok: true };
}

/** The owner edits their course (or for-fun category): code, name, professor, who can see it. */
export async function updateMyCourse(courseId: string, input: { code?: string; title: string; professor?: string; visibility: "public" | "private" }) {
  const user = await currentUser();
  if (!user) return { error: "Sign in first." };
  const db = admin();
  const { data: c } = await db.from("courses").select("id,owner_id,kind,slug").eq("id", courseId).maybeSingle();
  if (!c || c.owner_id !== user.id) return { error: "That course wasn't found." };
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 80);
  if (title.length < 2) return { error: c.kind === "fun" ? "Give the category a name." : "Give the course a name." };
  const patch: Record<string, unknown> = { title, visibility: input.visibility === "private" ? "private" : "public" };
  if (c.kind !== "fun") {
    const code = (input.code ?? "").trim().toUpperCase().replace(/\s+/g, " ").slice(0, 20);
    if (code.length < 2) return { error: "Add the course code, like MATH 1." };
    patch.code = code;
    patch.professor = (input.professor ?? "").trim().slice(0, 60) || null;
  }
  const { error } = await db.from("courses").update(patch).eq("id", courseId);
  if (error) return { error: error.message };
  revalidatePath(`/courses/${c.slug}`); revalidatePath("/library"); revalidatePath("/");
  return { ok: true };
}

/** The owner renames or renumbers one of their chapters (or games). */
export async function updateMyChapter(chapterId: string, input: { title: string }) {
  const user = await currentUser();
  if (!user) return { error: "Sign in first." };
  if (!(await ownsChapter(user.id, chapterId))) return { error: "That chapter wasn't found." };
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 120);
  if (title.length < 1) return { error: "Give it a name." };
  // "Ch. 13 …" also sets the chapter's number (its order and web address).
  const m = title.match(/^\s*(?:ch(?:apter)?|unit|week|lecture|module)\.?\s*(\d{1,3})\b/i);
  const patch: Record<string, unknown> = { title };
  if (m && Number(m[1]) >= 1) patch.number = Number(m[1]);
  const { error } = await admin().from("chapters").update(patch).eq("id", chapterId);
  if (error) return { error: error.message.includes("chapters_course_prof_number") ? `Chapter ${patch.number} already exists in this course.` : error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Splits one of your chapters (or, for the admin, any chapter) into topics using Claude. */
export async function splitIntoTopics(chapterId: string) {
  const user = await currentUser();
  const { isAdmin } = await import("@/lib/admin-auth");
  const adminOk = await isAdmin();
  if (!adminOk && (!user || !(await ownsChapter(user.id, chapterId)))) return { error: "Only the person who made this chapter can do that." };
  const db = admin();
  const { data: ch } = await db.from("chapters").select("title,content").eq("id", chapterId).maybeSingle();
  if (!ch) return { error: "That chapter wasn't found." };
  const { normalizeContent } = await import("@/lib/types");
  const { assignTopics } = await import("@/lib/claude");
  try {
    const content = await assignTopics(normalizeContent(ch.content), ch.title);
    await db.from("chapters").update({ content, updated_at: new Date().toISOString() }).eq("id", chapterId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Claude couldn't split it. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

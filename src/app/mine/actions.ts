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

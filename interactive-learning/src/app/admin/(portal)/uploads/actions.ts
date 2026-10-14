"use server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function hideStudentSet(id: string) {
  await requireAdmin();
  await admin().from("courses").update({ visibility: "private" }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function showStudentSet(id: string) {
  await requireAdmin();
  await admin().from("courses").update({ visibility: "public" }).eq("id", id);
  revalidatePath("/", "layout");
}

/** Moves a student's class set into the official library (it stops being theirs). */
export async function makeOfficial(id: string) {
  await requireAdmin();
  await admin().from("courses").update({ owner_id: null, visibility: "public", published: false }).eq("id", id);
  revalidatePath("/", "layout");
}

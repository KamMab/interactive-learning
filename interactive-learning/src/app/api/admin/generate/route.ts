import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { adminGetChapter, adminGetCourse, adminGetProfessor, adminListNotes } from "@/lib/db";
import { generateStudySet } from "@/lib/claude";
import { normalizeContent, normalizeSettings } from "@/lib/types";

export const maxDuration = 300; // Claude can take a minute or two on long notes

// Returns a draft. Nothing is saved until the admin reviews it and clicks Save.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json();
    const chapter = await adminGetChapter(body.chapterId);
    if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    const course = await adminGetCourse(chapter.course_id);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    const notes = await adminListNotes(chapter.id);

    // Use the editor's unsaved state so "revise" works on what the admin is looking at.
    if (body.content) chapter.content = normalizeContent(body.content);
    if (body.settings) chapter.settings = normalizeSettings(body.settings);
    if (typeof body.instructions === "string") chapter.instructions = body.instructions;
    if (body.professorId !== undefined) chapter.professor_id = body.professorId || null;
    const professor = await adminGetProfessor(chapter.professor_id);

    const mode = ["replace", "add", "revise"].includes(body.mode) ? body.mode : "replace";
    if (mode !== "revise" && notes.length === 0 && !body.request) {
      return NextResponse.json({ error: "Upload notes or type instructions first." }, { status: 400 });
    }

    const result = await generateStudySet({
      course,
      professor,
      chapter,
      notes,
      request: String(body.request ?? ""),
      mode,
      allowSettingsChanges: Boolean(body.allowSettingsChanges),
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Generation failed" }, { status: 500 });
  }
}

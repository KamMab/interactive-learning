import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetChapter, adminGetCourse, adminListNotes, adminListProfessors } from "@/lib/db";
import ChapterEditor from "@/components/admin/ChapterEditor";

export default async function AdminChapter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chapter = await adminGetChapter(id);
  if (!chapter) notFound();
  const [course, notes, professors] = await Promise.all([adminGetCourse(chapter.course_id), adminListNotes(id), adminListProfessors(chapter.course_id)]);
  if (!course) notFound();
  return (
    <div>
      <Link href={`/admin/courses/${course.id}`} className="text-sm text-muted hover:text-accent">← {course.code}</Link>
      <ChapterEditor
        chapter={chapter}
        notes={notes}
        courseSlug={course.slug}
        professors={professors}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </div>
  );
}

import { redirect } from "next/navigation";

// Courses now go straight to their chapters, so old professor links land on the course page.
export default async function ProfessorChapters({ params }: { params: Promise<{ course: string; prof: string }> }) {
  const { course } = await params;
  redirect(`/courses/${course}`);
}

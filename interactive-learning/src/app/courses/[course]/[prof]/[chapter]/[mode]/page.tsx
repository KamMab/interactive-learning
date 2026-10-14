import { redirect } from "next/navigation";

// Older links went to a separate page per mode. Every mode now lives on the chapter page.
export default async function ModeRedirect({ params }: { params: Promise<{ course: string; prof: string; chapter: string; mode: string }> }) {
  const { course, prof, chapter, mode } = await params;
  redirect(`/courses/${course}/${prof}/${chapter}?mode=${encodeURIComponent(mode)}`);
}

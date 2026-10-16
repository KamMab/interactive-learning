import { notFound } from "next/navigation";
import { adminGetChapter, adminGetCourse } from "@/lib/db";
import { roomChapter } from "@/lib/rooms";
import { cleanCode } from "@/lib/same";
import RoomClient from "@/components/same/RoomClient";
import JoinBox from "@/components/same/JoinBox";

export const dynamic = "force-dynamic";

// A live game or challenge someone joined with a code.
export default async function PlayRoom({ params }: { params: Promise<{ code: string }> }) {
  const code = cleanCode((await params).code);
  if (!code) notFound();
  let chapterId: string | null = null;
  try { chapterId = await roomChapter(code); } catch (e) {
    return <div className="mx-auto flex max-w-xl flex-col gap-4"><p className="fb bad"><strong>Games with codes aren&apos;t ready yet</strong><br />{e instanceof Error ? e.message : ""}</p></div>;
  }
  const chapter = chapterId ? await adminGetChapter(chapterId) : null;
  const course = chapter ? await adminGetCourse(chapter.course_id) : null;
  if (!chapter || !course) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className="fb bad"><strong>No game with the code {code}</strong><br />Check the code with whoever shared it, then try again.</p>
        <JoinBox big />
      </div>
    );
  }
  return <RoomClient code={code} set={chapter.content.same} chapterId={chapter.id} title={chapter.title} href={`/courses/${course.slug}/all/${chapter.number}`} />;
}

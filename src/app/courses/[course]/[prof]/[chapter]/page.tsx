import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { getCourseBySlug, getProfessorBySlug, getProfile, listChapters } from "@/lib/db";
import ChapterStudy from "@/components/ChapterStudy";
import { chapterLabel, usableSections } from "@/lib/types";
import SplitTopics from "@/components/SplitTopics";
import ShareButton from "@/components/ShareButton";
import LiveQuizButton from "@/components/same/LiveQuizButton";
import { quizPool } from "@/lib/quizpool";
import Summary from "@/components/Summary";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string; prof: string; chapter: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { course: slug, prof: profSlug, chapter: num } = await params;
  const sp = await searchParams;
  const viewer = await currentUser(), adminOn = await isAdmin();
  const course = await getCourseBySlug(slug, viewer, adminOn);
  if (!course) notFound();
  const prof = await getProfessorBySlug(course.id, profSlug);
  if (!prof) notFound();
  // "all" finds the chapter whoever it was written for (shared version first).
  const chapters = await listChapters(course.id);
  const matches = chapters.filter((c) => c.number === Number(num) && (prof === "all" || c.professor_id === prof.id || c.professor_id === null));
  const chapter = (prof === "all" ? matches.find((c) => c.professor_id === null) : matches.find((c) => c.professor_id === prof.id)) ?? matches[0];
  if (!chapter) notFound();
  // Which professor's notes this is built from: the chapter's own professor, or the course's.
  const teacher = prof !== "all" ? prof.name : course.professor ?? "";
  const who = teacher ? ` · ${teacher}` : "";
  const author = course.owner_id ? await getProfile(course.owner_id) : null;
  const fun = course.kind === "fun";
  const shown = chapterLabel(chapter);
  const livePool = quizPool(chapter.content).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/courses/${course.slug}`} className="link">{fun ? course.title : course.code}{author ? ` by ${author.display_name}` : ""}</Link>
        <span className="eyebrow mt-4 block">{fun ? `For fun · ${course.title}` : `${course.code} · Chapter ${shown.num}`}</span>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="big mt-2 min-w-0">{fun ? chapter.title : shown.title}</h1>
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {!chapter.content.same && !chapter.content.math && livePool >= 3 && <LiveQuizButton chapterId={chapter.id} available={livePool} />}
            <ShareButton title={fun ? `${chapter.title} (${course.title})` : `${course.code} · Ch. ${shown.num} ${shown.title}`} isPrivate={course.visibility === "private"} />
          </div>
        </div>
        {!fun && teacher && <p className="mt-2 text-[18px] font-bold">{teacher}&apos;s notes</p>}
        <p className="mt-2 text-sm text-muted">
          {course.owner_id
            ? author && course.visibility === "public"
              ? <>Published by <Link href={`/u/${author.handle}`} className="font-bold underline">{author.display_name}</Link> · <Link href={`/u/${author.handle}`} className="underline">More from {author.display_name.split(" ")[0]}</Link></>
              : <>Only you can see this set.</>
            : <>From the Interactive Learning library</>}
        </p>
        {chapter.content.summary && <Summary text={chapter.content.summary} />}
        {(adminOn || (viewer && course.owner_id === viewer.id)) && course.kind !== "fun" && usableSections(chapter.content).length < 2
          && chapter.content.terms.length + chapter.content.questions.length >= 12 && <div className="mt-4"><SplitTopics chapterId={chapter.id} /></div>}
      </div>
      <ChapterStudy chapter={chapter} label={`${course.code}${who} · Ch. ${shown.num} ${shown.title}`}
        initialMode={typeof sp.mode === "string" ? sp.mode : undefined}
        initialSection={typeof sp.section === "string" ? sp.section : undefined} />
    </div>
  );
}

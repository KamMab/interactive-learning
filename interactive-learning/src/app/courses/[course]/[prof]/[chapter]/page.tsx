import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { getCourseBySlug, getProfessorBySlug, getProfile, listChapters } from "@/lib/db";
import ChapterStudy from "@/components/ChapterStudy";
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
  const course = await getCourseBySlug(slug, await currentUser(), await isAdmin());
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/courses/${course.slug}`} className="link">{fun ? course.title : course.code}{author ? ` by ${author.display_name}` : ""}</Link>
        <span className="eyebrow mt-4 block">{fun ? `For fun · ${course.title}` : `${course.code} · Chapter ${chapter.number}`}</span>
        <h1 className="big mt-2">{chapter.title}</h1>
        {!fun && teacher && <p className="mt-2 text-[18px] font-bold">{teacher}&apos;s notes</p>}
        <p className="mt-2 text-sm text-muted">
          {course.owner_id
            ? author && course.visibility === "public"
              ? <>Published by <Link href={`/u/${author.handle}`} className="font-bold underline">{author.display_name}</Link> · <Link href={`/u/${author.handle}`} className="underline">More from {author.display_name.split(" ")[0]}</Link></>
              : <>Only you can see this set.</>
            : <>From the Interactive Learning library</>}
        </p>
        {chapter.content.summary && <Summary text={chapter.content.summary} />}
      </div>
      <ChapterStudy chapter={chapter} label={`${course.code}${who} · Ch. ${chapter.number} ${chapter.title}`}
        initialMode={typeof sp.mode === "string" ? sp.mode : undefined}
        initialSection={typeof sp.section === "string" ? sp.section : undefined} />
    </div>
  );
}

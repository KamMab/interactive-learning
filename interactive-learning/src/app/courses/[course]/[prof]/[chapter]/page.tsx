import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { getChapter, getCourseBySlug, getProfessorBySlug, getProfile } from "@/lib/db";
import ChapterStudy from "@/components/ChapterStudy";

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
  const chapter = await getChapter(course.id, prof === "all" ? null : prof.id, Number(num));
  if (!chapter) notFound();
  const who = prof === "all" ? "" : ` · ${prof.name}`;
  const author = course.owner_id ? await getProfile(course.owner_id) : null;
  const fun = course.kind === "fun";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/courses/${course.slug}`} className="link">{course.code}</Link>
          {prof !== "all" && <><span className="text-muted">/</span><Link href={`/courses/${course.slug}/${profSlug}`} className="link">{prof.name}</Link></>}
        </div>
        <span className="eyebrow mt-4 block">{fun ? "For fun" : `${course.code}${who} · Chapter ${chapter.number}`}</span>
        <h1 className="big mt-2">{chapter.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {course.owner_id
            ? author && course.visibility === "public"
              ? <>Published by <Link href={`/u/${author.handle}`} className="font-bold underline">{author.display_name}</Link> · <Link href={`/u/${author.handle}`} className="underline">More from {author.display_name.split(" ")[0]}</Link></>
              : <>Only you can see this set.</>
            : <>From the Interactive Learning library</>}
        </p>
        {chapter.content.summary && <p className="mt-2 max-w-[60ch] text-muted">{chapter.content.summary}</p>}
      </div>
      <ChapterStudy chapter={chapter} label={`${course.code}${who} · Ch. ${chapter.number} ${chapter.title}`}
        initialMode={typeof sp.mode === "string" ? sp.mode : undefined} />
    </div>
  );
}

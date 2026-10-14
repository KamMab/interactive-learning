import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { adminListChapters, getCourseBySlug, getProfile, listChapters, listProfessors, otherVersions } from "@/lib/db";
import { AUTH_ENABLED, hasSupabase } from "@/lib/config";
import { ALL_PROFS, usableSections } from "@/lib/types";
import CourseShelf from "@/components/CourseShelf";
import CourseEditor from "@/components/CourseEditor";

export const dynamic = "force-dynamic";

// A course (or for-fun category) goes straight to its chapters (or games). Each student's course is their own
// version ("MGMT 120B by kammab"); anyone can start their own version without touching this one.
export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const user = await currentUser();
  const course = await getCourseBySlug(slug, user, await isAdmin());
  if (!course) notFound();
  const fun = course.kind === "fun";
  const mine = !!user && course.owner_id === user.id;
  const [chapters, profs, author, others, all] = await Promise.all([
    listChapters(course.id), listProfessors(course.id),
    course.owner_id ? getProfile(course.owner_id) : Promise.resolve(null),
    fun ? Promise.resolve([]) : otherVersions(course.code, course.id),
    mine && hasSupabase() ? adminListChapters(course.id) : Promise.resolve([]),
  ]);
  const profSlug = new Map(profs.map((p) => [p.id, p.slug]));
  const profName = new Map(profs.map((p) => [p.id, p.name]));
  const canUpload = AUTH_ENABLED && hasSupabase();
  const versionHref = fun ? "/upload?new=1&fun=1" : `/upload?new=1&code=${encodeURIComponent(course.code)}&title=${encodeURIComponent(course.title)}`;
  const addHref = `/upload?course=${course.id}${fun ? "&fun=1" : ""}`;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link href={fun ? "/games" : "/library"} className="link">{fun ? "All games" : "All courses"}</Link>
        <span className="eyebrow mt-4 block">{fun ? "For fun · Category" : course.code}</span>
        <h1 className="big mt-2">{course.title}</h1>
        {!fun && course.professor && <p className="mt-2 text-[18px] font-bold">Taught by {course.professor}</p>}
        <p className="mt-2 text-sm text-muted">
          {course.owner_id
            ? <>By {author ? <Link href={`/u/${author.handle}`} className="font-bold underline">{author.display_name}</Link> : "a student"}{course.visibility === "private" ? ` · only you can see this ${fun ? "category" : "course"}` : ""}</>
            : <>From the Interactive Learning library</>}
        </p>
      </div>

      {canUpload && (
        <div className="flex flex-wrap items-start gap-2">
          {mine ? (
            <>
              <Link href={addHref} className="btn">+ Add {fun ? "a game" : "a chapter"}</Link>
              <CourseEditor
                course={{ id: course.id, kind: fun ? "fun" : "class", code: course.code, title: course.title, professor: course.professor ?? null, visibility: course.visibility === "private" ? "private" : "public" }}
                chapters={all.map((c) => ({ id: c.id, number: c.number, title: c.title }))} />
            </>
          ) : (
            <Link href={user ? versionHref : `/signin?next=${encodeURIComponent(versionHref)}`} className="btn-ghost">{fun ? "Make your own category" : "Make your own version"}</Link>
          )}
        </div>
      )}

      <div className="shelf">
        {chapters.map((ch) => {
          const secs = usableSections(ch.content).length;
          const href = `/courses/${course.slug}/${ch.professor_id ? profSlug.get(ch.professor_id) ?? ALL_PROFS : ALL_PROFS}/${ch.number}`;
          return (
            <Link key={ch.id} href={href} className="book">
              {fun
                ? <div className="book-cover fun"><span className="eyebrow">Game</span><span className="ttl text-[24px]">{ch.title}</span></div>
                : <div className="book-cover"><span className="eyebrow">Chapter</span><span className="num">{ch.number}</span><span className="ttl">{ch.title}</span></div>}
              <div className="book-body">
                {ch.content.map?.items.length ? <><b>{ch.content.map.items.length}</b> places · </> : null}
                <b>{ch.content.terms.length}</b> {fun ? "cards" : "terms"} · <b>{ch.content.questions.length}</b> questions
                {secs > 1 && <> · <b>{secs}</b> sections</>}
                {ch.professor_id && profName.get(ch.professor_id) && <><br />For {profName.get(ch.professor_id)}</>}
              </div>
            </Link>
          );
        })}
        {chapters.length === 0 && <p className="text-muted">Nothing here yet.{mine ? ` Add your first ${fun ? "game" : "chapter"} above.` : ""}</p>}
      </div>

      {others.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[22px] font-bold">Other versions of {course.code}</h2>
          <CourseShelf courses={others} />
        </section>
      )}
    </div>
  );
}

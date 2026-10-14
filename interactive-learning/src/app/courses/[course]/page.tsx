import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound, redirect } from "next/navigation";
import { getCourseBySlug, getProfile, listChapters, listProfessors, otherVersions } from "@/lib/db";
import { AUTH_ENABLED, hasSupabase } from "@/lib/config";
import { ALL_PROFS, usableSections } from "@/lib/types";
import CourseShelf from "@/components/CourseShelf";

export const dynamic = "force-dynamic";

// A course goes straight to its chapters. Each student's course is their own version ("MGMT 120B by kammab");
// anyone can start their own version of the same course without touching this one.
export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const user = await currentUser();
  const course = await getCourseBySlug(slug, user, await isAdmin());
  if (!course) notFound();
  if (course.kind === "fun") redirect(`/courses/${course.slug}/${ALL_PROFS}/1`);
  const [chapters, profs, author, others] = await Promise.all([
    listChapters(course.id), listProfessors(course.id),
    course.owner_id ? getProfile(course.owner_id) : Promise.resolve(null),
    otherVersions(course.code, course.id),
  ]);
  const profSlug = new Map(profs.map((p) => [p.id, p.slug]));
  const profName = new Map(profs.map((p) => [p.id, p.name]));
  const mine = !!user && course.owner_id === user.id;
  const canUpload = AUTH_ENABLED && hasSupabase();
  const versionHref = `/upload?new=1&code=${encodeURIComponent(course.code)}&title=${encodeURIComponent(course.title)}`;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link href="/library" className="link">All courses</Link>
        <span className="eyebrow mt-4 block">{course.code}{course.professor ? ` · ${course.professor}` : ""}</span>
        <h1 className="big mt-2">{course.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {course.owner_id
            ? <>By {author ? <Link href={`/u/${author.handle}`} className="font-bold underline">{author.display_name}</Link> : "a student"}{course.visibility === "private" ? " · only you can see this course" : ""}</>
            : <>From the Interactive Learning library</>}
        </p>
      </div>

      {canUpload && (
        <div className="flex flex-wrap gap-2">
          {mine
            ? <Link href={`/upload?course=${course.id}`} className="btn">+ Add a chapter</Link>
            : <Link href={user ? versionHref : `/signin?next=${encodeURIComponent(versionHref)}`} className="btn-ghost">Make your own version</Link>}
        </div>
      )}

      <div className="shelf">
        {chapters.map((ch) => {
          const secs = usableSections(ch.content).length;
          return (
            <Link key={ch.id} href={`/courses/${course.slug}/${ch.professor_id ? profSlug.get(ch.professor_id) ?? ALL_PROFS : ALL_PROFS}/${ch.number}`} className="book">
              <div className="book-cover"><span className="eyebrow">Chapter</span><span className="num">{ch.number}</span><span className="ttl">{ch.title}</span></div>
              <div className="book-body">
                <b>{ch.content.terms.length}</b> terms · <b>{ch.content.questions.length}</b> questions
                {secs > 1 && <> · <b>{secs}</b> sections</>}
                {ch.professor_id && profName.get(ch.professor_id) && <><br />For {profName.get(ch.professor_id)}</>}
              </div>
            </Link>
          );
        })}
        {chapters.length === 0 && <p className="text-muted">No chapters yet.{mine ? " Add your first one above." : ""}</p>}
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

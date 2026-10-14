import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import { getCourseBySlug, getProfessorBySlug, listChapters, listProfessors } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProfessorChapters({ params }: { params: Promise<{ course: string; prof: string }> }) {
  const { course: slug, prof: profSlug } = await params;
  const course = await getCourseBySlug(slug, await currentUser(), await isAdmin());
  if (!course) notFound();
  const prof = await getProfessorBySlug(course.id, profSlug);
  if (!prof) notFound();
  const professorId = prof === "all" ? null : prof.id;
  const [chapters, profs] = await Promise.all([listChapters(course.id, professorId), listProfessors(course.id)]);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="link">All courses</Link>
          {profs.length > 0 && <><span className="text-muted">/</span><Link href={`/courses/${course.slug}`} className="link">{course.code} professors</Link></>}
        </div>
        <span className="eyebrow mt-4 block">{course.code}{prof !== "all" ? ` · ${prof.name}` : ""}</span>
        <h1 className="big mt-2">{course.title}</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          {prof === "all" ? course.description || "Pick a chapter to study." : `Chapters built for ${prof.name}'s class. Pick one to study.`}
        </p>
      </div>
      {course.owner_id && (
        <p className="tag ok self-start">Your private course, built from notes you uploaded · <Link href="/upload" className="underline">Add more notes</Link></p>
      )}
      <div className="shelf">
        {chapters.map((ch) => (
          <Link key={ch.id} href={`/courses/${course.slug}/${profSlug}/${ch.number}`} className="book">
            <div className="book-cover"><span className="eyebrow">Chapter</span><span className="num">{ch.number}</span><span className="ttl">{ch.title}</span></div>
            <div className="book-body">
              <b>{ch.content.terms.length}</b> terms · <b>{ch.content.questions.length}</b> questions
              {ch.content.entries.length > 0 && <> · <b>{ch.content.entries.length}</b> entries</>}
              {prof !== "all" && ch.professor_id === null && <><br />Shared by every professor</>}
            </div>
          </Link>
        ))}
        {chapters.length === 0 && <p className="text-muted">No chapters published for this professor yet.</p>}
      </div>
    </div>
  );
}

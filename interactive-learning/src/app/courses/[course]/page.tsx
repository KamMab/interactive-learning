import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/admin-auth";
import { notFound, redirect } from "next/navigation";
import { getCourseBySlug, listChapters, listProfessors } from "@/lib/db";
import { ALL_PROFS } from "@/lib/types";

export const dynamic = "force-dynamic";

const initials = (name: string) =>
  name.replace(/^(prof(essor)?\.?|dr\.?)\s+/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Step 1 after picking a course: pick who teaches it, so the chapters match how that professor tests.
export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const course = await getCourseBySlug(slug, await currentUser(), await isAdmin());
  if (!course) notFound();
  if (course.kind === "fun") redirect(`/courses/${course.slug}/${ALL_PROFS}/1`);
  const [profs, all] = await Promise.all([listProfessors(course.id), listChapters(course.id)]);
  if (profs.length === 0) redirect(`/courses/${course.slug}/${ALL_PROFS}`);

  const shared = all.filter((c) => c.professor_id === null).length;
  const count = (id: string) => new Set(all.filter((c) => c.professor_id === id || c.professor_id === null).map((c) => c.number)).size;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link href="/" className="link">All courses</Link>
        <span className="eyebrow mt-4 block">{course.code}</span>
        <h1 className="big mt-2">{course.title}</h1>
        <p className="mt-2 max-w-[60ch] text-muted">Pick your professor. Each one tests differently, so the chapters and questions are built from their notes.</p>
      </div>
      {course.owner_id && <p className="tag ok self-start">Your private course · only you can see it</p>}
      <div className="shelf">
        {profs.map((p) => {
          const own = all.filter((c) => c.professor_id === p.id).length;
          return (
            <Link key={p.id} href={`/courses/${course.slug}/${p.slug}`} className="book">
              <div className="book-cover"><span className="eyebrow">Professor</span><span className="code">{initials(p.name)}</span><span className="ttl">{p.name}</span></div>
              <div className="book-body">
                <b>{count(p.id)}</b> chapter{count(p.id) === 1 ? "" : "s"}
                {own > 0 && shared > 0 && <> · <b>{own}</b> just for this class</>}
              </div>
            </Link>
          );
        })}
        {shared > 0 && (
          <Link href={`/courses/${course.slug}/${ALL_PROFS}`} className="book">
            <div className="book-cover"><span className="eyebrow">Not listed?</span><span className="code">ALL</span><span className="ttl">Any professor</span></div>
            <div className="book-body"><b>{shared}</b> general chapter{shared === 1 ? " that applies" : "s that apply"} to every section</div>
          </Link>
        )}
      </div>
    </div>
  );
}

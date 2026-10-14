import Link from "next/link";
import { listCourseCards } from "@/lib/db";
import CourseShelf from "@/components/CourseShelf";
import { AUTH_ENABLED, hasSupabase } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Library() {
  const [courses, fun] = await Promise.all([listCourseCards(), listCourseCards(60, "fun")]);
  const canUpload = AUTH_ENABLED && hasSupabase();
  return (
    <div className="flex flex-col gap-10">
      <div>
        <span className="eyebrow">Library</span>
        <h1 className="big mt-2">Everything to study</h1>
        <p className="mt-2 max-w-[60ch] text-muted">Courses students built from their class notes, and games just for fun.</p>
      </div>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[24px] font-bold">Courses</h2>
            <p className="text-sm text-muted">Each course is one person&apos;s version, built chapter by chapter. Make your own anytime.</p>
          </div>
          {canUpload && <Link href="/upload?new=1" className="btn-ghost">+ Start a course</Link>}
        </div>
        <CourseShelf courses={courses} empty={<p className="text-muted">No courses yet. <Link href="/upload" className="underline">Upload your class notes</Link> to start one.</p>} />
      </section>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[24px] font-bold">For fun</h2>
          <p className="text-sm text-muted">Categories of games, like US States with capitals, flags and locations inside.</p>
        </div>
        <CourseShelf fun courses={fun} empty={<p className="text-muted">No games yet. <Link href="/upload?fun=1" className="underline">Make one</Link>.</p>} />
      </section>
    </div>
  );
}

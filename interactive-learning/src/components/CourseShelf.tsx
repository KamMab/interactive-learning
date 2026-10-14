import Link from "next/link";
import type { CourseCard } from "@/lib/types";

/** Course cards ("MGMT 120B · Prof. Lu · by kammab") or, with fun, for-fun categories ("US States · 3 games"). */
export default function CourseShelf({ courses, empty, fun }: { courses: CourseCard[]; empty?: React.ReactNode; fun?: boolean }) {
  if (!courses.length) return <>{empty ?? null}</>;
  return (
    <div className="shelf">
      {courses.map((c) => (
        <Link key={c.id} href={`/courses/${c.slug}`} className="book">
          {fun ? (
            <div className="book-cover fun">
              <span className="eyebrow">Category</span>
              <span className="ttl text-[26px]">{c.title}</span>
            </div>
          ) : (
            <div className="book-cover">
              <span className="eyebrow">{c.official ? "Course" : "Student course"}</span>
              <span className="code">{c.code}</span>
              <span className="ttl">{c.title}</span>
              {c.professor && <span className="cover-prof">{c.professor}</span>}
            </div>
          )}
          <div className="book-body">
            <b>{c.chapters}</b> {fun ? (c.chapters === 1 ? "game" : "games") : (c.chapters === 1 ? "chapter" : "chapters")}
            <br />{c.official ? "From the Interactive Learning library" : <>By <b>{c.author?.display_name ?? "a student"}</b></>}
          </div>
        </Link>
      ))}
    </div>
  );
}

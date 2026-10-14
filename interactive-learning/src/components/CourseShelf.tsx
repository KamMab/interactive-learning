import Link from "next/link";
import type { CourseCard } from "@/lib/types";

/** Course cards: "MGMT 120B · Intermediate Accounting II · by kammab". */
export default function CourseShelf({ courses, empty }: { courses: CourseCard[]; empty?: React.ReactNode }) {
  if (!courses.length) return <>{empty ?? null}</>;
  return (
    <div className="shelf">
      {courses.map((c) => (
        <Link key={c.id} href={`/courses/${c.slug}`} className="book">
          <div className="book-cover">
            <span className="eyebrow">{c.official ? "Course" : "Student course"}</span>
            <span className="code">{c.code}</span>
            <span className="ttl">{c.title}</span>
          </div>
          <div className="book-body">
            <b>{c.chapters}</b> chapter{c.chapters === 1 ? "" : "s"}{c.professor ? <> · {c.professor}</> : null}
            <br />{c.official ? "From the Interactive Learning library" : <>By <b>{c.author?.display_name ?? "a student"}</b></>}
          </div>
        </Link>
      ))}
    </div>
  );
}

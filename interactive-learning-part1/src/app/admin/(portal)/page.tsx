import Link from "next/link";
import { adminListCourses } from "@/lib/db";
import { createCourse } from "../actions";

export default async function AdminHome() {
  const courses = await adminListCourses();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-[34px] font-extrabold leading-tight">Courses</h1><Link href="/admin/uploads" className="btn-ghost">Student uploads</Link></div>
      <div className="mt-6 grid gap-3">
        {courses.map((c) => (
          <Link key={c.id} href={`/admin/courses/${c.id}`} className="card flex items-center justify-between p-4 hover:border-accent">
            <div>
              <span className="font-semibold">{c.code}</span> <span className="text-muted">— {c.title}</span>
            </div>
            <span className={c.published ? "tag ok" : "tag"}>{c.published ? "Live" : "Draft"}</span>
          </Link>
        ))}
        {courses.length === 0 && <p className="text-muted">No courses yet. Add your first one below.</p>}
      </div>

      <form action={createCourse} className="card mt-8 grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div>
          <label className="label">Course code</label>
          <input name="code" className="input" placeholder="MGMT 120B" required />
        </div>
        <div>
          <label className="label">Course title</label>
          <input name="title" className="input" placeholder="Intermediate Accounting" required />
        </div>
        <button className="btn">Add course</button>
      </form>
    </div>
  );
}

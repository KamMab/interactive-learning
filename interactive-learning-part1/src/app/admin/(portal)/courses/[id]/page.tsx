import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetCourse, adminListChapters, adminListProfessors } from "@/lib/db";
import { createChapter, createProfessor, deleteCourse, deleteProfessor, updateCourse, updateProfessor } from "../../../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import SaveButton from "@/components/admin/SaveButton";

export default async function AdminCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await adminGetCourse(id);
  if (!course) notFound();
  const [chapters, profs] = await Promise.all([adminListChapters(id), adminListProfessors(id)]);
  const groups = [
    ...profs.map((p) => ({ key: p.id, name: p.name, list: chapters.filter((c) => c.professor_id === p.id) })),
    { key: "shared", name: profs.length ? "Shared by every professor" : "Chapters", list: chapters.filter((c) => c.professor_id === null) },
  ].filter((g) => g.list.length > 0 || g.key === "shared");

  return (
    <div>
      <Link href="/admin" className="text-sm text-muted hover:text-accent">← Courses</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-[34px] font-extrabold leading-tight">{course.code}</h1>
        {course.published && <Link href={`/courses/${course.slug}`} className="text-sm text-accent">View live →</Link>}
      </div>

      <section className="mt-8">
        <h2 className="text-[22px] font-bold">Professors</h2>
        <p className="mt-1 text-sm text-muted">
          Students pick their professor after the course. Write how each one teaches and tests; Claude follows it when building that professor&apos;s chapters.
        </p>
        <div className="mt-3 grid gap-3">
          {profs.map((p) => (
            <details key={p.id} className="card p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span><strong>{p.name}</strong> <span className="text-sm text-muted">· {chapters.filter((c) => c.professor_id === p.id).length} chapters</span></span>
                <span className={p.published ? "tag ok" : "tag"}>{p.published ? "Shown" : "Hidden"}</span>
              </summary>
              <form action={updateProfessor.bind(null, p.id)} className="mt-4 grid gap-3">
                <div><label className="label">Name</label><input name="name" defaultValue={p.name} className="input" required /></div>
                <div>
                  <label className="label">How this professor teaches and tests (for Claude)</label>
                  <textarea name="instructions" defaultValue={p.instructions} rows={4} className="input"
                    placeholder="e.g. Exams are 60% journal entries, uses lots of numerical problems, likes trick questions on classification, follows lecture slides more than the textbook." />
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={p.published} /> Show this professor to students</label>
                <div className="flex flex-wrap items-center gap-3">
                  <SaveButton>Save professor</SaveButton>
                </div>
              </form>
              <div className="mt-3">
                <ConfirmButton action={deleteProfessor.bind(null, p.id)} label="Remove professor" message={`Remove ${p.name} and their chapters?`} />
              </div>
            </details>
          ))}
        </div>
        <form action={createProfessor.bind(null, course.id)} className="card mt-3 grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div><label className="label">Professor name</label><input name="name" className="input" placeholder="Prof. Smith" required /></div>
          <button className="btn">Add professor</button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-[22px] font-bold">Chapters</h2>
        {groups.map((g) => (
          <div key={g.key} className="mt-4">
            {profs.length > 0 && <span className="eyebrow">{g.name}</span>}
            <div className="mt-2 grid gap-2">
              {g.list.map((ch) => (
                <Link key={ch.id} href={`/admin/chapters/${ch.id}`} className="card flex items-center justify-between p-4 hover:border-accent">
                  <span><strong>Ch. {ch.number}</strong> <span className="text-muted">— {ch.title}</span></span>
                  <span className="flex items-center gap-3 text-xs text-muted">
                    {ch.content.terms.length}T · {ch.content.questions.length}Q · {ch.content.entries.length}E
                    <span className={ch.published ? "tag ok" : "tag"}>{ch.published ? "Live" : "Draft"}</span>
                  </span>
                </Link>
              ))}
              {g.list.length === 0 && <p className="text-sm text-muted">None yet.</p>}
            </div>
          </div>
        ))}
        <form action={createChapter.bind(null, course.id)} className="card mt-4 grid gap-3 p-4 sm:grid-cols-[100px_1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label">Number</label>
            <input name="number" type="number" className="input" placeholder="auto" />
          </div>
          <div>
            <label className="label">Chapter title</label>
            <input name="title" className="input" placeholder="Revenue Recognition" />
          </div>
          <div>
            <label className="label">Professor</label>
            <select name="professor_id" className="input" defaultValue={profs[0]?.id ?? ""}>
              {profs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">Shared by every professor</option>
            </select>
          </div>
          <button className="btn">Add chapter</button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-[22px] font-bold">Course details</h2>
        <form action={updateCourse.bind(null, course.id)} className="card mt-3 grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label">Code</label><input name="code" defaultValue={course.code} className="input" required /></div>
            <div><label className="label">URL name</label><input name="slug" defaultValue={course.slug} className="input" /></div>
            <div><label className="label">Sort order</label><input name="sort" type="number" defaultValue={course.sort} className="input" /></div>
          </div>
          <div><label className="label">Title</label><input name="title" defaultValue={course.title} className="input" required /></div>
          <div><label className="label">Description (shown to students)</label><textarea name="description" defaultValue={course.description} rows={2} className="input" /></div>
          <div>
            <label className="label">Course-wide instructions for Claude</label>
            <textarea
              name="instructions"
              defaultValue={course.instructions}
              rows={5}
              className="input"
              placeholder="e.g. This is UCLA MGMT 120B. The course follows the Kieso textbook and uses US GAAP terminology. (Put anything specific to one professor in that professor's box above.)"
            />
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={course.published} /> Published (visible to everyone)</label>
          <div><SaveButton>Save course</SaveButton></div>
        </form>
        <div className="mt-4">
          <ConfirmButton action={deleteCourse.bind(null, course.id)} label="Delete course" message="Delete this course, all its chapters and uploaded notes?" />
        </div>
      </section>
    </div>
  );
}

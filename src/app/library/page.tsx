import Link from "next/link";
import { listCourses, listProfessors, listStudentSets } from "@/lib/db";
import SetShelf from "@/components/SetShelf";

export const dynamic = "force-dynamic";

export default async function Library() {
  const [courses, classSets, fun] = await Promise.all([listCourses(), listStudentSets("class", 30), listStudentSets("fun", 30)]);
  const profCounts = await Promise.all(courses.map((c) => listProfessors(c.id).then((p) => p.length)));
  return (
    <div className="flex flex-col gap-10">
      <div>
        <span className="eyebrow">Library</span>
        <h1 className="big mt-2">Everything to study</h1>
        <p className="mt-2 max-w-[60ch] text-muted">UCLA courses built from class notes, sets other students shared, and games just for fun.</p>
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold">UCLA courses</h2>
        <div className="shelf">
          {courses.map((c, i) => (
            <Link key={c.id} href={`/courses/${c.slug}`} className="book">
              <div className="book-cover"><span className="eyebrow">Course</span><span className="code">{c.code}</span><span className="ttl">{c.title}</span></div>
              <div className="book-body">{profCounts[i] > 0 ? <><b>{profCounts[i]}</b> professor{profCounts[i] === 1 ? "" : "s"}</> : c.description}</div>
            </Link>
          ))}
          {courses.length === 0 && <p className="text-muted">No courses published yet.</p>}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold">Shared by students</h2>
        <SetShelf cards={classSets} empty={<p className="text-muted">Nothing shared yet. Upload your notes and choose <b>Everyone</b> to be first.</p>} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold">For fun</h2>
        <SetShelf cards={fun} empty={<p className="text-muted">No games yet. <Link href="/upload" className="underline">Make one</Link>.</p>} />
      </section>
    </div>
  );
}

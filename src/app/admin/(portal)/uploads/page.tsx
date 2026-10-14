import Link from "next/link";
import { adminListStudentCourses } from "@/lib/db";
import { admin } from "@/lib/db";
import { deleteCourse } from "../../actions";
import { hideStudentSet, makeOfficial, showStudentSet } from "./actions";
import ConfirmButton from "@/components/admin/ConfirmButton";

export default async function StudentUploads() {
  const courses = await adminListStudentCourses();
  const { data: recent } = await admin().from("uploads").select("id,user_email,course_id,status,error,created_at").order("created_at", { ascending: false }).limit(30);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="link">Admin</Link>
        <h1 className="big mt-2">Student uploads</h1>
        <p className="mt-2 max-w-[65ch] text-muted">
          Everything students have built from their own notes or ideas. Shared sets are public right away; hide anything that
          shouldn&apos;t be up, or make a good one part of the official library.
        </p>
      </div>
      <section className="flex flex-col gap-3">
        {courses.length === 0 && <p className="text-muted">No uploads yet.</p>}
        {courses.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b>{c.kind === "fun" ? c.title : `${c.code}: ${c.title}`}</b>
                <span className="tag">{c.kind === "fun" ? "For fun" : "Class"}</span>
                <span className={c.visibility === "public" ? "tag ok" : "tag"}>{c.visibility === "public" ? "Shared" : "Private"}</span>
              </div>
              <p className="note mt-1">{c.owner_email} · {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/courses/${c.slug}`} className="btn-ghost" target="_blank">Open</Link>
              {c.visibility === "public"
                ? <form action={hideStudentSet.bind(null, c.id)}><button className="btn-ghost">Hide from everyone</button></form>
                : <form action={showStudentSet.bind(null, c.id)}><button className="btn-ghost">Share publicly</button></form>}
              {c.kind !== "fun" && <form action={makeOfficial.bind(null, c.id)}><button className="btn-ghost">Make official</button></form>}
              <ConfirmButton action={deleteCourse.bind(null, c.id)} label="Delete" message="Delete this student set and its notes?" />
            </div>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-bold">Latest uploads</h2>
        <div className="card overflow-x-auto p-2">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-muted"><th className="p-2">When</th><th className="p-2">Student</th><th className="p-2">Status</th></tr></thead>
            <tbody>
              {(recent ?? []).map((u: { id: string; user_email: string; status: string; error: string | null; created_at: string }) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="p-2">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="p-2">{u.user_email}</td>
                  <td className="p-2">{u.status}{u.error ? ` · ${u.error}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

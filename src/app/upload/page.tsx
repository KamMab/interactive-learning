import Link from "next/link";
import { redirect } from "next/navigation";
import { AUTH_ENABLED, UPLOADS_PER_DAY, hasSupabase } from "@/lib/config";
import { currentUser } from "@/lib/auth-server";
import { admin, getProfile, listCourses, listMyCourses } from "@/lib/db";
import UploadForm from "@/components/UploadForm";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Claude reading a long PDF can take a minute or two

export default async function Upload({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!AUTH_ENABLED || !hasSupabase()) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <span className="eyebrow">Upload</span><h1 className="big">Upload your notes</h1>
        <p className="card p-5 text-muted">Uploads open once sign-in is switched on. (Site owner: see &ldquo;Turning on sign-in&rdquo; in the README.)</p>
      </div>
    );
  }
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent("/upload" + (sp.course ? `?course=${sp.course}` : sp.new ? `?new=1&code=${encodeURIComponent(sp.code ?? "")}&title=${encodeURIComponent(sp.title ?? "")}` : ""))}`);
  const [official, mine, profile] = await Promise.all([listCourses(), listMyCourses(user.id), getProfile(user.id)]);
  const codes = [...new Map([...mine, ...official].map((c) => [c.code, c.title])).entries()].map(([code, title]) => ({ code, title })).filter((c) => c.code !== "FUN");
  const { data: chs } = mine.length ? await admin().from("chapters").select("course_id").in("course_id", mine.map((c) => c.id)) : { data: [] };
  const myCourses = mine.map((c) => ({ id: c.id, kind: c.kind === "fun" ? "fun" as const : "class" as const, code: c.code, title: c.title, professor: c.professor ?? null,
    chapters: (chs ?? []).filter((x: { course_id: string }) => x.course_id === c.id).length }));

  return (
    <div className="flex flex-col gap-7">
      <div>
        <span className="eyebrow">Upload</span>
        <h1 className="big mt-2">Make a study set or a game</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          Upload notes, describe an idea, or paste a quiz you made with Claude. Keep it to yourself or share it with everyone.
          Claude builds up to {UPLOADS_PER_DAY} a day for you; pasted quizzes don&apos;t count.
        </p>
      </div>
      <UploadForm myCourses={myCourses} knownCodes={codes} authorName={profile?.display_name ?? user.email.split("@")[0]}
        preset={{ courseId: sp.course, newCourse: !!sp.new, code: sp.code, title: sp.title, fun: !!sp.fun || mine.some((c) => c.id === sp.course && c.kind === "fun") }} />
      {mine.length > 0 && (
        <p className="text-sm text-muted">What you've made: {mine.map((c, i) => <span key={c.id}>{i > 0 && " · "}<Link className="underline" href={`/courses/${c.slug}`}>{c.kind === "fun" ? c.title : c.code}</Link></span>)} · <Link className="underline" href="/mine">See all</Link></p>
      )}
    </div>
  );
}

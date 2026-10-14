import Link from "next/link";
import { listCourses, listMyCourses, listStudentSets, trendingSets } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { hasSupabase } from "@/lib/config";
import { demoCards } from "@/lib/demo-cards";
import SetShelf from "@/components/SetShelf";
import HomeProgress from "@/components/HomeProgress";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const [trending, fun, courses, mine] = await Promise.all([
    hasSupabase() ? trendingSets(8) : Promise.resolve(demoCards()),
    listStudentSets("fun", 8),
    listCourses(),
    user ? listMyCourses(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <span className="eyebrow">Interactive Learning</span>
        <h1 className="big mt-2">Welcome back</h1>
        <p className="mt-2 max-w-[60ch] text-muted">Pick up where you left off, see what everyone&apos;s studying, or play something just for fun.</p>
      </div>

      <HomeProgress />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-[24px] font-bold">Trending this week</h2><Link href="/library" className="link">Library</Link></div>
        <SetShelf cards={trending} empty={<p className="text-muted">Nothing trending yet. Once people start playing, the most-played sets show up here.</p>} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-[24px] font-bold">For fun</h2><p className="text-sm text-muted">Games other Bruins made: capitals, trivia, anything.</p></div>
          <Link href="/upload" className="btn-ghost">Make a game</Link>
        </div>
        <SetShelf cards={fun} empty={<div className="card p-5"><p className="text-muted">No games yet. Be the first: upload an idea like &ldquo;US state capitals&rdquo; and choose <b>For fun</b>.</p></div>} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-[24px] font-bold">UCLA courses</h2><Link href="/library" className="link">See all</Link></div>
        <div className="shelf">
          {courses.slice(0, 6).map((c) => (
            <Link key={c.id} href={`/courses/${c.slug}`} className="book">
              <div className="book-cover"><span className="eyebrow">Course</span><span className="code">{c.code}</span><span className="ttl">{c.title}</span></div>
            </Link>
          ))}
        </div>
      </section>

      {mine.length > 0 && <p className="text-sm text-muted">You&apos;ve made {mine.length} set{mine.length === 1 ? "" : "s"}. <Link href="/mine" className="underline">Open Your chapters</Link></p>}
    </div>
  );
}

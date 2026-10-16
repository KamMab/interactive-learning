import Link from "next/link";
import { listStudentSets } from "@/lib/db";
import SetShelf from "@/components/SetShelf";
import JoinBox from "@/components/same/JoinBox";

export const dynamic = "force-dynamic";

// Games: every shared For Fun game, with map games in their own row.
export default async function EduGames() {
  const games = await listStudentSets("fun", 120);
  const maps = games.filter((g) => g.hasMap), other = games.filter((g) => !g.hasMap);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Games</span>
          <h1 className="big mt-2">Learn by playing</h1>
          <p className="mt-2 max-w-[60ch] text-muted">Games other Bruins made: maps, capitals, trivia, languages and more. Every one works with Learn, Flashcards and Match.</p>
        </div>
        <Link href="/upload" className="btn">Make a game</Link>
      </div>
      <JoinBox />
      {maps.length > 0 && <section className="flex flex-col gap-4"><h2 className="text-[24px] font-bold">Map games</h2><SetShelf cards={maps} /></section>}
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold">{maps.length ? "Quizzes and trivia" : "All games"}</h2>
        <SetShelf cards={other} empty={<p className="card p-5 text-muted">{maps.length ? "None yet." : "No games yet."} <Link href="/upload" className="underline">Make the first one</Link>: choose <b>For fun</b> and describe an idea.</p>} />
      </section>
    </div>
  );
}

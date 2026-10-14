import Link from "next/link";
import type { SetCard } from "@/lib/types";

// A row of study-set cards (Home, Library, Your chapters, author pages). Server-safe.
export default function SetShelf({ cards, empty, showVisibility = false }: { cards: SetCard[]; empty?: React.ReactNode; showVisibility?: boolean }) {
  if (!cards.length) return <>{empty ?? null}</>;
  return (
    <div className="shelf">
      {cards.map((c) => (
        <div key={c.chapterId} className="book">
          <Link href={c.href} className="contents">
            <div className={`book-cover${c.kind === "fun" ? " fun" : ""}`}>
              <span className="eyebrow">{c.kind === "fun" ? "For fun" : c.kind === "class" ? "Student notes" : "UCLA course"}</span>
              <span className="ttl text-[22px]">{c.title}</span>
              {c.kind !== "fun" && <span className="eyebrow">{c.course}</span>}
            </div>
          </Link>
          <div className="book-body flex flex-col gap-1">
            <span><b>{c.terms}</b> terms · <b>{c.questions}</b> questions{c.plays ? <> · <b>{c.plays}</b> plays this week</> : null}</span>
            <span>
              {c.author ? <>By <Link href={`/u/${c.author.handle}`} className="underline">{c.author.display_name}</Link></> : c.kind === "official" ? "By Interactive Learning" : "By you"}
              {showVisibility && c.visibility && <> · <span className={c.visibility === "public" ? "tag ok" : "tag"}>{c.visibility === "public" ? "Shared" : "Only you"}</span></>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

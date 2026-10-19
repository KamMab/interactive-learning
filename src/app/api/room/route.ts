import { NextResponse } from "next/server";
import { advance, answer, createRoom, join, pickTeam, poll, postResult, restart, setTeams, start } from "@/lib/rooms";
import { cleanCode } from "@/lib/same";

export const dynamic = "force-dynamic";

// One endpoint for game rooms. Players are identified by a random id kept in their browser (no sign-in needed).
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const me = String(b.me ?? "").slice(0, 64);
    if (!/^[a-z0-9-]{8,64}$/i.test(me)) return NextResponse.json({ error: "Reload the page and try again." });
    if (b.op === "create") {
      return NextResponse.json(await createRoom({ chapterId: String(b.chapterId), kind: b.kind === "async" ? "async" : "live", host: me,
        hostName: String(b.name ?? ""), hostPlays: !!b.hostPlays, seconds: Number(b.seconds) || 30, quiz: !!b.quiz, count: Number(b.count) || 0, teams: Number(b.teams) || 0 }));
    }
    const code = cleanCode(String(b.code ?? ""));
    if (!code) return NextResponse.json({ error: "Codes look like abc-12d." });
    const out = b.op === "poll" ? await poll(code, me)
      : b.op === "join" ? await join(code, me, String(b.name ?? ""))
      : b.op === "start" ? await start(code, me)
      : b.op === "answer" ? await answer(code, me, String(b.answer ?? ""))
      : b.op === "next" ? await advance(code, me)
      : b.op === "restart" ? await restart(code, me)
      : b.op === "teams" ? await setTeams(code, me, b.names)
      : b.op === "team" ? await pickTeam(code, me, String(b.team ?? ""), b.who ? String(b.who).slice(0, 64) : undefined)
      : b.op === "result" ? await postResult(code, me, String(b.name ?? ""), Number(b.streak) || 0)
      : { error: "Unknown request." };
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong." });
  }
}

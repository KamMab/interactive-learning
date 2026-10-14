import { NextResponse } from "next/server";
import { admin } from "@/lib/db";
import { hasSupabase } from "@/lib/config";

// Counts one finished round toward Trending. Anonymous; only published chapters count.
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ ok: true });
  try {
    const { chapterId } = await req.json();
    if (typeof chapterId !== "string" || !/^[0-9a-f-]{36}$/i.test(chapterId)) return NextResponse.json({ ok: false }, { status: 400 });
    const { data } = await admin().from("chapters").select("id").eq("id", chapterId).eq("published", true).maybeSingle();
    if (data) await admin().from("play_events").insert({ chapter_id: chapterId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

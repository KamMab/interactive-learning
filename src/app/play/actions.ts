"use server";
import { admin } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { ensureProfile } from "@/lib/profiles";

export type BoardRow = { name: string; handle: string; best: number; me: boolean };

/** Longest streaks against the site for one game. The top row is the reigning champion. */
export async function streakBoard(chapterId: string): Promise<{ rows: BoardRow[]; mine: number | null; signedIn: boolean; error?: string }> {
  const user = await currentUser();
  try {
    const db = admin();
    const { data, error } = await db.from("game_records").select("user_id,best,updated_at").eq("chapter_id", chapterId)
      .order("best", { ascending: false }).order("updated_at", { ascending: true }).limit(10);
    if (error) return { rows: [], mine: null, signedIn: !!user, error: "Leaderboard isn't set up yet." };
    const ids = (data ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length ? await db.from("profiles").select("user_id,handle,display_name").in("user_id", ids) : { data: [] as any[] };
    const by = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    let mine: number | null = null;
    if (user) {
      const { data: m } = await db.from("game_records").select("best").eq("chapter_id", chapterId).eq("user_id", user.id).maybeSingle();
      mine = m?.best ?? null;
    }
    return { signedIn: !!user, mine, rows: (data ?? []).map((r) => ({ name: by.get(r.user_id)?.display_name ?? "Player", handle: by.get(r.user_id)?.handle ?? "", best: r.best, me: r.user_id === user?.id })) };
  } catch { return { rows: [], mine: null, signedIn: !!user, error: "Leaderboard unavailable." }; }
}

/** Saves a finished streak if it beats the player's best. Earlier records win ties, so the champion holds until beaten. */
export async function saveStreak(chapterId: string, streak: number) {
  const user = await currentUser();
  if (!user) return { error: "Sign in to get on the leaderboard." };
  const n = Math.max(0, Math.min(1000, Math.floor(streak)));
  const db = admin();
  await ensureProfile(user.id, user.email);
  const { data: champ } = await db.from("game_records").select("user_id,best").eq("chapter_id", chapterId).order("best", { ascending: false }).order("updated_at").limit(1).maybeSingle();
  const { data: cur, error } = await db.from("game_records").select("best").eq("chapter_id", chapterId).eq("user_id", user.id).maybeSingle();
  if (error) return { error: "Leaderboard isn't set up yet." };
  if (cur && cur.best >= n) return { best: cur.best, improved: false, crowned: false };
  const { error: e2 } = cur
    ? await db.from("game_records").update({ best: n, updated_at: new Date().toISOString() }).eq("chapter_id", chapterId).eq("user_id", user.id)
    : await db.from("game_records").insert({ chapter_id: chapterId, user_id: user.id, best: n });
  if (e2) return { error: e2.message };
  const crowned = n > 0 && (!champ || n > champ.best || champ.user_id === user.id);
  return { best: n, improved: true, crowned };
}

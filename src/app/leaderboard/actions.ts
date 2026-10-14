"use server";
import { currentUser } from "@/lib/auth-server";
import { ensureProfile } from "@/lib/profiles";

/** Sets the name a student shows under on the leaderboard and on anything they share. */
export async function setDisplayName(name: string) {
  const user = await currentUser();
  if (!user) return { error: "Sign in first." };
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { error: "Use at least 2 characters." };
  const p = await ensureProfile(user.id, user.email, clean);
  return { ok: true, name: p.display_name };
}

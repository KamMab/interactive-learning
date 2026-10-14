import "server-only";
import { admin } from "./db";
import { slugify } from "./id";
import type { Profile } from "./types";

/** Creates or renames a student's public profile. The handle (for /u/<handle>) is set once. */
export async function ensureProfile(userId: string, email: string, displayName?: string): Promise<Profile> {
  const db = admin();
  const { data: existing } = await db.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  const name = (displayName ?? "").trim().slice(0, 40);
  if (existing) {
    if (name && name !== existing.display_name) {
      await db.from("profiles").update({ display_name: name }).eq("user_id", userId);
      return { ...existing, display_name: name };
    }
    return existing as Profile;
  }
  const fallback = email.split("@")[0];
  const base = slugify(name || fallback).slice(0, 24) || "bruin";
  let handle = base;
  for (let i = 2; ; i++) {
    const { data } = await db.from("profiles").select("user_id").eq("handle", handle).maybeSingle();
    if (!data) break;
    handle = `${base}-${i}`;
  }
  const profile = { user_id: userId, handle, display_name: name || fallback };
  await db.from("profiles").insert(profile);
  return profile;
}

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type Viewer = { id: string; email: string };

/** The signed-in user (any email), or null. Always null while sign-in is switched off. */
export async function currentUser(): Promise<Viewer | null> {
  if (!AUTH_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const store = await cookies();
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in pages */ }
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  return { id: u.id, email: u.email };
}

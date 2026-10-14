import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

// Google and the email sign-in link both send people back here.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, url.origin));
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error_description")) {
    const why = /expired|invalid/i.test(url.searchParams.get("error_description") ?? "") ? "expired" : "failed";
    return NextResponse.redirect(new URL(`/signin?error=${why}`, url.origin));
  }
  if (!AUTH_ENABLED || !code) return res;

  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/signin?error=${/expired|invalid/i.test(error.message) ? "expired" : "failed"}`, url.origin));
  // A password-reset link that lost its destination still lands on the "choose a password" page.
  const sent = data.user?.recovery_sent_at ? Date.parse(data.user.recovery_sent_at) : 0;
  if (safeNext === "/" && sent && Date.now() - sent < 60 * 60 * 1000) {
    const to = NextResponse.redirect(new URL("/account/password", url.origin));
    res.cookies.getAll().forEach((c) => to.cookies.set(c));
    return to;
  }
  return res;
}

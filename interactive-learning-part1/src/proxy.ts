import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps the Supabase sign-in fresh on every page. The site stays open to everyone;
// signing in is only needed for a profile and to post (see /upload).
export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NEXT_PUBLIC_ENABLE_AUTH !== "true" || !url || !key) return NextResponse.next();

  // If Supabase sends an email link to the wrong page (e.g. the home page because the redirect
  // address wasn't on its allow list), finish the sign-in here instead of silently dropping it.
  const { pathname, searchParams } = req.nextUrl;
  if (pathname !== "/auth/callback" && (searchParams.has("code") || searchParams.has("error_description"))) {
    const to = new URL("/auth/callback", req.url);
    searchParams.forEach((v, k) => to.searchParams.set(k, v));
    if (!to.searchParams.has("next")) to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  let res = NextResponse.next({ request: req });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maps/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json)$).*)"],
};

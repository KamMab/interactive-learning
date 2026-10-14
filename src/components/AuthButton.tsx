"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AUTH_ENABLED } from "@/lib/config";
import { browserSupabase } from "@/lib/supabase-browser";

// Hidden until NEXT_PUBLIC_ENABLE_AUTH=true. Signing in is only needed for a profile and to post.
export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const sb = browserSupabase();

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (!AUTH_ENABLED || !sb) return null;

  if (user) {
    const name = user.user_metadata?.name?.split(" ")[0] || user.email?.split("@")[0] || "Account";
    return (
      <button onClick={async () => { await sb.auth.signOut(); location.href = "/"; }} className="gear" title={user.email ?? ""}>
        <span className="avatar">{name[0]?.toUpperCase()}</span><span className="gl">{name} · Sign out</span>
      </button>
    );
  }
  return <Link href="/signin" className="gear"><span>Sign in</span></Link>;
}

"use client";
import { browserSupabase } from "@/lib/supabase-browser";

export default function SignOutButton() {
  return (
    <button type="button" className="btn-ghost" onClick={async () => { await browserSupabase()?.auth.signOut(); location.href = "/"; }}>
      Sign out
    </button>
  );
}

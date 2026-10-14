"use client";
import { useEffect } from "react";
import { browserSupabase } from "@/lib/supabase-browser";
import { store, weekKey, weekSeconds } from "@/lib/store";

// While someone is signed in, copies their study time to the leaderboard once a minute.
export default function LeaderboardSync() {
  useEffect(() => {
    const sb = browserSupabase();
    if (!sb) return;
    let last = "";
    const push = async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) return;
      const row = { user_id: data.user.id, week_key: weekKey(), week_seconds: Math.round(weekSeconds()), total_seconds: Math.round(store().time.total), updated_at: new Date().toISOString() };
      const sig = `${row.week_key}:${row.week_seconds}:${row.total_seconds}`;
      if (sig === last) return;
      last = sig;
      await sb.from("leaderboard").upsert(row);
    };
    push();
    const t = setInterval(push, 60000);
    addEventListener("pagehide", push);
    return () => { clearInterval(t); removeEventListener("pagehide", push); };
  }, []);
  return null;
}

import Link from "next/link";
import { AUTH_ENABLED, hasSupabase } from "@/lib/config";
import { currentUser } from "@/lib/auth-server";
import { getProfile } from "@/lib/db";
import LeaderboardView from "@/components/LeaderboardView";

export const dynamic = "force-dynamic";

export default async function Leaderboard() {
  const on = AUTH_ENABLED && hasSupabase();
  const user = on ? await currentUser() : null;
  const profile = user ? await getProfile(user.id) : null;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="eyebrow">Leaderboard</span>
        <h1 className="big mt-2">Who&apos;s studying most</h1>
        <p className="mt-2 max-w-[60ch] text-muted">Ranked by study time. Everyone who's signed in shows up automatically.</p>
      </div>
      {!on ? (
        <p className="card p-5 text-muted">The leaderboard opens once sign-in is switched on.</p>
      ) : (
        <>
          {!user && <p className="card p-5 text-muted"><Link href="/signin?next=/leaderboard" className="underline">Sign in with your email</Link> to get on the board.</p>}
          <LeaderboardView me={user?.id ?? null} myName={profile?.display_name ?? (user ? user.email.split("@")[0] : "")} />
        </>
      )}
    </div>
  );
}

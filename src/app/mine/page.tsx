import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import { getProfile, listMyUploads, listSetsByOwner } from "@/lib/db";
import MyUploads from "@/components/MyUploads";
import SetShelf from "@/components/SetShelf";
import RecentList from "@/components/RecentList";

export const dynamic = "force-dynamic";

export default async function Mine() {
  const user = await currentUser();
  const [sets, profile, uploads] = user ? await Promise.all([listSetsByOwner(user.id, true), getProfile(user.id), listMyUploads(user.id)]) : [[], null, []];
  return (
    <div className="flex flex-col gap-10">
      <div>
        <span className="eyebrow">Your chapters</span>
        <h1 className="big mt-2">Your chapters</h1>
        <p className="mt-2 max-w-[60ch] text-muted">What you&apos;ve made and what you&apos;ve been studying.</p>
      </div>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[24px] font-bold">Made by you</h2>
          <div className="flex flex-wrap gap-2">{user && <Link href="/account" className="btn-ghost">Profile</Link>}{profile && <Link href={`/u/${profile.handle}`} className="btn-ghost">Your public page</Link>}<Link href="/upload" className="btn">Upload</Link></div>
        </div>
        {user
          ? <SetShelf cards={sets} showVisibility empty={<p className="card p-5 text-muted">You haven&apos;t made anything yet. <Link href="/upload" className="underline">Upload notes or an idea</Link>.</p>} />
          : <p className="card p-5 text-muted"><Link href="/signin?next=/mine" className="underline">Sign in with your email</Link> to upload notes and see what you&apos;ve made.</p>}
      </section>
      {user && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-[24px] font-bold">Your uploads</h2>
            <p className="mt-1 text-sm text-muted">The notes behind each set. Delete a file or a whole set.</p>
          </div>
          <MyUploads items={uploads} />
        </section>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold">Recently studied</h2>
        <RecentList />
      </section>
    </div>
  );
}

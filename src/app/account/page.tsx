import Link from "next/link";
import { redirect } from "next/navigation";
import { AUTH_ENABLED, hasSupabase } from "@/lib/config";
import { currentUser } from "@/lib/auth-server";
import { ensureProfile } from "@/lib/profiles";
import ProfileForm from "@/components/ProfileForm";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

// Your profile: the name everything you publish shows, plus password and sign out.
export default async function Account() {
  if (!AUTH_ENABLED || !hasSupabase()) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account");
  const profile = await ensureProfile(user.id, user.email);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <span className="eyebrow">Profile</span>
        <h1 className="big mt-2">{profile.display_name}</h1>
        <p className="mt-2 text-muted">Signed in as {user.email}</p>
      </div>
      <ProfileForm name={profile.display_name} />
      <section className="card flex flex-col gap-3 p-[22px]">
        <h2 className="text-lg font-bold">Account</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/u/${profile.handle}`} className="btn-ghost">Your public page</Link>
          <Link href="/mine" className="btn-ghost">Your chapters</Link>
          <Link href="/account/password" className="btn-ghost">Change password</Link>
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}

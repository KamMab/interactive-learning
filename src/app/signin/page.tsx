import { AUTH_ENABLED } from "@/lib/config";
import SignInForm from "@/components/SignInForm";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <span className="eyebrow">Account</span>
        <h1 className="big mt-2">Sign in</h1>
        <p className="mt-2 text-muted">
          Sign in with your email to get a profile, post your own chapters and quizzes, and join the leaderboard.
          Studying works without an account.
        </p>
      </div>
      {sp.error === "failed" && <p className="fb bad"><strong>Sign-in didn&apos;t finish.</strong><br />Try again, or request a new email link.</p>}
      {AUTH_ENABLED ? <SignInForm next={next} /> : <p className="card p-5 text-muted">Sign-in isn&apos;t switched on yet. The site owner turns it on in the settings described in the README.</p>}
    </div>
  );
}

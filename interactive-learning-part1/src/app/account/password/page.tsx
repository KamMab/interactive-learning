import { redirect } from "next/navigation";
import { AUTH_ENABLED } from "@/lib/config";
import { currentUser } from "@/lib/auth-server";
import SetPasswordForm from "@/components/SetPasswordForm";

export const dynamic = "force-dynamic";

// Reached from a "forgot password" email, or from Your chapters when signed in.
export default async function SetPassword() {
  if (!AUTH_ENABLED) redirect("/signin");
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account/password");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <span className="eyebrow">Account</span>
        <h1 className="big mt-2">Your password</h1>
        <p className="mt-2 text-muted">Set a password for {user.email} so you can sign in without waiting for an email.</p>
      </div>
      <SetPasswordForm />
    </div>
  );
}

import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { hasSupabase } from "@/lib/config";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin" className="tag ok">Admin portal</Link>
        <form action={logout}><button className="text-sm text-muted hover:text-ink">Log out</button></form>
      </div>
      {hasSupabase() ? children : (
        <div className="card p-6">
          <h1 className="text-2xl font-semibold">Connect your database</h1>
          <p className="mt-2 text-muted">
            Add the Supabase keys from <code>.env.example</code> and run <code>supabase/schema.sql</code>. The README walks through it.
          </p>
        </div>
      )}
    </div>
  );
}

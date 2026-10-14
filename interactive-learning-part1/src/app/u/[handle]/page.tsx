import { notFound } from "next/navigation";
import { getProfileByHandle, listSetsByOwner } from "@/lib/db";
import SetShelf from "@/components/SetShelf";

export const dynamic = "force-dynamic";

// A student's public page: everything they've shared.
export default async function Author({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();
  const sets = await listSetsByOwner(profile.user_id);
  const fun = sets.filter((s) => s.kind === "fun"), cls = sets.filter((s) => s.kind !== "fun");
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <span className="stage-ic !h-16 !w-16 text-[28px] font-extrabold">{profile.display_name[0]?.toUpperCase()}</span>
        <div><span className="eyebrow">Published by</span><h1 className="big mt-1">{profile.display_name}</h1>
          <p className="mt-1 text-muted">{sets.length} shared set{sets.length === 1 ? "" : "s"}</p></div>
      </div>
      {cls.length > 0 && <section className="flex flex-col gap-4"><h2 className="text-[24px] font-bold">Class study sets</h2><SetShelf cards={cls} /></section>}
      {fun.length > 0 && <section className="flex flex-col gap-4"><h2 className="text-[24px] font-bold">For fun</h2><SetShelf cards={fun} /></section>}
      {sets.length === 0 && <p className="text-muted">Nothing shared yet.</p>}
    </div>
  );
}

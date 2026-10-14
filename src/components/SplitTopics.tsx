"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { splitIntoTopics } from "@/app/mine/actions";

/** For a chapter made before topics existed: one click asks Claude to group its items into topics. */
export default function SplitTopics({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await splitIntoTopics(chapterId);
        setBusy(false);
        if (r.error) setErr(r.error); else router.refresh();
      }}>{busy ? "Splitting into topics…" : "Split into topics"}</button>
      <span className="text-[13px] text-muted">{err ? <span className="text-bad">{err}</span> : "Only you see this. Groups the cards and questions into topics students can pick from."}</span>
    </div>
  );
}

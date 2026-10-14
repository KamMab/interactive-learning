"use client";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";
import { fmtDur, weekKey } from "@/lib/store";
import { setDisplayName } from "@/app/leaderboard/actions";

type Row = { user_id: string; week_key: string; week_seconds: number; total_seconds: number };

export default function LeaderboardView({ me, myName }: { me: string | null; myName: string }) {
  const [tab, setTab] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState<Record<string, { name: string; handle: string }>>({});
  const [name, setName] = useState(myName), [saved, setSaved] = useState("");

  useEffect(() => {
    const sb = browserSupabase();
    if (!sb) return;
    let q = sb.from("leaderboard").select("user_id,week_key,week_seconds,total_seconds");
    q = tab === "week" ? q.eq("week_key", weekKey()).order("week_seconds", { ascending: false }) : q.order("total_seconds", { ascending: false });
    q.limit(50).then(async ({ data }) => {
      const list = (data ?? []) as Row[];
      setRows(list);
      if (list.length) {
        const { data: ps } = await sb.from("profiles").select("user_id,display_name,handle").in("user_id", list.map((r) => r.user_id));
        setNames(Object.fromEntries((ps ?? []).map((p: { user_id: string; display_name: string; handle: string }) => [p.user_id, { name: p.display_name, handle: p.handle }])));
      }
    });
  }, [tab]);

  const secs = (r: Row) => (tab === "week" ? r.week_seconds : r.total_seconds);
  return (
    <div className="flex flex-col gap-5">
      <div className="seg max-w-sm">
        <button aria-pressed={tab === "week"} onClick={() => setTab("week")}>This week</button>
        <button aria-pressed={tab === "all"} onClick={() => setTab("all")}>All time</button>
      </div>
      <section className="card p-3">
        {rows === null ? <p className="p-3 text-muted">Loading…</p> : rows.length === 0 ? <p className="p-3 text-muted">No one yet{tab === "week" ? " this week" : ""}. Study for a minute and you&apos;re on it.</p> : (
          <ol className="lb">
            {rows.filter((r) => secs(r) > 0).map((r, i) => (
              <li key={r.user_id} className={r.user_id === me ? "me" : ""}>
                <span className={`rk${i < 3 ? ` rk${i + 1}` : ""}`}>{i + 1}</span>
                <span className="nm">{names[r.user_id]?.handle ? <a href={`/u/${names[r.user_id].handle}`} className="hover:underline">{names[r.user_id].name}</a> : names[r.user_id]?.name ?? "Bruin"}{r.user_id === me && <span className="tag ok ml-2">You</span>}</span>
                <span className="mono">{fmtDur(secs(r))}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {me && (
        <form className="card flex flex-wrap items-end gap-3 p-5" onSubmit={async (e) => { e.preventDefault(); const r = await setDisplayName(name); setSaved("error" in r ? r.error ?? "" : "Saved."); }}>
          <div className="min-w-0 flex-1"><label className="label" htmlFor="lb-name">Your name on the board</label>
            <input id="lb-name" className="input" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setSaved(""); }} /></div>
          <button className="btn-ghost">Save</button>
          {saved && <span className="note w-full">{saved}</span>}
        </form>
      )}
    </div>
  );
}

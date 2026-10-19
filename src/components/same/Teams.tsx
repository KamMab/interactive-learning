"use client";
import { useEffect, useState } from "react";
import type { RoomView } from "@/lib/rooms";

type LiveView = Extract<RoomView, { kind: "live" }>;
type Act = (op: string, extra?: object) => Promise<void>;
type TeamRow = LiveView["teams"][number];

/** A small colored dot for a team (colors live in globals.css as .team-c0 … .team-c7). */
export function TeamDot({ color }: { color: number }) {
  return <span className={`team-dot team-c${color % 8}`} aria-hidden />;
}

export const teamOf = (v: LiveView, playerId?: string | null) => {
  const id = v.players.find((p) => p.id === playerId)?.team;
  return id ? v.teams.find((t) => t.id === id) ?? null : null;
};

/** Lobby: the host sets up teams; each player picks one (only one at a time). */
export function TeamsLobby({ v, act }: { v: LiveView; act: Act }) {
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<string[]>(v.teams.map((t) => t.name));
  const key = v.teams.map((t) => `${t.id}:${t.name}`).join("|");
  useEffect(() => setNames(v.teams.map((t) => t.name)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (op: string, extra: object) => { setBusy(true); await act(op, extra); setBusy(false); };
  const saveNames = (list: string[]) => run("teams", { names: list });
  const me = v.me, mine = teamOf(v, me?.id);
  const unassigned = v.players.filter((p) => !p.team || !v.teams.some((t) => t.id === p.team));

  if (!v.teams.length) {
    if (!v.isHost) return null;
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div><span className="eyebrow">Teams</span><p className="mt-1 text-sm text-muted">Split the room into teams. Players pick their team; the board shows the top team and who scored the most for it.</p></div>
        <div className="flex flex-wrap gap-2">{[2, 3, 4].map((n) => <button key={n} type="button" className="chip sm" disabled={busy} onClick={() => saveNames(Array(n).fill(""))}>{n} teams</button>)}</div>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">Teams · {v.teams.length}</span>
        {v.isHost && (
          <div className="flex flex-wrap gap-2">
            {v.teams.length < 8 && <button type="button" className="chip sm" disabled={busy} onClick={() => saveNames([...names, ""])}>+ Add a team</button>}
            <button type="button" className="chip sm" disabled={busy} onClick={() => saveNames([])}>Turn teams off</button>
          </div>
        )}
      </div>
      {!v.isHost && (me
        ? <p className="mt-2 text-sm">{mine ? <>You&apos;re on <b>{mine.name}</b>. Tap another team to switch; you can only be on one.</> : <b>Pick your team below.</b>}</p>
        : <p className="mt-2 text-sm text-muted">Join the game first, then pick a team.</p>)}
      <div className="team-grid mt-3">
        {v.teams.map((t, i) => {
          const members = v.players.filter((p) => p.team === t.id);
          const isMine = mine?.id === t.id;
          return (
            <div key={t.id} className={`team-card team-c${t.color % 8}${isMine ? " mine" : ""}`}>
              <div className={`flex items-center gap-2${v.isHost && v.teams.length > 2 ? " pr-5" : ""}`}>
                <TeamDot color={t.color} />
                {v.isHost
                  ? <input className="team-name" aria-label={`Team ${i + 1} name`} value={names[i] ?? ""} maxLength={24}
                      onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))}
                      onBlur={() => { if ((names[i] ?? "").trim() !== t.name) saveNames(names); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                  : <b className="truncate">{t.name}</b>}
                <span className="ml-auto mono text-[13px] text-muted">{members.length}</span>
              </div>
              <ul className="team-members">
                {members.map((p) => (
                  <li key={p.id} className={p.id === me?.id ? "me" : ""}>
                    <span className="truncate">{p.name}</span>
                    {v.isHost && <MoveSelect v={v} player={p.id} current={t.id} busy={busy} onMove={(team) => run("team", { team, who: p.id })} />}
                  </li>
                ))}
                {!members.length && <li className="empty">No one yet</li>}
              </ul>
              {me && !isMine && <button type="button" className="btn-ghost sm mt-2" disabled={busy} onClick={() => run("team", { team: t.id })}>{mine ? "Switch to this team" : "Join this team"}</button>}
              {v.isHost && v.teams.length > 2 && <button type="button" className="team-x" aria-label={`Remove ${t.name}`} disabled={busy} onClick={() => saveNames(names.filter((_, k) => k !== i))}>×</button>}
            </div>
          );
        })}
      </div>
      {unassigned.length > 0 && (
        <div className="mt-3 text-sm">
          <span className="text-muted">No team yet: </span>
          {unassigned.map((p, k) => (
            <span key={p.id} className="inline-flex items-center gap-1">{k > 0 && ", "}<b>{p.name}</b>
              {v.isHost && <MoveSelect v={v} player={p.id} current="" busy={busy} onMove={(team) => run("team", { team, who: p.id })} />}
            </span>
          ))}
          <p className="note mt-1">Anyone without a team joins the smallest team when the game starts.</p>
        </div>
      )}
    </section>
  );
}

function MoveSelect({ v, player, current, busy, onMove }: { v: LiveView; player: string; current: string; busy: boolean; onMove: (team: string) => void }) {
  return (
    <select className="team-move" aria-label="Move to team" value={current} disabled={busy} onChange={(e) => onMove(e.target.value)}>
      <option value="">No team</option>
      {v.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

/** Team leaderboard: teams ranked by total, each with the player who scored the most for it. */
export function TeamStandings({ v, final, unit }: { v: LiveView; final?: boolean; unit: string }) {
  if (!v.teams.length) return null;
  const ranked = [...v.teams].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1].score === top.score;
  const fmt = (n: number) => n.toLocaleString();
  return (
    <section className={final ? "card p-6 enter" : "mt-4"}>
      <span className="eyebrow">{final ? "Team results" : "Teams"}</span>
      {final && (
        <div className="team-win mt-2">
          {top.score > 0 && !tie
            ? <><p className="verdict"><TeamDot color={top.color} /> {top.name} wins!</p><p className="mt-1 text-muted">{fmt(top.score)} {unit}</p></>
            : <p className="verdict">{top.score > 0 ? `Tie: ${ranked.filter((t) => t.score === top.score).map((t) => t.name).join(" & ")}` : "No team scored"}</p>}
          {top.mvp && !tie && <p className="team-mvp mt-3">⭐ <b>{top.mvp.name}</b> scored the most for {top.name}: {fmt(top.mvp.points)} {unit} ({top.mvp.share}% of the team&apos;s total)</p>}
        </div>
      )}
      <ol className="team-board mt-3">
        {ranked.map((t: TeamRow, i) => (
          <li key={t.id} className={teamOf(v, v.me?.id)?.id === t.id ? "me" : ""}>
            <span className="rk mono">{i + 1}</span>
            <TeamDot color={t.color} />
            <span className="nm"><b>{t.name}</b>{t.mvp && <span className="mvp">Top: {t.mvp.name} · {fmt(t.mvp.points)}</span>}</span>
            <b className="mono">{fmt(t.score)}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

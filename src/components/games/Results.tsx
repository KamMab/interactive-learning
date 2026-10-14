"use client";

export default function Results({ title, score, total, extra, onReplay, onBack }: { title: string; score: number; total: number; extra?: { value: string | number; label: string }; onReplay: () => void; onBack: () => void }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const verdict = pct >= 90 ? "Excellent work" : pct >= 70 ? "Nice work" : pct >= 50 ? "Getting there" : "Keep practicing";
  return (
    <div className="mx-auto flex game-col flex-col gap-5 enter">
      <section className="card p-6">
        <span className="eyebrow">{title}</span>
        <p className="verdict">{verdict}</p>
        <div className="mt-5 grid grid-cols-3 border-t border-line">
          <div className="min-w-0 pt-3"><b className="mono block text-2xl font-semibold">{score}/{total}</b><span className="text-[12.5px] text-muted">Correct</span></div>
          <div className="min-w-0 pt-3"><b className="mono block text-2xl font-semibold">{pct}%</b><span className="text-[12.5px] text-muted">Accuracy</span></div>
          <div className="min-w-0 pt-3"><b className="mono block text-2xl font-semibold">{extra ? extra.value : "—"}</b><span className="text-[12.5px] text-muted">{extra ? extra.label : ""}</span></div>
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={onReplay}>Play again</button>
        <button className="btn-ghost" onClick={onBack}>Other ways to study</button>
      </div>
    </div>);
}

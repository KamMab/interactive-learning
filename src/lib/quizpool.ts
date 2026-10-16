// Questions for a live quiz (Kahoot-style) made from any chapter: its multiple-choice questions,
// plus its cards turned into "Which one matches?" questions so short chapters still have enough.
import { rng } from "./same";
import type { ChapterContent } from "./types";

export type QuizQ = { prompt: string; choices: string[]; answer: number; image?: string; explanation?: string };

export function quizPool(c: ChapterContent, seed = 1): QuizQ[] {
  const out: QuizQ[] = c.questions.filter((q) => q.choices.length >= 2 && q.answer < q.choices.length)
    .map((q) => ({ prompt: q.prompt, choices: q.choices.slice(0, 6), answer: q.answer, image: q.image, explanation: q.explanation }));
  const terms = c.terms.filter((t) => t.term && t.definition);
  if (terms.length >= 4) {
    const r = rng(seed ^ 0x51ed);
    const front = c.labels?.front ?? "term", back = c.labels?.back ?? "definition";
    for (const t of terms) {
      const others = terms.filter((x) => x !== t && x.definition !== t.definition).map((x) => x.definition);
      for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
      const choices = [t.definition, ...others.slice(0, 3)];
      for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
      out.push({ prompt: t.image ? `Which ${back.toLowerCase()} goes with this picture?` : `${t.term}: which ${back.toLowerCase()} matches this ${front.toLowerCase()}?`,
        choices, answer: choices.indexOf(t.definition), image: t.image });
    }
  }
  return out;
}

/** Kahoot-style scoring: the faster a right answer, the more it's worth (1,000 instantly, down to 250 at the buzzer). Wrong = 0. */
export const quizPoints = (correct: boolean, msLeft: number, msTotal: number) =>
  correct ? Math.round(250 + 750 * Math.max(0, Math.min(1, msLeft / msTotal))) : 0;

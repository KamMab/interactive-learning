import { SEED_AUTHOR, SEED_CHAPTERS, SEED_COURSES, SEED_FUN_COURSE } from "./seed";
import type { SetCard } from "./types";

// Cards for the demo content shown before the database is connected.
export function demoCards(): SetCard[] {
  return SEED_CHAPTERS.filter((ch) => ch.course_id !== SEED_FUN_COURSE.id).map((ch) => {
    const c = SEED_COURSES.find((x) => x.id === ch.course_id)!;
    return { chapterId: ch.id, href: `/courses/${c.slug}/all/${ch.number}`, title: ch.title, course: `${c.code} · Ch. ${ch.number}`, kind: "official",
      terms: ch.content.terms.length, questions: ch.content.questions.length };
  });
}

export function demoFunCards(): SetCard[] {
  return SEED_CHAPTERS.filter((ch) => ch.course_id === SEED_FUN_COURSE.id).map((ch) => ({
    chapterId: ch.id, href: `/courses/${SEED_FUN_COURSE.slug}/all/1`, title: SEED_FUN_COURSE.title, course: "For fun", kind: "fun",
    terms: ch.content.terms.length, questions: ch.content.questions.length, author: SEED_AUTHOR, visibility: "public", hasMap: !!ch.content.map?.items.length,
  }));
}

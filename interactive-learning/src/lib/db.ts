import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, hasSupabase } from "./config";
import { SEED_AUTHOR, SEED_CHAPTERS, SEED_COURSES, SEED_FUN_COURSE, SEED_PROFESSORS } from "./seed";
import { demoFunCards } from "./demo-cards";
import { ALL_PROFS, normalizeContent, normalizeSettings, type Chapter, type Course, type Note, type Professor, type Profile, type SetCard, type CourseCard } from "./types";

let client: SupabaseClient | null = null;

/** Server-only Supabase client (service role). Never import this from a client component. */
export function admin(): SupabaseClient {
  if (!hasSupabase()) throw new Error("Supabase is not configured. Add the keys from .env.example.");
  if (!client) {
    client = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

const toChapter = (row: any): Chapter => ({
  ...row,
  professor_id: row.professor_id ?? null,
  content: normalizeContent(row.content),
  settings: normalizeSettings(row.settings),
});

// ---------- Public reads (published only) ----------

export async function listCourses(): Promise<Course[]> {
  if (!hasSupabase()) return SEED_COURSES;
  const { data, error } = await admin().from("courses").select("*").eq("published", true).is("owner_id", null).order("sort").order("code");
  if (error) throw error;
  return data as Course[];
}

/**
 * A course page is open to everyone when it's published (official, or a student set shared publicly),
 * and only to its owner (or the signed-in admin) when it's a student's private set.
 */
export async function getCourseBySlug(slug: string, viewer?: { id: string } | null, asAdmin = false): Promise<Course | null> {
  if (!hasSupabase()) return [...SEED_COURSES, SEED_FUN_COURSE].find((c) => c.slug === slug) ?? null;
  const { data } = await admin().from("courses").select("*").eq("slug", slug).maybeSingle();
  const c = data as Course | null;
  if (!c) return null;
  if (c.owner_id) return asAdmin || (viewer && viewer.id === c.owner_id) || (c.visibility === "public" && c.published) ? c : null;
  return c.published || asAdmin ? c : null;
}

/** A student's own private courses (built from notes they uploaded). */
export async function listMyCourses(userId: string): Promise<Course[]> {
  if (!hasSupabase()) return [];
  const { data, error } = await admin().from("courses").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as Course[];
}

export async function listProfessors(courseId: string): Promise<Professor[]> {
  if (!hasSupabase()) return SEED_PROFESSORS.filter((p) => p.course_id === courseId);
  const { data, error } = await admin()
    .from("professors").select("*").eq("course_id", courseId).eq("published", true).order("sort").order("name");
  if (error) throw error;
  return data as Professor[];
}

/** Resolves the professor URL segment. "all" means chapters shared by everyone (or a course with no professors). */
export async function getProfessorBySlug(courseId: string, slug: string): Promise<Professor | null | "all"> {
  if (slug === ALL_PROFS) return "all";
  const profs = await listProfessors(courseId);
  return profs.find((p) => p.slug === slug) ?? null;
}

/**
 * Published chapters a student sees for one professor: that professor's own chapters plus the shared ones.
 * If both have the same chapter number, the professor's version wins.
 */
export async function listChapters(courseId: string, professorId?: string | null): Promise<Chapter[]> {
  let rows: Chapter[];
  if (!hasSupabase()) rows = SEED_CHAPTERS.filter((c) => c.course_id === courseId);
  else {
    const { data, error } = await admin()
      .from("chapters").select("*").eq("course_id", courseId).eq("published", true).order("number");
    if (error) throw error;
    rows = (data ?? []).map(toChapter);
  }
  if (professorId === undefined) return rows; // every published chapter (used by search)
  const mine = rows.filter((c) => c.professor_id === professorId || c.professor_id === null);
  const byNumber = new Map<number, Chapter>();
  for (const c of mine) {
    const prev = byNumber.get(c.number);
    if (!prev || (prev.professor_id === null && c.professor_id !== null)) byNumber.set(c.number, c);
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export async function getChapter(courseId: string, professorId: string | null, number: number): Promise<Chapter | null> {
  const list = await listChapters(courseId, professorId);
  return list.find((c) => c.number === number) ?? null;
}

// ---------- Admin reads (include drafts) ----------

export async function adminListCourses(): Promise<Course[]> {
  const { data, error } = await admin().from("courses").select("*").is("owner_id", null).order("sort").order("code");
  if (error) throw error;
  return data as Course[];
}

/** Every student's private course, newest first, for the admin "Student uploads" inbox. */
export async function adminListStudentCourses(): Promise<Course[]> {
  const { data, error } = await admin().from("courses").select("*").not("owner_id", "is", null).order("created_at", { ascending: false });
  if (error) throw error;
  return data as Course[];
}

export async function adminGetCourse(id: string): Promise<Course | null> {
  const { data } = await admin().from("courses").select("*").eq("id", id).maybeSingle();
  return (data as Course) ?? null;
}

export async function adminListChapters(courseId: string): Promise<Chapter[]> {
  const { data, error } = await admin().from("chapters").select("*").eq("course_id", courseId).order("number").order("professor_id", { nullsFirst: true });
  if (error) throw error;
  return (data ?? []).map(toChapter);
}

export async function adminListProfessors(courseId: string): Promise<Professor[]> {
  const { data, error } = await admin().from("professors").select("*").eq("course_id", courseId).order("sort").order("name");
  if (error) throw error;
  return data as Professor[];
}

export async function adminGetProfessor(id: string | null): Promise<Professor | null> {
  if (!id) return null;
  const { data } = await admin().from("professors").select("*").eq("id", id).maybeSingle();
  return (data as Professor) ?? null;
}

export async function adminGetChapter(id: string): Promise<Chapter | null> {
  const { data } = await admin().from("chapters").select("*").eq("id", id).maybeSingle();
  return data ? toChapter(data) : null;
}

export async function adminListNotes(chapterId: string): Promise<Note[]> {
  const { data, error } = await admin().from("notes").select("*").eq("chapter_id", chapterId).order("created_at");
  if (error) throw error;
  return data as Note[];
}

// ---------- Student sets, authors, trending ----------

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!hasSupabase()) return userId === SEED_AUTHOR.user_id ? SEED_AUTHOR : null;
  const { data } = await admin().from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  if (!hasSupabase()) return handle === SEED_AUTHOR.handle ? SEED_AUTHOR : null;
  const { data } = await admin().from("profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  return (data as Profile) ?? null;
}

/** Turns courses into one card per published chapter, with links and authors. */
async function cardsFor(courses: Course[], plays?: Map<string, number>, onlyChapters?: Set<string>): Promise<SetCard[]> {
  if (!courses.length) return [];
  const ids = courses.map((c) => c.id);
  const owners = [...new Set(courses.map((c) => c.owner_id).filter(Boolean))] as string[];
  const [{ data: chs }, { data: profs }, { data: people }] = await Promise.all([
    admin().from("chapters").select("id,course_id,professor_id,number,title,content").in("course_id", ids).eq("published", true).order("number"),
    admin().from("professors").select("id,slug").in("course_id", ids),
    owners.length ? admin().from("profiles").select("*").in("user_id", owners) : Promise.resolve({ data: [] as Profile[] }),
  ]);
  const byCourse = new Map(courses.map((c) => [c.id, c]));
  const profSlug = new Map((profs ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]));
  const author = new Map((people ?? []).map((p: Profile) => [p.user_id, p]));
  return (chs ?? [])
    .filter((ch: { id: string }) => !onlyChapters || onlyChapters.has(ch.id))
    .map((ch: { id: string; course_id: string; professor_id: string | null; number: number; title: string; content: unknown }) => {
      const c = byCourse.get(ch.course_id)!;
      const content = normalizeContent(ch.content as never);
      return {
        chapterId: ch.id,
        href: `/courses/${c.slug}/${ch.professor_id ? profSlug.get(ch.professor_id) ?? ALL_PROFS : ALL_PROFS}/${ch.number}`,
        title: ch.title || c.title,
        course: c.kind === "fun" ? c.title : `${c.code} · Ch. ${ch.number}`,
        kind: c.owner_id ? (c.kind ?? "class") : "official",
        terms: content.terms.length, questions: content.questions.length,
        author: c.owner_id ? author.get(c.owner_id) ?? null : null,
        plays: plays?.get(ch.id) ?? 0,
        visibility: c.owner_id ? c.visibility ?? "public" : "public",
        hasMap: !!content.map?.items.length,
      } as SetCard;
    });
}

/** Shared student sets, newest first. kind "fun" powers the For Fun shelves. */
export async function listStudentSets(kind: "class" | "fun", limit = 24): Promise<SetCard[]> {
  if (!hasSupabase()) return kind === "fun" ? demoFunCards() : [];
  const { data } = await admin().from("courses").select("*").not("owner_id", "is", null)
    .eq("visibility", "public").eq("published", true).eq("kind", kind).order("created_at", { ascending: false }).limit(limit);
  return cardsFor((data ?? []) as Course[]);
}

/** Everything one student has shared publicly (their author page). */
export async function listSetsByOwner(userId: string, includePrivate = false): Promise<SetCard[]> {
  if (!hasSupabase()) return userId === SEED_AUTHOR.user_id ? demoFunCards() : [];
  let q = admin().from("courses").select("*").eq("owner_id", userId).eq("published", true);
  if (!includePrivate) q = q.eq("visibility", "public");
  const { data } = await q.order("created_at", { ascending: false });
  return cardsFor((data ?? []) as Course[]);
}

export type MyUpload = {
  chapterId: string; title: string; course: string; href: string | null; published: boolean;
  notes: { id: string; name: string; size: number | null }[];
};

/** Every chapter a student made (built or not) with the note files behind it, for "Your uploads". */
export async function listMyUploads(userId: string): Promise<MyUpload[]> {
  if (!hasSupabase()) return [];
  const { data: courses } = await admin().from("courses").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  const list = (courses ?? []) as Course[];
  if (!list.length) return [];
  const ids = list.map((c) => c.id);
  const [{ data: chs }, { data: profs }] = await Promise.all([
    admin().from("chapters").select("id,course_id,professor_id,number,title,published,updated_at").in("course_id", ids),
    admin().from("professors").select("id,slug").in("course_id", ids),
  ]);
  const chapters = (chs ?? []) as { id: string; course_id: string; professor_id: string | null; number: number; title: string; published: boolean; updated_at: string }[];
  const { data: notes } = chapters.length
    ? await admin().from("notes").select("id,chapter_id,name,size,created_at").in("chapter_id", chapters.map((c) => c.id)).order("created_at")
    : { data: [] };
  const byCourse = new Map(list.map((c) => [c.id, c]));
  const profSlug = new Map((profs ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]));
  return chapters
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .map((ch) => {
      const c = byCourse.get(ch.course_id)!;
      return {
        chapterId: ch.id,
        title: c.kind === "fun" ? c.title : ch.title,
        course: c.kind === "fun" ? "For fun" : `${c.code} · Ch. ${ch.number}`,
        href: ch.published ? `/courses/${c.slug}/${ch.professor_id ? profSlug.get(ch.professor_id) ?? ALL_PROFS : ALL_PROFS}/${ch.number}` : null,
        published: ch.published,
        notes: (notes ?? []).filter((n: { chapter_id: string }) => n.chapter_id === ch.id).map((n: { id: string; name: string; size: number | null }) => ({ id: n.id, name: n.name, size: n.size })),
      };
    });
}

/** Sets students shared for one course code (shown on that course's page). */
export async function listSharedForCode(code: string): Promise<SetCard[]> {
  if (!hasSupabase()) return [];
  const { data } = await admin().from("courses").select("*").not("owner_id", "is", null)
    .eq("visibility", "public").eq("published", true).eq("kind", "class").ilike("code", code).order("created_at", { ascending: false }).limit(24);
  return cardsFor((data ?? []) as Course[]);
}

/**
 * Courses for Home/Library: library courses plus every student's shared class course ("MGMT 120B by kammab"),
 * only those with at least one published chapter. Library courses first, then by most chapters.
 */
export async function listCourseCards(limit = 60, kind: "class" | "fun" = "class"): Promise<CourseCard[]> {
  if (!hasSupabase() && kind === "fun") return [{ id: SEED_FUN_COURSE.id, slug: SEED_FUN_COURSE.slug, code: SEED_FUN_COURSE.code, title: SEED_FUN_COURSE.title, chapters: SEED_CHAPTERS.filter((ch) => ch.course_id === SEED_FUN_COURSE.id).length, author: SEED_AUTHOR, official: false }];
  if (!hasSupabase()) return SEED_COURSES.map((c) => ({ id: c.id, slug: c.slug, code: c.code, title: c.title, chapters: SEED_CHAPTERS.filter((ch) => ch.course_id === c.id).length, author: null, official: true }));
  const db = admin();
  let q = db.from("courses").select("*").eq("published", true);
  q = kind === "fun" ? q.eq("kind", "fun") : q.neq("kind", "fun");
  const { data } = await q
    .or("owner_id.is.null,visibility.eq.public").order("created_at", { ascending: false }).limit(300);
  const courses = (data ?? []) as Course[];
  if (!courses.length) return [];
  const { data: chs } = await db.from("chapters").select("course_id").eq("published", true).in("course_id", courses.map((c) => c.id));
  const count = new Map<string, number>();
  for (const ch of chs ?? []) count.set(ch.course_id, (count.get(ch.course_id) ?? 0) + 1);
  const owners = [...new Set(courses.map((c) => c.owner_id).filter(Boolean))] as string[];
  const { data: people } = owners.length ? await db.from("profiles").select("*").in("user_id", owners) : { data: [] };
  const who = new Map(((people ?? []) as Profile[]).map((p) => [p.user_id, p]));
  return courses
    .filter((c) => (count.get(c.id) ?? 0) > 0)
    .map((c) => ({ id: c.id, slug: c.slug, code: c.code, title: c.title, professor: c.professor ?? null, chapters: count.get(c.id) ?? 0,
      author: c.owner_id ? who.get(c.owner_id) ?? null : null, official: !c.owner_id }))
    .sort((a, b) => Number(b.official) - Number(a.official) || b.chapters - a.chapters || a.code.localeCompare(b.code))
    .slice(0, limit);
}

/** Other people's versions of the same course code (for "Other versions" on a course page). */
export async function otherVersions(code: string, exceptId: string): Promise<CourseCard[]> {
  const all = await listCourseCards(300);
  return all.filter((c) => c.id !== exceptId && c.code.toLowerCase() === code.toLowerCase());
}

/** Most-played public chapters this week. */
export async function trendingSets(limit = 8): Promise<SetCard[]> {
  if (!hasSupabase()) return [];
  const { data: top } = await admin().from("trending_chapters").select("chapter_id,plays").order("plays", { ascending: false }).limit(limit * 3);
  if (!top?.length) return [];
  const plays = new Map(top.map((t: { chapter_id: string; plays: number }) => [t.chapter_id, t.plays]));
  const { data: chs } = await admin().from("chapters").select("course_id").in("id", [...plays.keys()]);
  const courseIds = [...new Set((chs ?? []).map((c: { course_id: string }) => c.course_id))];
  const { data: courses } = await admin().from("courses").select("*").in("id", courseIds).eq("published", true);
  const visible = ((courses ?? []) as Course[]).filter((c) => !c.owner_id || c.visibility === "public");
  const cards = await cardsFor(visible, plays, new Set(plays.keys()));
  return cards.sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, limit);
}

/** Official courses as chapter cards (Home's "UCLA courses" shelf when nothing is trending yet). */
export async function officialCards(limit = 8): Promise<SetCard[]> {
  if (!hasSupabase()) return [];
  const courses = await listCourses();
  return (await cardsFor(courses)).slice(0, limit);
}

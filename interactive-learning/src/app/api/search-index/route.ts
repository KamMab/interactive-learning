import { NextResponse } from "next/server";
import { listChapters, listCourses, listProfessors, listStudentSets } from "@/lib/db";
import type { SearchItem } from "@/lib/search";
import { ALL_PROFS } from "@/lib/types";

export const dynamic = "force-dynamic";

// Everything the header search can find: published courses, professors, chapters and key terms.
export async function GET() {
  const courses = await listCourses();
  const items: SearchItem[] = [];
  for (const c of courses) {
    const [profs, chapters] = await Promise.all([listProfessors(c.id), listChapters(c.id)]);
    items.push({ kind: "course", label: `${c.code}: ${c.title}`, sub: profs.length ? `Taught by ${profs.map((p) => p.name).join(", ")}` : c.description || "Course",
      href: `/courses/${c.slug}`, badge: c.code, text: `${c.code} ${c.title} ${c.description}` });
    const profById = new Map(profs.map((p) => [p.id, p]));
    for (const p of profs) {
      items.push({ kind: "professor", label: p.name, sub: `${c.code}: ${c.title}`, href: `/courses/${c.slug}/${p.slug}`, text: `${p.name} ${c.code}` });
    }
    for (const ch of chapters) {
      const p = ch.professor_id ? profById.get(ch.professor_id) : undefined;
      if (ch.professor_id && !p) continue; // that professor is hidden
      const href = `/courses/${c.slug}/${p ? p.slug : ALL_PROFS}/${ch.number}`;
      const where = `${c.code}${p ? ` · ${p.name}` : ""}`;
      items.push({ kind: "chapter", label: `Ch. ${ch.number}: ${ch.title}`, sub: `${where} · ${ch.content.terms.length} terms · ${ch.content.questions.length} questions`,
        href, badge: String(ch.number), text: `${c.code} chapter ch ${ch.number} ${ch.title} ${p?.name ?? ""} ${ch.content.summary ?? ""}` });
      for (const t of ch.content.terms) {
        items.push({ kind: "term", label: t.term, sub: `${where} · Ch. ${ch.number} ${ch.title}`, href, text: `${t.term} ${t.definition}` });
      }
    }
  }
  const shared = [...(await listStudentSets("fun", 200)), ...(await listStudentSets("class", 200))];
  for (const s of shared) {
    const by = s.author ? ` · by ${s.author.display_name}` : "";
    items.push({ kind: "chapter", label: s.title, sub: `${s.course}${by}`, href: s.href, badge: s.kind === "fun" ? "★" : "S", text: `${s.title} ${s.course} ${s.author?.display_name ?? ""}` });
    if (s.author) items.push({ kind: "person", label: s.author.display_name, sub: "Student · shared sets", href: `/u/${s.author.handle}`, text: s.author.display_name });
  }
  const seen = new Set<string>();
  const unique = items.filter((it) => { const k = it.kind + it.href + it.label; if (seen.has(k)) return false; seen.add(k); return true; });
  return NextResponse.json(unique, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}

// The "upload format": a JSON study set anyone can have Claude (or any chatbot) write, then paste into Upload.
// The same rules guide Claude when the site builds a set itself.
import { uid } from "./id";
import { cleanSame } from "./same";
import { MAP_NAMES } from "./map-names";
import { DEFAULT_SETTINGS, MODES, cleanTools, modeCount, type ChapterContent, type ChapterSettings, type Mode } from "./types";

export const FORMAT_RULES = `Shape the set to the subject instead of forcing one format:
- terms: front/back pairs (term → definition, state → capital, Spanish → English). Set "labels" when Term/Definition is the wrong wording, e.g. {"front":"State","back":"Capital"}.
- questions: multiple choice with 4 choices; "answer" is the 0-based index of the right choice; add a short explanation of why it's right. Make the wrong choices plausible.
- entries: accounting journal entries only (debits equal credits, 0 in the unused column). Use [] for every other subject.
- map: geography only, when the places are US states or world countries, using the exact names below. Otherwise null.
- modes: the study modes that suit this material, best first: learn (adaptive rounds, a good first choice), flashcards, quiz (timed multiple choice), map, entries, match (pair both sides of terms), rush (rapid-fire questions).
- tools: ["interest-tables"] when students need present/future value factor tables to answer (time value of money, bonds, notes, leases). Otherwise leave it out.
- sections: when the material is long (several distinct topics, or more than about 30 terms and questions), split it into 2-8 sections in the order it's taught, list them in "sections" (a short title plus a few words on what each covers), and give every term, question, entry and map item a "section" number (1 = the first section). Leave "sections" empty for short sets.
Make 10-25 terms and 6-15 questions unless the topic is smaller. For a long chapter with sections, cover every section: about 8-15 terms and 5-10 questions each.`;

export const FORMAT_SHAPE = `{"title": string, "summary": string, "sections": [{"title": string, "blurb": string}], "labels": {"front": string, "back": string} | null, "terms": [{"term": string, "definition": string, "section": number}], "questions": [{"prompt": string, "choices": [string, string, string, string], "answer": number, "explanation": string, "difficulty": "easy" | "medium" | "hard", "section": number}], "entries": [{"scenario": string, "lines": [{"account": string, "debit": number, "credit": number}], "explanation": string, "section": number}], "map": {"region": "us-states" | "world", "ask": string, "items": [{"place": string, "prompt": string, "section": number}]} | null, "modes": [string], "tools": ["interest-tables"] | []}`;

export const MAP_NAME_LIST = `Map place names. us-states: ${MAP_NAMES["us-states"].join(", ")}. world: ${MAP_NAMES.world.join(", ")}.`;

/** The prompt a student copies into Claude to make a quiz they can paste back into Upload. */
export const copyPrompt = (topic: string) => `Make a study quiz about: ${topic.trim() || "[WRITE YOUR TOPIC HERE]"}

Reply with only one JSON object in exactly this format (no other text), so I can upload it to Interactive Learning:
${FORMAT_SHAPE}

${FORMAT_RULES}

${MAP_NAME_LIST}`;

/** Reads a pasted set (JSON, even inside a code block with a sentence around it) and cleans it up. */
export function parseImport(raw: string): { content: ChapterContent; settings: ChapterSettings; title?: string } | { error: string } {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1];
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return { error: "That doesn't look like the upload format. Paste exactly what Claude gave you, including the { } braces." };
  let out: any;
  try { out = JSON.parse(text.slice(a, b + 1)); } catch { return { error: "The pasted text isn't complete JSON. Ask Claude to send it again in the exact format, then paste all of it." }; }
  return cleanSet(out);
}

/** Turns a raw "sections" list plus per-item section numbers (1-based) into section ids. */
export function sectionMapper(raw: any) {
  const list = (Array.isArray(raw?.sections) ? raw.sections : [])
    .map((x: any) => ({ title: String(typeof x === "string" ? x : x?.title ?? "").trim(), blurb: typeof x === "object" && x?.blurb ? String(x.blurb).trim() : "" }))
    .filter((x: { title: string }) => x.title).slice(0, 12);
  if (list.length < 2) return { sections: undefined, of: (_: any): string | undefined => undefined };
  const sections = list.map((t: { title: string; blurb: string }) => ({ id: "sec-" + uid(), title: t.title.slice(0, 80), ...(t.blurb ? { blurb: t.blurb.slice(0, 120) } : {}) }));
  return {
    sections,
    of: (it: any): string | undefined => {
      const n = Number(it?.section);
      return Number.isInteger(n) && n >= 1 && n <= sections.length ? sections[n - 1].id : undefined;
    },
  };
}

const imageOf = (x: any) => (typeof x?.image === "string" && /^(https:\/\/|wiki:)/.test(x.image.trim()) ? x.image.trim().slice(0, 500) : undefined);

export function cleanSet(out: any): { content: ChapterContent; settings: ChapterSettings; title?: string } | { error: string } {
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  const sec = sectionMapper(out);
  const content: ChapterContent = {
    summary: String(out?.summary ?? "").slice(0, 600),
    sections: sec.sections,
    labels: out?.labels?.front && out?.labels?.back ? { front: String(out.labels.front).slice(0, 30), back: String(out.labels.back).slice(0, 30) } : undefined,
    terms: arr(out?.terms).filter((t: any) => t?.term && t?.definition).slice(0, 300)
      .map((t: any) => ({ id: uid(), term: String(t.term).slice(0, 200), definition: String(t.definition).slice(0, 1000), section: sec.of(t), image: imageOf(t) })),
    questions: arr(out?.questions)
      .filter((q: any) => Array.isArray(q?.choices) && q.choices.length >= 2 && Number(q.answer) >= 0 && Number(q.answer) < q.choices.length).slice(0, 300)
      .map((q: any) => ({ id: uid(), prompt: String(q.prompt).slice(0, 1000), choices: q.choices.slice(0, 6).map((c: unknown) => String(c).slice(0, 300)),
        answer: Number(q.answer), explanation: String(q.explanation ?? "").slice(0, 1000), section: sec.of(q), image: imageOf(q),
        ...(["easy", "medium", "hard"].includes(q.difficulty) ? { difficulty: q.difficulty } : {}) })),
    entries: arr(out?.entries).filter((e: any) => Array.isArray(e?.lines)).slice(0, 100)
      .map((e: any) => ({ id: uid(), scenario: String(e.scenario ?? "").slice(0, 1000), explanation: String(e.explanation ?? "").slice(0, 1000),
        lines: e.lines.slice(0, 12).map((l: any) => ({ account: String(l.account ?? ""), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })), section: sec.of(e) })),
    map: null,
    tools: cleanTools(out?.tools),
    same: cleanSame(out?.same),
  };
  const m = out?.map;
  if (m && (m.region === "us-states" || m.region === "world") && Array.isArray(m.items)) {
    const names = new Map((MAP_NAMES[m.region as "us-states" | "world"] as readonly string[]).map((n) => [n.toLowerCase(), n]));
    const items = m.items.map((it: any) => ({ id: uid(), place: names.get(String(it?.place ?? "").trim().toLowerCase()) ?? "", prompt: String(it?.prompt ?? "").trim().slice(0, 200), section: sec.of(it) }))
      .filter((it: { place: string; prompt: string }) => it.place && it.prompt);
    if (items.length) content.map = { region: m.region, ask: String(m.ask || "Find").slice(0, 120), items };
  }
  if (!content.terms.length && !content.questions.length && !content.map && !content.same) return { error: "There's nothing to study in it yet: it needs terms, questions or map places." };
  let modes = [...new Set(arr(out?.modes) as string[])].filter((x): x is Mode => (MODES as readonly string[]).includes(x) && modeCount(x as Mode, content) > 0);
  if (!modes.length) modes = MODES.filter((x) => modeCount(x, content) > 0);
  return { content, settings: { ...DEFAULT_SETTINGS, modes }, title: typeof out?.title === "string" ? out.title : undefined };
}

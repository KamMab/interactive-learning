import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { admin } from "./db";
import { uid } from "./id";
import { MAP_NAMES } from "./map-names";
import { sectionMapper } from "./import-format";
import {
  MODES,
  normalizeSettings,
  type Chapter,
  type ChapterContent,
  type ChapterSettings,
  type Course,
  type MapRegion,
  type MapSet,
  type Mode,
  type Note,
  type Professor,
  modeCount,
} from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

type Block = Anthropic.Messages.ContentBlockParam;

/** Pull each uploaded note out of storage and turn it into something Claude can read. */
async function noteBlocks(notes: Note[]): Promise<Block[]> {
  const blocks: Block[] = [];
  for (const note of notes) {
    const { data, error } = await admin().storage.from("notes").download(note.path);
    if (error || !data) {
      blocks.push({ type: "text", text: `[Could not load ${note.name}]` });
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const mime = note.mime || data.type || "";
    const name = note.name.toLowerCase();

    if (mime === "application/pdf" || name.endsWith(".pdf")) {
      blocks.push({ type: "text", text: `--- Notes file: ${note.name} ---` });
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
      });
    } else if (/^image\/(png|jpeg|gif|webp)$/.test(mime)) {
      blocks.push({ type: "text", text: `--- Notes image: ${note.name} ---` });
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: mime as "image/png", data: buf.toString("base64") },
      });
    } else if (name.endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      blocks.push({ type: "text", text: `--- Notes file: ${note.name} ---\n${value}` });
    } else {
      blocks.push({ type: "text", text: `--- Notes file: ${note.name} ---\n${buf.toString("utf8")}` });
    }
  }
  return blocks;
}

const studySetTool: Anthropic.Messages.Tool = {
  name: "save_study_set",
  description: "Save the complete study set for this chapter.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "1-2 short sentences: what this chapter covers." },
      sections: {
        type: "array",
        description: "Only for long material (several distinct topics, or more than ~30 terms and questions): 2-8 section titles in the order they're taught. Every item then gets a section number. Omit for short sets.",
        items: { type: "string" },
      },
      terms: {
        type: "array",
        items: {
          type: "object",
          properties: { term: { type: "string" }, definition: { type: "string" }, section: { type: "integer", description: "1-based section number, when sections are used" } },
          required: ["term", "definition"],
        },
      },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            choices: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
            answer: { type: "integer", description: "0-based index of the correct choice" },
            explanation: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            section: { type: "integer", description: "1-based section number, when sections are used" },
          },
          required: ["prompt", "choices", "answer", "explanation"],
        },
      },
      entries: {
        type: "array",
        description: "Journal entry problems. Leave empty if the chapter has no journal entries.",
        items: {
          type: "object",
          properties: {
            scenario: { type: "string" },
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  account: { type: "string" },
                  debit: { type: "number" },
                  credit: { type: "number" },
                },
                required: ["account", "debit", "credit"],
              },
            },
            explanation: { type: "string" },
            section: { type: "integer" },
          },
          required: ["scenario", "lines", "explanation"],
        },
      },
      settings: {
        type: "object",
        description:
          "Only include if the admin's instructions ask to change how the chapter is studied. Omit otherwise.",
        properties: {
          modes: { type: "array", items: { type: "string", enum: [...MODES] } },
          questionCount: { type: "integer" },
          rushSeconds: { type: "integer" },
          matchPairs: { type: "integer" },
          shuffle: { type: "boolean" },
          showExplanations: { type: "boolean" },
          requireFlashcardsFirst: { type: "boolean" },
        },
      },
      labels: {
        type: "object",
        description: "What the two sides of a card are called when Term/Definition doesn't fit, e.g. {front: \"State\", back: \"Capital\"} or {front: \"Spanish\", back: \"English\"}. Omit for ordinary terms.",
        properties: { front: { type: "string" }, back: { type: "string" } },
        required: ["front", "back"],
      },
      map: {
        type: "object",
        description: "Only for geography: places students should find on a map of US states or world countries. Omit otherwise.",
        properties: {
          region: { type: "string", enum: ["us-states", "world"] },
          ask: { type: "string", description: "Instruction shown before each prompt, e.g. 'Click the state whose capital is' or 'Find'." },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                place: { type: "string", description: "Exact place name from the list for that region." },
                prompt: { type: "string", description: "What the student is shown, e.g. 'Sacramento' or 'California'." },
                section: { type: "integer" },
              },
              required: ["place", "prompt"],
            },
          },
        },
        required: ["region", "ask", "items"],
      },
      modes: {
        type: "array",
        description: "Which study modes fit this material best, best first (the first one opens when a student picks the set). Only list modes the set has content for.",
        items: { type: "string", enum: [...MODES] },
      },
      chapter_title: { type: "string", description: "The chapter's full title as written in the notes (e.g. 'Linear Algebra' from 'Chapter 3: Linear Algebra'), without the chapter number. Empty if the notes don't name it." },
      chapter_number: { type: "integer", description: "The chapter number printed in the notes, if any." },
      change_note: { type: "string", description: "One or two sentences telling the admin what you produced or changed." },
    },
    required: ["summary", "terms", "questions", "entries", "change_note"],
  },
};

const SYSTEM = `You build study material for a student learning platform.
Work from the provided notes and instructions, and don't invent facts the notes don't support. When no notes are attached, use accurate, well-established knowledge of the topic in the instructions.
Write clearly for college students. Multiple-choice distractors must be plausible, and every explanation should say why the right answer is right.
Journal entries must balance (total debits = total credits), use realistic account names, and put 0 in the unused debit/credit column.
Shape the set to the subject instead of forcing one format:
- terms are any front/back pairs (term → definition, state → capital, Spanish → English, artist → famous work). Set labels when Term/Definition is the wrong wording.
- questions are multiple choice with one right answer.
- entries are accounting journal entries only; leave the list empty for every other subject.
- map is for geography only: places that are US states or world countries. Use the exact place names listed below.
- sections: when the material is long (several distinct topics, or more than about 30 terms and questions), split it into 2-8 sections in the order it's taught and tag every item with its section number, so students can study one section at a time. Cover every section: about 8-15 terms and 5-10 questions each. Skip sections for short material.
- modes: choose and order the study modes that suit this material.
  learn = adaptive rounds over terms and questions (good default first), flashcards = flip cards, quiz = timed multiple choice,
  map = click places on a map, entries = journal entries, match = pair the two sides of terms, rush = rapid-fire questions.
The admin's instructions always take priority over these defaults.

Map place names. us-states: ${MAP_NAMES["us-states"].join(", ")}.
world: ${MAP_NAMES.world.join(", ")}.
Always respond by calling the save_study_set tool exactly once with the full study set.`;

export type GenerateInput = {
  course: Course;
  professor: Professor | null;
  chapter: Chapter;
  notes: Note[];
  request: string;               // extra one-off instructions typed at generation time
  mode: "replace" | "add" | "revise";
  allowSettingsChanges: boolean;
  chooseModes?: boolean;         // let Claude pick which study modes fit (student uploads)
};

export type GenerateResult = {
  content: ChapterContent;
  chapterTitle?: string;
  chapterNumber?: number;
  settings: ChapterSettings | null;
  changeNote: string;
};

export async function generateStudySet(input: GenerateInput): Promise<GenerateResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Add ANTHROPIC_API_KEY to your environment.");
  const { course, professor, chapter, notes, request, mode, allowSettingsChanges } = input;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Add ANTHROPIC_API_KEY to your environment.");
  const client = new Anthropic();

  const context = [
    `Course: ${course.code} — ${course.title}`,
    course.instructions && `Course-wide instructions from the admin:\n${course.instructions}`,
    professor
      ? `Professor: ${professor.name}. These questions are for students in ${professor.name}'s section, so match how this professor teaches and tests.` +
        (professor.instructions ? `\nHow ${professor.name} teaches and tests (from the admin):\n${professor.instructions}` : "")
      : "This chapter is shared by every professor who teaches the course.",
    `Chapter ${chapter.number}: ${chapter.title}`,
    chapter.instructions && `Chapter instructions from the admin:\n${chapter.instructions}`,
    request && `Instructions for this run:\n${request}`,
    `Current study settings: ${JSON.stringify(chapter.settings)}`,
    allowSettingsChanges
      ? "You may include a settings object if the instructions ask to change how this chapter is studied."
      : "Do not include a settings object.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const task =
    mode === "revise"
      ? `Revise the existing study set below according to the instructions. Return the full updated set (not just the changes).\n\nExisting study set:\n${JSON.stringify(stripIds(chapter.content))}`
      : mode === "add"
        ? `Create NEW material that adds to (and doesn't duplicate) the existing set below.\n\nExisting study set:\n${JSON.stringify(stripIds(chapter.content))}`
        : "Create a complete study set for this chapter from the notes.";

  const content: Block[] = [
    ...(await noteBlocks(notes)),
    { type: "text", text: `${context}\n\n${task}` },
  ];

  // Newer models don't accept a forced tool_choice, so ask for the tool in words and nudge once if needed.
  const ask = async (messages: Anthropic.MessageParam[]) =>
    client.messages.stream({ model: MODEL, max_tokens: 32000, system: SYSTEM, tools: [studySetTool], tool_choice: { type: "auto" }, messages }).finalMessage();
  const first: Anthropic.MessageParam = { role: "user", content: [...content, { type: "text", text: "Save the result by calling the save_study_set tool." }] };
  let message = await ask([first]);
  if (!message.content.some((b) => b.type === "tool_use")) {
    message = await ask([first, { role: "assistant", content: message.content }, { role: "user", content: "Call the save_study_set tool now with the full study set." }]);
  }

  const call = message.content.find((b) => b.type === "tool_use");
  if (!call || call.type !== "tool_use") throw new Error("Claude didn't return a study set. Try again.");
  const out = call.input as any;

  const sec = sectionMapper(out);
  const fresh: ChapterContent = {
    summary: out.summary ?? "",
    sections: sec.sections,
    terms: (out.terms ?? []).map((t: any) => ({ id: uid(), term: t.term, definition: t.definition, section: sec.of(t) })),
    questions: (out.questions ?? [])
      .filter((q: any) => Array.isArray(q.choices) && q.answer >= 0 && q.answer < q.choices.length)
      .map((q: any) => ({ id: uid(), prompt: q.prompt, choices: q.choices, answer: q.answer, explanation: q.explanation ?? "", difficulty: q.difficulty, section: sec.of(q) })),
    entries: (out.entries ?? []).map((e: any) => ({ id: uid(), scenario: e.scenario, lines: e.lines ?? [], explanation: e.explanation ?? "", section: sec.of(e) })),
    labels: out.labels?.front && out.labels?.back ? { front: String(out.labels.front), back: String(out.labels.back) } : undefined,
    map: cleanMap(out.map, sec.of),
  };

  const merged: ChapterContent =
    mode === "add"
      ? {
          summary: chapter.content.summary || fresh.summary,
          sections: [...(chapter.content.sections ?? []), ...(fresh.sections ?? [])].length ? [...(chapter.content.sections ?? []), ...(fresh.sections ?? [])] : undefined,
          terms: [...chapter.content.terms, ...fresh.terms],
          questions: [...chapter.content.questions, ...fresh.questions],
          entries: [...chapter.content.entries, ...fresh.entries],
          labels: chapter.content.labels ?? fresh.labels,
          map: chapter.content.map && fresh.map && chapter.content.map.region === fresh.map.region
            ? { ...chapter.content.map, items: [...chapter.content.map.items, ...fresh.map.items] }
            : chapter.content.map ?? fresh.map,
        }
      : fresh;

  // Claude's suggested study modes (validated against what the set actually contains).
  let settings = allowSettingsChanges && out.settings ? normalizeSettings({ ...chapter.settings, ...out.settings }) : null;
  if ((allowSettingsChanges || input.chooseModes) && Array.isArray(out.modes)) {
    const picked = [...new Set(out.modes as string[])].filter((m): m is Mode => (MODES as readonly string[]).includes(m) && modeCount(m as Mode, merged) > 0);
    if (picked.length) settings = normalizeSettings({ ...(settings ?? chapter.settings), modes: picked, v: 2 });
  }

  return {
    content: merged,
    settings,
    changeNote: out.change_note ?? "",
    chapterTitle: typeof out.chapter_title === "string" ? out.chapter_title.trim().slice(0, 120) : undefined,
    chapterNumber: Number.isInteger(out.chapter_number) && out.chapter_number > 0 && out.chapter_number < 1000 ? out.chapter_number : undefined,
  };
}

/** Keeps only map items whose place is on the map (case-insensitive), with the map's own spelling. */
function cleanMap(m: any, sectionOf: (it: any) => string | undefined = () => undefined): MapSet | null {
  if (!m || (m.region !== "us-states" && m.region !== "world") || !Array.isArray(m.items)) return null;
  const names = new Map((MAP_NAMES[m.region as MapRegion] as readonly string[]).map((n) => [n.toLowerCase(), n]));
  const items = m.items
    .map((it: any) => ({ id: uid(), place: names.get(String(it.place ?? "").trim().toLowerCase()) ?? "", prompt: String(it.prompt ?? "").trim(), section: sectionOf(it) }))
    .filter((it: { place: string; prompt: string }) => it.place && it.prompt);
  return items.length ? { region: m.region, ask: String(m.ask || "Find"), items } : null;
}

function stripIds(c: ChapterContent) {
  // Sections go to Claude as titles plus 1-based numbers on each item, the same shape it writes.
  const num = new Map((c.sections ?? []).map((s, i) => [s.id, i + 1]));
  const drop = ({ id, section, ...rest }: any) => (section && num.has(section) ? { ...rest, section: num.get(section) } : rest);
  return { summary: c.summary, sections: c.sections?.map((s) => s.title), labels: c.labels, terms: c.terms.map(drop), questions: c.questions.map(drop), entries: c.entries.map(drop),
    map: c.map ? { ...c.map, items: c.map.items.map(drop) } : undefined };
}

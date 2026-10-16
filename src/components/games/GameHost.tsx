"use client";
import type { ChapterContent, ChapterSettings, Mode } from "@/lib/types";
import Learn from "./Learn";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";
import Match from "./Match";
import Rush from "./Rush";
import Entries from "./Entries";
import MapGame from "./MapGame";
import SameGame from "../same/SameGame";
import MathGame from "../same/MathGame";

export type RoundOpts = { count?: number; pairs?: number; seconds?: number };
export type GP = {
  chapter: { id: string; title: string; content: ChapterContent; settings: ChapterSettings };
  opts: RoundOpts;
  onBack: () => void;
};

// To add a new game: build a component that takes GP, add its id to MODES and MODE_INFO in lib/types.ts,
// and add it here. It then shows up on every chapter page and in the admin mode settings.
export const GAMES: Record<Mode, (p: GP) => React.ReactNode> = { same: SameGame, math: MathGame, learn: Learn, flashcards: Flashcards, quiz: Quiz, map: MapGame, entries: Entries, match: Match, rush: Rush };

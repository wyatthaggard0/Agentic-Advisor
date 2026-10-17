// TCU Core assignment. Credits the degree audit first, then completed, in-progress and planned courses by their
// Core tags (courses.json `core`), then picks real courses for the categories still open. Rules (NEELEY_RULES.md §5):
//  - a course counts for at most 2 Core categories, plus Writing Emphasis (WEM) on top
//  - OCO and WCO courses count only for themselves
//  - new Core: no more than 4 Core requirements from one prefix (OCO/WCO excluded)
//  - old Core: no course fills two Heritage categories; HUM/SSC/NSC need two different prefixes
//  - WEM must be 30000-40000 level

import type { Dataset } from "./load";
import { courseTitle } from "./load";
import type { CoreAlternative, CoreAssignment, Course, Requirement } from "./types";

export const CORE_NAMES: Record<string, string> = {
  MTH: "Mathematics", NSC: "Natural Sciences", OCO: "Oral Communication", WCO: "Written Communication", WEM: "Writing Emphasis",
  HUM: "Humanities", SSC: "Social Sciences", FAR: "Fine Arts", HT: "Historical Traditions", LT: "Literary Traditions",
  RT: "Religious Traditions", CA: "Cultural Awareness", GA: "Global Awareness", CSV: "Citizenship & Social Values",
};
const HERITAGE = ["RT", "HT", "LT", "CA", "GA", "CSV"];
const DIVERSE = ["HUM", "SSC", "NSC"];
const SKIP_SUBJECTS = ["HNRS", "HCOL", "HSPR"];

export interface CoreInput {
  completed: string[];
  inProgress: string[];
  planned: string[]; // business/program courses already in the plan
  satisfied: Record<string, number>; // degree-audit counts per category
  interests: string[];
  /** Courses whose prerequisites are met (completed or planned) */
  available: (c: Course) => boolean;
  /** Undecided students: Writing Emphasis will come from the major they pick */
  wemFromMajor: boolean;
  /** Student's own Core swaps: preferred courses win, avoided ones are never picked */
  prefer?: string[];
  avoid?: string[];
}

export interface CorePick {
  code: string;
  categories: string[];
  interest: string[];
  alternatives: CoreAlternative[];
}

export interface CoreResult {
  assignments: CoreAssignment[];
  picks: CorePick[];
  open: { slot: string; count: number }[];
  notes: string[];
}

export function assignCore(ds: Dataset, req: Requirement, input: CoreInput): CoreResult {
  const slots = req.coreSlots ?? [];
  const version = req.coreVersion ?? "new";
  const open = new Map(slots.map((s) => [s.code, s.count]));
  const assignments: CoreAssignment[] = [];
  const prefixUse = new Map<string, number>();
  const slotPrefixes = new Map<string, Set<string>>();
  const notes: string[] = [];
  const name = (c: string) => CORE_NAMES[c] ?? c;

  const take = (slot: string, a: Omit<CoreAssignment, "slot" | "slotName">) => {
    open.set(slot, (open.get(slot) ?? 0) - 1);
    assignments.push({ slot, slotName: name(slot), ...a });
    if (a.code && slot !== "OCO" && slot !== "WCO") {
      const prefix = a.code.split(" ")[0];
      prefixUse.set(prefix, (prefixUse.get(prefix) ?? 0) + 1);
      if (!slotPrefixes.has(slot)) slotPrefixes.set(slot, new Set());
      slotPrefixes.get(slot)!.add(prefix);
    }
  };

  /** Which open categories one course would fill, under the rules above. */
  const categoriesFor = (c: Course, forPick: boolean): string[] => {
    const tags = (c.core ?? []).filter((t) => (open.get(t) ?? 0) > 0);
    if (!tags.length) return [];
    for (const solo of ["OCO", "WCO"]) if (c.core?.includes(solo)) return tags.includes(solo) ? [solo] : [];
    let main = tags.filter((t) => t !== "WEM");
    if (version === "old") {
      const heritage = main.filter((t) => HERITAGE.includes(t));
      if (heritage.length > 1) main = main.filter((t) => !HERITAGE.includes(t) || t === heritage[0]);
      // HUM / SSC / NSC need two different prefixes: a pick can't repeat a prefix already in that category
      if (forPick) main = main.filter((t) => !(DIVERSE.includes(t) && slotPrefixes.get(t)?.has(c.subject)));
    }
    main = main.slice(0, 2);
    const wem = tags.includes("WEM") && c.level >= 3 ? ["WEM"] : [];
    return [...main, ...wem];
  };

  // 1. Degree audit
  for (const [slot, n] of Object.entries(input.satisfied)) {
    if (!open.has(slot)) continue;
    for (let i = 0; i < n && (open.get(slot) ?? 0) > 0; i++) take(slot, { source: "audit" });
  }
  // 2. Courses on the record and already in the plan
  const credit = (codes: string[], source: CoreAssignment["source"]) => {
    for (const code of codes) {
      const c = ds.courses.get(code);
      if (!c?.core) continue;
      for (const slot of categoriesFor(c, false)) take(slot, { source, code, title: courseTitle(c, code) });
    }
  };
  credit(input.completed, "completed");
  credit(input.inProgress, "in-progress");
  credit(input.planned, "planned");

  // 3. Pick courses for what's still open (Writing Emphasis for undecided students waits for the major)
  if (input.wemFromMajor && (open.get("WEM") ?? 0) > 0) {
    notes.push("Writing Emphasis will come from writing-emphasis courses in the major you choose.");
    open.set("WEM", 0);
  }
  const taken = new Set([...input.completed, ...input.inProgress, ...input.planned]);
  const pool = [...ds.courses.values()].filter(
    (c) =>
      c.core?.length &&
      !taken.has(c.code) &&
      !input.avoid?.includes(c.code) &&
      c.level >= 1 &&
      c.level <= 4 &&
      !SKIP_SUBJECTS.includes(c.subject) &&
      (c.credits ?? 0) >= 3 &&
      !c.conditions.some((k) => k.kind === "permission" || k.kind === "program" || k.kind === "major") &&
      input.available(c),
  );
  const picks: CorePick[] = [];
  const hasSections = (code: string) => ds.sections.some((s) => s.code === code);
  for (let guard = 0; guard < 25; guard++) {
    const stillOpen = [...open.entries()].filter(([, n]) => n > 0).map(([k]) => k);
    if (!stillOpen.length) break;
    let best: { c: Course; cats: string[]; score: number; interest: string[] } | null = null;
    for (const c of pool) {
      if (picks.some((p) => p.code === c.code)) continue;
      const cats = categoriesFor(c, true);
      if (!cats.length) continue;
      if (version === "new" && (prefixUse.get(c.subject) ?? 0) + cats.filter((t) => t !== "WEM").length > 4) continue;
      if (cats.includes("WEM") && cats.length === 1 && c.level < 3) continue;
      const text = `${courseTitle(c, c.code)} ${c.description}`.toLowerCase();
      const interest = input.interests.filter((k) => k.length > 2 && text.includes(k.toLowerCase()));
      const score =
        cats.filter((t) => t !== "WEM").length * 10 +
        (cats.includes("WEM") ? 4 : 0) +
        Math.min(3, interest.length) * 3 +
        (hasSections(c.code) ? 2 : 0) +
        (c.level === 1 ? 2 : c.level === 2 ? 1 : 0) +
        (c.prereqs.length ? -1 : 0) +
        (c.credits === 3 ? 1 : 0) +
        (input.prefer?.includes(c.code) ? 100 : 0);
      if (!best || score > best.score || (score === best.score && c.code < best.c.code)) best = { c, cats, score, interest };
    }
    if (!best) break;
    picks.push({ code: best.c.code, categories: best.cats, interest: best.interest, alternatives: [] });
    for (const slot of best.cats) take(slot, { source: "planned", code: best.c.code, title: courseTitle(best.c, best.c.code) });
  }

  // Other courses that fill the same categories, for the student to swap in
  for (const p of picks) {
    const solo = p.categories.find((t) => t === "OCO" || t === "WCO");
    p.alternatives = pool
      .filter((c) => !picks.some((q) => q.code === c.code) && p.categories.every((t) => c.core!.includes(t)))
      .filter((c) => (solo ? true : !c.core!.some((t) => t === "OCO" || t === "WCO")))
      .filter((c) => !p.categories.includes("WEM") || c.level >= 3)
      .map((c) => {
        const text = `${courseTitle(c, c.code)} ${c.description}`.toLowerCase();
        const interest = input.interests.filter((k) => k.length > 2 && text.includes(k.toLowerCase())).length;
        return { c, rank: (hasSections(c.code) ? 10 : 0) + Math.min(3, interest) * 2 + (c.level <= 2 ? 1 : 0) };
      })
      .sort((a, b) => b.rank - a.rank || a.c.code.localeCompare(b.c.code))
      .slice(0, 6)
      .map(({ c }) => ({
        code: c.code,
        title: courseTitle(c, c.code),
        categories: c.core!.filter((t) => CORE_NAMES[t]).map((t) => CORE_NAMES[t]),
        offered: hasSections(c.code),
      }));
  }

  const openList = [...open.entries()].filter(([, n]) => n > 0).map(([slot, count]) => ({ slot, count }));
  for (const { slot, count } of openList) for (let i = 0; i < count; i++) assignments.push({ slot, slotName: name(slot), source: "open" });
  return { assignments, picks, open: openList, notes };
}

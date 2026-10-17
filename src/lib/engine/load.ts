// Loads the academic data from /data at runtime. Files are re-read when their modification time changes,
// so the team can drop in a new courses.json / sections.json / programs.json without rebuilding the app.

import fs from "node:fs";
import path from "node:path";
import type {
  Course,
  CoursesFile,
  PrereqOverride,
  ProgramsFile,
  Section,
  SectionsFile,
  Student,
} from "./types";

export interface Dataset {
  courses: Map<string, Course>;
  sections: Section[];
  sectionsMeta: SectionsFile["meta"];
  programs: ProgramsFile;
  overridesApplied: string[];
  loadedAt: string;
  dataNotes: string[];
}

// Paths stay statically scoped to /data so the bundler only traces that folder
const dataPath = (...parts: string[]) => path.join(process.cwd(), "data", ...parts);
const cache = new Map<string, { mtime: number; value: unknown }>();

function readJson<T>(file: string, fallback?: T): T {
  const full = dataPath(file);
  if (!fs.existsSync(full)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing data file: data/${file}`);
  }
  const mtime = fs.statSync(full).mtimeMs;
  const hit = cache.get(full);
  if (hit && hit.mtime === mtime) return hit.value as T;
  const value = JSON.parse(fs.readFileSync(full, "utf8")) as T;
  cache.set(full, { mtime, value });
  return value;
}

let lastKey = "";
let lastData: Dataset | null = null;

export function loadData(): Dataset {
  const files = ["courses.json", "prereq_overrides.json", "sections.json", "programs.json"];
  const key = files
    .map((f) => {
      const full = dataPath(f);
      return fs.existsSync(full) ? fs.statSync(full).mtimeMs : 0;
    })
    .join("|");
  if (lastData && key === lastKey) return lastData;

  const coursesFile = readJson<CoursesFile>("courses.json");
  const overrides = readJson<{ overrides: Record<string, PrereqOverride> }>("prereq_overrides.json", { overrides: {} });
  const sectionsFile = readJson<SectionsFile>("sections.json", {
    meta: { source: "none", pulledAt: "", terms: [] },
    sections: [],
  });
  const programs = readJson<ProgramsFile>("programs.json");

  const courses = new Map<string, Course>();
  for (const c of coursesFile.courses) courses.set(c.code, { ...c });

  // Overrides always beat the auto-parsed prerequisites
  const overridesApplied: string[] = [];
  for (const [code, o] of Object.entries(overrides.overrides ?? {})) {
    const base = courses.get(code);
    if (!base) continue;
    courses.set(code, {
      ...base,
      ...(o.prereqs ? { prereqs: o.prereqs } : {}),
      ...(o.coreqs ? { coreqs: o.coreqs } : {}),
      ...(o.conditions ? { conditions: o.conditions } : {}),
      ...(o.permissionAlt !== undefined ? { permissionAlt: o.permissionAlt } : {}),
      ...(o.credits !== undefined ? { credits: o.credits } : {}),
      ...(o.title ? { title: o.title } : {}),
      parseConfidence: o.prereqs || o.conditions ? "override" : base.parseConfidence,
      source: o.source ? `${base.source}; override: ${o.source}` : base.source,
    });
    overridesApplied.push(code);
  }

  // Titles from programs.json course lists (catalog program pages list "SUBJ 12345 Title")
  const titles = (programs as unknown as { titles?: Record<string, string> }).titles ?? {};
  for (const [code, title] of Object.entries(titles)) {
    const c = courses.get(code);
    if (c && !c.title) courses.set(code, { ...c, title });
  }

  const dataNotes: string[] = [];
  if (sectionsFile.meta.sample) dataNotes.push("Sections are SAMPLE data until the TCU Class Search pull is loaded.");
  if (!programs.meta.verified) dataNotes.push(`Program rules are provisional (catalog ${programs.meta.catalogYear}) until the team's verified file replaces them.`);

  lastKey = key;
  lastData = {
    courses,
    sections: sectionsFile.sections,
    sectionsMeta: sectionsFile.meta,
    programs,
    overridesApplied,
    loadedAt: new Date().toISOString(),
    dataNotes,
  };
  return lastData;
}

export function loadStudent(id: string): Student {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Bad student id");
  return readJson<Student>(path.join("students", `${id}.json`));
}

export function listStudents(): { id: string; name: string; tag: string }[] {
  const dir = dataPath("students");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const s = readJson<Student & { tag?: string }>(path.join("students", f));
      return { id: s.id, name: s.name, tag: s.tag ?? "" };
    });
}

export function courseTitle(c: Course | undefined, code: string): string {
  if (!c) return code;
  if (c.title) return c.title;
  // The registrar export has no titles. A short opening phrase (e.g. "Freshman Seminar in Finance.") reads as a title;
  // anything longer is a description sentence, so say plainly that the title is missing.
  const d = c.description.replace(/^.*?Prerequisites?:[^.]*\.\s*/i, "").replace(/^\d+ (credit )?hours\.\s*/i, "");
  const first = (d.split(/(?<=\.)\s/)[0] ?? "").replace(/\.$/, "");
  const looksLikeTitle = first.length > 0 && first.length <= 45 && !/^(this|the|an?|students|topics|designed|prerequisite)\b/i.test(first);
  return looksLikeTitle ? first : "Title not in course export";
}

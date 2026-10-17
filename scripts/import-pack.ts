// Imports the team's neeley-planning-pack into the app's data files:
//   neeley-planning-pack/courses.csv          -> data/courses.json   (verified prereqs, Core tags, season/earliest rules)
//   neeley-planning-pack/neeley_programs.json -> data/programs.json  (both rulebooks, Core, all programs, rules, cost)
// Re-run after the team edits the pack: npm run data:pack

import fs from "node:fs";
import path from "node:path";
import type { Condition, Course, CoursesFile, PrereqRef, ProgramsFile, Program, Requirement, Season, Contradiction } from "../src/lib/engine/types";

const PACK = "neeley-planning-pack";

// ---------------- CSV ----------------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// Pack program ids -> app program ids
const PROGRAM_ID: Record<string, string> = {
  FINA: "BBA-FINA", ACCT: "BBA-ACCT", BIS: "BBA-BIS", MARK: "BBA-MARK", MANA: "BBA-MANA", ENTR: "BBA-ENTR", SVCM: "BBA-SVCM",
  "FINA-RE": "BBA-FINA-RE",
  "FINA-MIN": "MIN-FINA", "ACCT-MIN": "MIN-ACCT", "LEAD-MIN": "MIN-LEAD", "GENBUS-MIN": "MIN-GENBUS", "EI-MIN": "MIN-EI",
  "BIS-MIN": "MIN-BIS", "GLOBAL-MIN": "MIN-GLOBAL", "ENERGY-MIN": "MIN-ENERGY",
  FINTECH: "CERT-FINTECH", SALES: "CERT-SALES", "SUSTAIN-CERT": "CERT-SUSTAIN", "ENERGY-CERT": "CERT-ENERGY", "FINTECH-SCHOLAR": "CERT-FINTECH-SCHOLAR",
};
const mapId = (id: string) => PROGRAM_ID[id] ?? id;

// ---------------- Courses ----------------
const SEASONS: Season[] = ["Spring", "Summer", "Fall"];

function conditionsFrom(raw: string): { conditions: Condition[]; permissionAlt: boolean } {
  const conditions: Condition[] = [];
  let permissionAlt = false;
  for (const text of raw.split(";").map((s) => s.trim()).filter(Boolean)) {
    const t = text.toLowerCase();
    if (/alternative/.test(t)) {
      permissionAlt = true;
      continue;
    }
    const standing = /(sophomore|junior|senior) standing/.exec(t);
    if (standing) conditions.push({ kind: "standing", value: standing[1], text });
    else if (/^declared business information systems major/.test(t)) conditions.push({ kind: "program", value: "BBA-BIS", text });
    else if (/^declared business major/.test(t)) conditions.push({ kind: "major", value: "business-declared", text });
    else if (/^business major|^neeley school of business student/.test(t)) conditions.push({ kind: "major", value: "business", text });
    else if (/^leadership minor/.test(t)) conditions.push({ kind: "program", value: "MIN-LEAD", text });
    else if (/^real estate concentration/.test(t)) conditions.push({ kind: "program", value: "BBA-FINA-RE", text });
    else if (/^accounting major/.test(t)) conditions.push({ kind: "program", value: "BBA-ACCT", text });
    else if (/fashion merchandising major|^merchandising major|^comm major/.test(t)) conditions.push({ kind: "program", value: "NON-BBA", text });
    else if (/honors college admission/.test(t)) conditions.push({ kind: "program", value: "honors", text });
    else if (/admission|program enrollment/.test(t)) conditions.push({ kind: "program", value: "admission", text });
    else if (/approval|permission|consent/.test(t)) conditions.push({ kind: "permission", value: /instructor/.test(t) ? "instructor" : "department", text });
    else if (/microsoft office specialist/.test(t)) conditions.push({ kind: "test", value: "mos-excel", text });
    else conditions.push({ kind: "other", text });
  }
  return { conditions, permissionAlt };
}

function coursesFromPack(): Course[] {
  const rows = parseCsv(fs.readFileSync(path.join(PACK, "courses.csv"), "utf8").replace(/^﻿/, ""));
  return rows
    .filter((r) => /^[A-Z]{3,4} \d{5}$/.test(r.course))
    .map((r) => {
      const [subject, number] = r.course.split(" ");
      const minGrade = r.min_grade || undefined;
      const same = new Set(r.may_take_same_semester.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
      const prereqs: PrereqRef[][] = r.prerequisites
        ? r.prerequisites.split(/\s+AND\s+/).map((g) =>
            g
              .replace(/[()]/g, "")
              .split(/\s+OR\s+/)
              .map((c) => c.trim())
              .filter((c) => /^[A-Z]{3,4} \d{5}$/.test(c))
              .map((code) => ({ code, ...(minGrade ? { minGrade } : {}), ...(same.has(code) ? { concurrentOk: true } : {}) })),
          ).filter((g) => g.length)
        : [];
      const { conditions, permissionAlt } = conditionsFrom(r.conditions);
      const credits = /^\d+(\.\d+)?$/.test(r.credits) ? Number(r.credits) : null;
      const season = SEASONS.filter((s) => r.season_rule.toLowerCase().startsWith(s.toLowerCase()));
      const usedBy = [...new Set([...r.used_by.matchAll(/(?:^|;\s*)([A-Z][A-Z-]+?)\s\((?:required|option)/g)].map((m) => mapId(m[1])))];
      const notes = [r.advisor_note, r.refs_missing_from_catalog ? `References ${r.refs_missing_from_catalog}, which isn't in TCU's course list.` : ""].filter(Boolean);
      const c: Course = {
        code: r.course,
        subject,
        number,
        ...(r.title ? { title: r.title } : {}),
        credits,
        level: Number(number[0]),
        description: r.description,
        prereqs,
        coreqs: r.corequisites_required.split(/[,;]/).map((s) => s.trim()).filter((s) => /^[A-Z]{3,4} \d{5}$/.test(s)),
        conditions,
        ...(permissionAlt ? { permissionAlt } : {}),
        ...(r.prereq_text_original ? { prereqText: r.prereq_text_original } : {}),
        parseConfidence: r.prereq_source === "verified" ? "verified" : "parsed",
        source:
          r.prereq_source === "verified"
            ? "Neeley planning pack, prerequisites verified by hand against TCU's text"
            : "Neeley planning pack, read automatically from TCU's course text",
        ...(r.core_attributes ? { core: r.core_attributes.split(/\s+/).filter(Boolean) } : {}),
        ...(season.length ? { seasons: season, seasonNote: r.season_rule } : {}),
        ...(r.earliest_semester_index ? { earliest: Number(r.earliest_semester_index) } : {}),
        ...(r.preferred_earliest_semester ? { preferredEarliest: Number(r.preferred_earliest_semester) } : {}),
        ...(notes.length ? { advisorNote: notes.join(" ") } : {}),
        ...(usedBy.length ? { usedBy } : {}),
      };
      return c;
    });
}

// ---------------- Programs ----------------
interface PackReq { type: "all" | "one" | "hours"; label: string; courses?: string[]; options?: string[]; hours?: number; note?: string }
interface PackProgram {
  id: string; type: string; name: string; url?: string; hours_published?: string | null; requirements: PackReq[];
  match_tags?: string[]; substitutions?: Record<string, string[]>; advisor_flags?: string[]; blocked_for_majors?: string[];
  blocked_all_bba?: boolean; blocked_reason?: string; max_shared_hours?: number | null; application?: boolean; rules?: string[];
}

function programsFromPack(courses: Map<string, Course>): ProgramsFile {
  const pack = JSON.parse(fs.readFileSync(path.join(PACK, "neeley_programs.json"), "utf8"));
  const requirements: Record<string, Requirement> = {};
  const programs: Record<string, Program> = {};

  // Rulebooks (cohorts) and their business groups
  const cohorts = (["old", "new"] as const).map((cid) => {
    const c = pack.cohorts[cid];
    const reqIds: string[] = [];
    for (const g of c.bba_groups) {
      const id = `${cid}-${g.id}`;
      requirements[id] = {
        id,
        name: `${g.label}${cid === "old" ? " (pre-2025 rules)" : ""}`,
        type: "all",
        courses: g.courses,
        source: g.source,
        ...(g.notes?.length ? { note: g.notes.join(" ") } : {}),
        verified: g.confidence === "confirmed",
      };
      reqIds.push(id);
    }
    const core = pack.core[cid];
    const coreId = `core-${cid}`;
    requirements[coreId] = { id: coreId, name: core.label, type: "core", coreSlots: core.slots, coreVersion: cid, rules: core.rules, source: core.source };
    reqIds.push(coreId);
    return {
      id: cid,
      label: c.label,
      startsFrom: cid === "old" ? "Fall 2000" : "Summer 2025",
      totalHours: c.total_hours,
      upperDivHours: c.upper_division_hours,
      tcuHours: c.tcu_hours,
      requirements: reqIds,
      source: c.total_hours_source + (c.total_hours_conflict ? ` (conflict: ${c.total_hours_conflict})` : ""),
    };
  });

  for (const p of pack.programs as PackProgram[]) {
    const pid = mapId(p.id);
    const reqIds: string[] = [];
    p.requirements.forEach((r, i) => {
      let list = r.courses ?? r.options ?? [];
      // Catalog substitutions (e.g. BIS: INSC 30273 may replace INSC 40843) become one-of-two choices
      if (r.type === "all" && p.substitutions) {
        for (const [orig, subs] of Object.entries(p.substitutions)) {
          if (!list.includes(orig)) continue;
          list = list.filter((c) => c !== orig);
          const sid = `${pid}-sub-${orig.replace(" ", "")}`;
          requirements[sid] = {
            id: sid,
            name: `${p.name}: ${orig} or approved substitute`,
            type: "choose",
            count: 1,
            courses: [orig, ...subs],
            source: p.url ?? "neeley_programs.json",
            note: `${subs.join(", ")} may substitute for ${orig}`,
            tags: p.match_tags,
          };
          reqIds.push(sid);
        }
      }
      const id = `${pid}-r${i + 1}`;
      requirements[id] = {
        id,
        name: `${p.name}: ${r.label}`,
        type: r.type === "all" ? "all" : "choose",
        courses: list,
        ...(r.type === "one" ? { count: 1 } : {}),
        ...(r.type === "hours" ? { hours: r.hours } : {}),
        source: p.url ?? "neeley_programs.json",
        ...(r.note ? { note: r.note } : {}),
        tags: p.match_tags,
      };
      reqIds.unshift(...[]);
      reqIds.push(id);
    });
    const kind = p.type === "concentration" ? "major" : (p.type as Program["kind"]);
    const blocked = (p.blocked_for_majors ?? []).filter((b) => !b.startsWith("NON-")).map(mapId);
    programs[pid] = {
      id: pid,
      name: p.name,
      kind,
      ...(kind === "major" ? { field: p.id.split("-")[0] } : {}),
      requirements: reqIds,
      ...(p.hours_published ? { hoursPublished: p.hours_published } : {}),
      ...(kind === "major"
        ? { declare: { text: `Declare after ${pack.declare_major.courses.join(", ")} and 24 hours, with a ${pack.declare_major.gpa} GPA.`, minHours: 24, courses: pack.declare_major.courses } }
        : {}),
      source: p.url ?? "neeley_programs.json",
      verified: true,
      ...(blocked.length ? { blockedWith: blocked } : {}),
      ...(p.blocked_all_bba ? { blockedForBusiness: p.blocked_reason ?? "Not open to Neeley majors" } : {}),
      ...(p.max_shared_hours ? { maxShared: p.max_shared_hours } : {}),
      ...(p.application ? { application: true } : {}),
      ...(p.advisor_flags?.length ? { advisorFlags: p.advisor_flags } : {}),
      ...(p.rules?.length ? { rules: p.rules } : {}),
      ...(p.match_tags ? { tags: p.match_tags } : {}),
      selectable: !p.blocked_all_bba && p.requirements.length > 0 && !/graduate/i.test(p.name),
    };
  }
  // A concentration replaces its base major
  if (programs["BBA-FINA-RE"]) programs["BBA-FINA-RE"].blockedWith = [...(programs["BBA-FINA-RE"].blockedWith ?? []), "BBA-FINA"];

  // Pre-business placeholder for undecided students (ours, not in the pack)
  requirements["major-tbd"] = {
    id: "major-tbd",
    name: "Neeley major courses (after declaring)",
    type: "slot",
    hours: 24,
    minLevel: 3,
    tags: ["major"],
    source: "Neeley majors are 21-33 hours (neeley_programs.json)",
  };
  programs["BBA-UNDECIDED"] = {
    id: "BBA-UNDECIDED",
    name: "Pre-business (major not chosen)",
    kind: "major",
    requirements: ["major-tbd"],
    declare: { text: `Declare after ${pack.declare_major.courses.join(", ")} and 24 hours, with a ${pack.declare_major.gpa} GPA.`, minHours: 24, courses: pack.declare_major.courses },
    source: pack.declare_major.source,
    selectable: true,
  };

  const majorIds = Object.values(programs).filter((p) => p.kind === "major" && p.id !== "BBA-UNDECIDED").map((p) => p.id);
  const contradictions: Contradiction[] = [
    { id: "mana-30350", title: "MANA 30350 is missing", text: "The new business core lists MANA 30250 + MANA 30350, but MANA 30350 isn't in TCU's course list.", affects: ["new-business-core", "MANA 30250"], source: "Neeley checklists vs TCU course export" },
    { id: "mana-30253", title: "MANA 30253 stands in for MANA 30250", text: "Neither MANA 30250 nor MANA 40250 has a section in Fall 2026 or Spring 2027; MANA 30253 (OB and Strategy, 3 hrs) runs, so the plan uses it. An advisor must confirm it satisfies the business core.", affects: ["new-business-core", "MANA 30253"], source: "TCU Class Search 2026-27; Neeley four-year plans" },
    { id: "acct-20153", title: "ACCT 20153 doesn't exist", text: "MANA 30153 and MANA 30253 list ACCT 20153 as a prerequisite, which isn't in TCU's course list. The plan treats it as ACCT 20353.", affects: ["MANA 30153", "MANA 30253"], source: "TCU course text vs course export" },
    { id: "busi-10153", title: "BUSI 10153 is no longer listed", text: "BUSI 10153 is on older checklists but not in TCU's course list, and BUSI 10151 has no sections. Completed is fine; if still needed, an advisor picks the replacement.", affects: ["old-foundation"], source: "Course export; Class Search" },
    { id: "entr-20153", title: "ENTR 20153 has no 2026-27 sections", text: "ENTR 20153 (old business foundation) has no 2026-27 sections. An advisor approves a substitute, likely ENTR 20263.", affects: ["old-foundation"], source: "TCU Class Search" },
    { id: "hours-120-124", title: "120 vs. 124 total hours", text: "TCU's Advising FAQ says 120 hours; the Neeley Graduation Checklist says 124 for older students. The plan uses 120.", affects: ["cohort:old"], source: "TCU Advising FAQ vs Neeley Graduation Checklist" },
    { id: "residency", title: "Residency hours differ by source", text: "New checklists say 45 TCU hours / 36 upper-level; the Graduation Checklist says 58 / 42. The plan uses your rulebook's numbers.", affects: ["degree"], source: "Neeley pages" },
    { id: "standing", title: "Class-standing cutoffs not confirmed", text: "The 24 / 54 / 84-hour standing cutoffs come from older catalogs and aren't confirmed for 2026-27.", affects: ["degree"], source: "Older TCU catalogs" },
    { id: "first-year-major", title: "First-year 'business major' status unclear", text: "TCU doesn't say whether first-year business students count as 'business majors' for course gates. The plan uses the earliest-semester rules.", affects: ["BBA-UNDECIDED"], source: "Not stated by TCU" },
    { id: "acct-hours", title: "Accounting major hours conflict", text: "21 hrs (program page) vs 31.5-33 (major page) vs 25.5 + 9-12 associated (checklist, with graduate-numbered ACCT 55450/55460).", affects: ["BBA-ACCT"], source: "Catalog vs checklist" },
    { id: "global-min", title: "Global Business minor hours", text: "Its parts add to 24 hours but it's published as 18.", affects: ["MIN-GLOBAL"], source: "Catalog" },
    { id: "bis-min", title: "BIS minor elective count unclear", text: "The page doesn't say how many courses to pick from the final 'OR' block; the plan assumes 2.", affects: ["MIN-BIS"], source: "Catalog" },
    { id: "sustain", title: "Sustainable Business Certificate incomplete", text: "Total hours aren't published, so the plan never marks it complete.", affects: ["CERT-SUSTAIN"], source: "Neeley pages" },
    { id: "mana-major", title: "Management major requirement conflict", text: "The catalog requires MANA 40153; the after-summer-2025 checklist lists MANA 30313 instead and adds MANA 40323 as an elective. The plan uses the catalog list.", affects: ["BBA-MANA"], source: "Catalog vs checklist" },
    { id: "svcm-major", title: "Supply & Value Chain major conflict", text: "Catalog: 3 required + 12 elective hours; checklist: 8 fixed courses (22 hrs). The plan uses the catalog list.", affects: ["BBA-SVCM"], source: "Catalog vs checklist" },
    { id: "fina-re-ethics", title: "Real Estate global-content trap", text: "Choosing FINA 40623 adds a 1.5-hr ethics course whose versions either need ACCT 30253/30273 or aren't scheduled. The plan steers to BUSI 30383.", affects: ["BBA-FINA-RE"], source: "Catalog; Class Search" },
    { id: "fina-40970", title: "FINA 40970 counts only for two topics", text: "FINA 40970 counts as a Finance elective only for Alternative Asset Investments and Equity Investments Practicum. Check the section title.", affects: ["FINA 40970"], source: "Catalog" },
    { id: "bis-catalog", title: "BIS major has no elective", text: "The current catalog requires INSC 40383 and allows INSC 30273 for INSC 40843 and INSC 30283 for INSC 30833.", affects: ["BBA-BIS"], source: "Catalog" },
    { id: "fina-30313", title: "FINA 30313 is Real Estate only", text: "FINA 30313 is listed as a Finance elective but restricted to Real Estate concentration students.", affects: ["FINA 30313"], source: "Course text" },
    { id: "mark-40033", title: "MARK 40033 isn't in the course list", text: "The Marketing checklist lists MARK 40033; the catalog has MARK 40030. The plan uses MARK 40030.", affects: ["BBA-MARK"], source: "Checklist vs export" },
    { id: "lead-tracks", title: "Leadership minor has two tracks", text: "Standard track vs BNSF Neeley Leadership Program track, which only adds up to 15 of the 18 hours.", affects: ["MIN-LEAD"], source: "Catalog" },
  ];

  const cost = {
    tuitionPerSemester: 33260,
    housingFoodPerSemester: 9390,
    year: "2026-27",
    source: "https://financialaid.tcu.edu/cost/cost-of-attendance/undergraduate.php",
    note: "Tuition is half of TCU's $66,520 annual rate; housing and food are on-campus estimates. An extra semester also delays full-time pay. TCU gains the tuition, so the student's cost and the university's revenue are separate.",
  };

  // Titles for the few referenced courses missing from the CSV are left out; courses carry their own titles now.
  void courses;
  return {
    meta: {
      source: "Neeley planning pack (neeley_programs.json + NEELEY_RULES.md), built 2026-10-17 from official TCU sources",
      catalogYear: "2026-27",
      verified: true,
      note: "Program requirements are from official pages with conflicts flagged in contradictions. Class-standing cutoffs and first-year 'business major' status are labeled historical / unconfirmed.",
    },
    standing: { sophomore: pack.standing_hours.sophomore, junior: pack.standing_hours.junior, senior: pack.standing_hours.senior, source: `${pack.standing_hours.note} (historical; confirm for 2026-27)` },
    load: { max: pack.load.max_without_approval, fullTime: 12, summerMax: pack.load.summer_session_max, source: pack.load.source },
    cohorts,
    requirements,
    programs,
    rules: {
      maxMajors: 2,
      sharedHours: majorIds.flatMap((a, i) => majorIds.slice(i + 1).map((b) => ({ between: [a, b], maxShared: 6, source: "TCU Academic Policies: a course counts toward two majors only with dean approval, up to 6 credits per major. Neeley publishes no stricter rule." }))),
      earliest: [],
      declareCourses: pack.declare_major.courses,
      declareMinHours: 24,
      businessUpperDefault: { index: pack.not_before.business_upper_default, prefixes: pack.not_before.business_prefixes, source: pack.not_before.source },
      source: "NEELEY_RULES.md sections 2-4; TCU Academic Policies",
    },
    contradictions,
    opportunities: (pack.opportunities as { id: string; name: string; when: string; gate: string; url: string; plan_effect: string; tags: string[] }[]).map((o) => ({
      id: o.id,
      name: o.name,
      text: `${o.gate}${o.plan_effect ? ` ${o.plan_effect}` : ""}`,
      source: o.url,
      when: o.when,
      tags: o.tags,
      planEffect: o.plan_effect,
    })),
    cost,
  };
}

const courses = coursesFromPack();
const out: CoursesFile = {
  meta: {
    source: "Neeley planning pack courses.csv (TCU course export with verified prerequisites for Neeley courses)",
    generatedAt: new Date().toISOString(),
    note: "151 Neeley courses have hand-verified prerequisites; the rest are read automatically from TCU's text. prereq_overrides.json takes precedence.",
  },
  courses,
};
fs.writeFileSync("data/courses.json", JSON.stringify(out, null, 1));
const programs = programsFromPack(new Map(courses.map((c) => [c.code, c])));
fs.writeFileSync("data/programs.json", JSON.stringify(programs, null, 2) + "\n");
// The rules document goes to Claude as reference text (the engine still decides placements)
fs.copyFileSync(path.join(PACK, "NEELEY_RULES.md"), "data/neeley_rules.md");
console.log(
  `courses.json: ${courses.length} courses (${courses.filter((c) => c.parseConfidence === "verified").length} verified, ${courses.filter((c) => c.core).length} with Core tags, ${courses.filter((c) => c.seasons).length} season rules)`,
);
console.log(`programs.json: ${Object.keys(programs.programs).length} programs, ${Object.keys(programs.requirements).length} requirement groups, ${programs.contradictions.length} known data problems`);

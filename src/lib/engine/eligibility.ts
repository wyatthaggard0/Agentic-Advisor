// Offering evidence and per-term eligibility (prerequisites, standing, major, permission).

import type { Dataset } from "./load";
import type { Course, PrereqRef, Season, Student } from "./types";
import { compareTerms, seasonOf } from "./terms";

export type OfferStatus = "confirmed" | "not-offered" | "historical" | "other-season" | "assumed";

export interface Offer {
  status: OfferStatus;
  note: string;
  source: string;
  /** Posted schedules exist for the subject but the course was never seen: needs an advisor check. */
  unverified?: boolean;
}

/**
 * What the posted schedules say about a course in a term.
 *  - Posted term with complete coverage: a section means confirmed; no section means not offered (never place it).
 *  - Future term: seen in the matching season of a posted term means "historical, assumed to repeat";
 *    seen only in the other season means avoid; seen in neither means no evidence (advisor flag).
 */
export function offering(ds: Dataset, code: string, term: string): Offer {
  const subject = code.split(" ")[0];
  const sample = ds.sectionsMeta.sample ? " (sample section data)" : "";
  const covered = (t: { coverage: string; subjects?: string[] }) => t.coverage === "complete" || (t.subjects ?? []).includes(subject);
  const posted = ds.sectionsMeta.terms.filter(covered);
  const src = `${ds.sectionsMeta.source}${sample}`;

  // A season rule from the Neeley checklists (e.g. FINA 40623 fall only) overrides schedule evidence
  const course = ds.courses.get(code);
  if (course?.seasons?.length && !course.seasons.includes(seasonOf(term))) {
    return { status: "not-offered", note: `${course.seasonNote ?? `${course.seasons.join("/")} only`}`, source: "Neeley checklists (season rule)" };
  }
  const thisTerm = posted.find((t) => t.term === term);
  const secs = ds.sections.filter((s) => s.code === code);
  if (thisTerm) {
    const n = secs.filter((s) => s.term === term).length;
    if (n > 0) return { status: "confirmed", note: `${n} section${n > 1 ? "s" : ""} posted for ${term}${sample}`, source: src };
    return { status: "not-offered", note: `No section on the posted ${term} schedule${sample}`, source: src };
  }
  if (posted.length === 0) {
    return { status: "assumed", note: "No posted schedule covers this subject yet; offering not verified", source: "none" };
  }
  const season = seasonOf(term);
  const seenSeasons = new Set<Season>(
    secs.filter((s) => posted.some((p) => p.term === s.term)).map((s) => seasonOf(s.term)),
  );
  const postedSeasons = new Set<Season>(posted.map((p) => seasonOf(p.term)));
  if (seenSeasons.has(season)) {
    const seen = posted.filter((p) => seasonOf(p.term) === season && secs.some((s) => s.term === p.term)).map((p) => p.term);
    return { status: "historical", note: `Offered ${seen.join(", ")}; assumed to repeat, not guaranteed`, source: src };
  }
  if (seenSeasons.size > 0 && postedSeasons.has(season)) {
    return {
      status: "other-season",
      note: `Only seen in ${[...seenSeasons].join("/")} on posted schedules; not seen in ${season}`,
      source: src,
    };
  }
  if (seenSeasons.size > 0) {
    return { status: "historical", note: `Seen in ${[...seenSeasons].join("/")}; no posted ${season} schedule to compare`, source: src };
  }
  return { status: "assumed", note: `Not on any posted schedule${sample}; offering unverified`, source: src, unverified: true };
}

const GRADE_POINTS: Record<string, number> = {
  "A": 4, "A-": 3.67, "B+": 3.33, "B": 3, "B-": 2.67, "C+": 2.33, "C": 2, "C-": 1.67, "D+": 1.33, "D": 1, "D-": 0.67, "F": 0,
};

export function meetsGrade(grade: string | undefined, min: string | undefined): boolean {
  if (!min) return grade !== "F" && grade !== "W";
  if (!grade || grade === "IP") return true; // in progress: satisfied pending the final grade
  if (grade === "P" || grade === "CR" || grade === "TR") return true;
  const g = GRADE_POINTS[grade.toUpperCase()];
  const m = GRADE_POINTS[min.toUpperCase()];
  if (g === undefined || m === undefined) return true;
  return g >= m;
}

export interface PlanState {
  /** term each course is completed/scheduled in; completed courses use their own term */
  placedTerm: Map<string, string>;
  grades: Map<string, string>;
  hoursBefore: (term: string) => number;
}

export interface Eligibility {
  ok: boolean;
  missing: string[];
  notes: string[];
  advisor: string[];
  pendingGrade: string[];
}

function refSatisfied(ref: PrereqRef, term: string, st: PlanState): "yes" | "no" | "pending" {
  const at = st.placedTerm.get(ref.code);
  if (!at) return "no";
  const cmp = compareTerms(at, term);
  if (cmp > 0) return "no";
  if (cmp === 0 && !ref.concurrentOk) return "no";
  const grade = st.grades.get(ref.code);
  if (grade === undefined) return "yes"; // planned in an earlier term; minimum grade is a future condition
  if (grade === "IP") return "pending";
  return meetsGrade(grade, ref.minGrade) ? "yes" : "no";
}

/** Semester index from the student's first term: 0 = first fall (or first spring for a spring start), counting fall/spring only. */
export function semesterIndex(startTerm: string, term: string): number {
  let first = startTerm;
  if (first.startsWith("Summer")) first = `Fall ${first.split(" ")[1]}`;
  let i = 0;
  let cur = first;
  while (compareTerms(cur, term) < 0) {
    cur = cur.startsWith("Fall") ? `Spring ${Number(cur.split(" ")[1]) + 1}` : `Fall ${cur.split(" ")[1]}`;
    i++;
    if (i > 40) break;
  }
  return i;
}

export function standingHours(ds: Dataset, level: string): number {
  const s = ds.programs.standing;
  return level === "senior" ? s.senior : level === "junior" ? s.junior : level === "sophomore" ? s.sophomore : 0;
}

export function checkEligibility(
  ds: Dataset,
  student: Student,
  course: Course,
  term: string,
  st: PlanState,
  ctx: { declaredBy?: string; programs: string[] },
): Eligibility {
  const res: Eligibility = { ok: true, missing: [], notes: [], advisor: [], pendingGrade: [] };
  for (const group of course.prereqs) {
    let best: "yes" | "no" | "pending" = "no";
    for (const ref of group) {
      const r = refSatisfied(ref, term, st);
      if (r === "yes") {
        best = "yes";
        break;
      }
      if (r === "pending") best = "pending";
    }
    if (best === "no") {
      res.ok = false;
      res.missing.push(group.map((r) => r.code + (r.minGrade ? ` (${r.minGrade} or better)` : "")).join(" or "));
    } else if (best === "pending") {
      res.pendingGrade.push(group.map((r) => r.code).join(" or "));
    }
  }
  // Earliest semester from TCU's four-year plans (0 = first fall): never earlier than the hard rule
  const idx = semesterIndex(student.startTerm, term);
  const bud = ds.programs.rules.businessUpperDefault;
  const hardEarliest =
    course.earliest ?? (bud && course.level >= 3 && course.level <= 4 && bud.prefixes.includes(course.subject) ? bud.index : undefined);
  if (hardEarliest !== undefined && idx < hardEarliest) {
    res.ok = false;
    res.missing.push(`semester ${hardEarliest + 1} or later (TCU four-year plan; this is semester ${idx + 1})`);
  }
  // Earliest-semester rules from programs.json (e.g. capstones in the final year)
  const earliest = ds.programs.rules.earliest.filter((r) => r.course === course.code);
  const conditions = [
    ...course.conditions,
    ...earliest.map((r) =>
      r.rule === "standing"
        ? { kind: "standing" as const, value: r.value, text: `${r.value} standing (earliest-semester rule)` }
        : { kind: "major" as const, value: "business-declared", text: r.value },
    ),
  ];
  for (const cond of conditions) {
    switch (cond.kind) {
      case "standing": {
        const need = standingHours(ds, cond.value ?? "");
        const have = st.hoursBefore(term);
        if (have < need) {
          res.ok = false;
          res.missing.push(`${cond.value} standing (${need} hours; you'll have ${have})`);
        }
        break;
      }
      case "major":
      case "admission": {
        const businessStudent = ctx.programs.some((p) => p.startsWith("BBA-"));
        if (cond.value === "business") {
          if (!businessStudent) {
            res.ok = false;
            res.missing.push("business student status");
          }
        } else if (cond.value === "business-declared") {
          if (!student.declared && (!ctx.declaredBy || compareTerms(term, ctx.declaredBy) < 0)) {
            res.ok = false;
            res.missing.push("declared business major");
          } else if (!student.declared) {
            res.notes.push(`Assumes you've advanced into your major by ${ctx.declaredBy}`);
          }
        } else {
          res.notes.push(`Restricted: ${cond.text}`);
        }
        break;
      }
      case "program": {
        // "Program admission required" is met by any selected program that uses the course
        const inProgram =
          (cond.value === "admission" && (course.usedBy ?? []).some((p) => ctx.programs.includes(p))) ||
          (cond.value === "certificate" && ctx.programs.some((p) => p.startsWith("CERT-"))) ||
          ctx.programs.includes(cond.value ?? "");
        if (!inProgram) {
          res.ok = false;
          res.missing.push(cond.text);
        }
        break;
      }
      case "permission":
        res.advisor.push(`${course.code} needs ${cond.value ?? "department"} permission to enroll`);
        break;
      case "test":
        res.notes.push(`Requires ${cond.text}`);
        break;
      default:
        res.notes.push(cond.text);
    }
  }
  return res;
}

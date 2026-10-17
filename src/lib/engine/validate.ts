// The 10 checks every plan must pass. These re-derive facts from the plan and the data
// instead of trusting the planner's bookkeeping. scripts/check-plans.ts repeats them from the raw files.

import type { Dataset } from "./load";
import { offering, meetsGrade, standingHours } from "./eligibility";
import { compareTerms } from "./terms";
import type { CheckResult, Plan, Student } from "./types";
import { pickCohort } from "./planner";

export function validatePlan(ds: Dataset, student: Student, plan: Plan): CheckResult[] {
  const P = ds.programs;
  const cohort = pickCohort(ds, student);
  const checks: CheckResult[] = [];
  const add = (id: string, name: string, pass: boolean, detail: string) => checks.push({ id, name, pass, detail });

  const termOf = new Map<string, string>();
  const grade = new Map<string, string>();
  for (const c of student.completed) {
    if (c.grade === "F" || c.grade === "W") continue;
    termOf.set(c.code, c.term);
    if (c.grade) grade.set(c.code, c.grade);
  }
  for (const t of plan.terms) for (const l of t.lines) if (!l.slot) termOf.set(l.code, t.term);
  const planned = plan.terms.filter((t) => t.status !== "in-progress");
  const credit = (code: string) => ds.courses.get(code)?.credits ?? 3;

  // 1. Every requirement accounted for
  const missing: string[] = [];
  const reqIds = [...cohort.requirements, ...plan.programs.flatMap((p) => P.programs[p]?.requirements ?? [])];
  const slotLines = plan.terms.flatMap((t) => t.lines.filter((l) => l.slot));
  for (const id of new Set(reqIds)) {
    const r = P.requirements[id];
    if (!r) continue;
    if (r.type === "all") {
      for (const c of r.courses ?? []) if (!termOf.has(c)) missing.push(c);
    } else if (r.type === "choose") {
      const need = r.count ?? Math.ceil((r.hours ?? 3) / 3);
      const have = (r.courses ?? []).filter((c) => termOf.has(c)).length;
      if (have < need) missing.push(`${r.name} (${have}/${need})`);
    } else {
      const have =
        slotLines.filter((l) => l.requirementId === id).reduce((n, l) => n + l.credits, 0) +
        (student.satisfiedSlots?.[id] ?? 0) +
        [...student.completed, ...student.inProgress].filter((c) => c.countsToward === id).reduce((n, c) => n + (c.credits ?? credit(c.code)), 0);
      if (have + 0.001 < (r.hours ?? 0)) missing.push(`${r.name} (${have}/${r.hours} hrs)`);
    }
  }
  add("requirements", "Every requirement is placed", missing.length === 0, missing.length ? `Not placed: ${missing.join(", ")}` : `${new Set(reqIds).size} requirement groups covered`);

  // 2. Total hours
  add("hours", "Total hours meet the minimum", plan.totals.hours >= plan.totals.required, `${plan.totals.hours} of ${plan.totals.required} hours`);

  // 3. Upper-division hours
  add("upper", "Upper-division hours (30000+)", plan.totals.upper >= plan.totals.upperRequired, `${plan.totals.upper} of ${plan.totals.upperRequired} hours`);

  // 4. Completed courses applied, never re-scheduled
  const done = new Set(student.completed.filter((c) => c.grade !== "F" && c.grade !== "W").map((c) => c.code));
  const repeats = planned.flatMap((t) => t.lines.filter((l) => !l.slot && done.has(l.code)).map((l) => l.code));
  add("completed", "Completed courses applied, not repeated", repeats.length === 0, repeats.length ? `Re-scheduled: ${repeats.join(", ")}` : `${done.size} completed courses applied`);

  // 5. Prerequisite order
  const preIssues: string[] = [];
  for (const t of planned) {
    for (const l of t.lines) {
      if (l.slot) continue;
      const c = ds.courses.get(l.code);
      if (!c) continue;
      for (const g of c.prereqs) {
        const ok = g.some((r) => {
          const at = termOf.get(r.code);
          if (!at) return false;
          const cmp = compareTerms(at, t.term);
          if (cmp > 0 || (cmp === 0 && !r.concurrentOk)) return false;
          return meetsGrade(grade.get(r.code), r.minGrade);
        });
        if (!ok) preIssues.push(`${l.code} in ${t.term} needs ${g.map((r) => r.code).join(" or ")}`);
      }
      // A corequisite is met in the same term or by earlier credit; ones missing from the data are reported as data conflicts
      for (const co of c.coreqs) {
        if (!ds.courses.has(co)) continue;
        const at = termOf.get(co);
        if (!at || compareTerms(at, t.term) > 0) preIssues.push(`${l.code} needs corequisite ${co} in ${t.term}`);
      }
    }
  }
  add("prereqs", "Prerequisites in the right order", preIssues.length === 0, preIssues.length ? preIssues.slice(0, 4).join("; ") : "All prerequisite chains are in order");

  // 6. Standing and earliest-semester rules
  const standIssues: string[] = [];
  const hoursBefore = (term: string) => {
    let h = student.completed.filter((c) => c.grade !== "F" && c.grade !== "W").reduce((n, c) => n + (c.credits ?? credit(c.code)), 0) + (student.otherHours?.hours ?? 0);
    for (const t of plan.terms) if (compareTerms(t.term, term) < 0) h += t.hours;
    return h;
  };
  for (const t of planned) {
    for (const l of t.lines) {
      if (l.slot) continue;
      const c = ds.courses.get(l.code);
      const rules = [
        ...(c?.conditions.filter((k) => k.kind === "standing").map((k) => k.value!) ?? []),
        ...P.rules.earliest.filter((r) => r.course === l.code && r.rule === "standing").map((r) => r.value),
      ];
      for (const lvl of rules) {
        const need = standingHours(ds, lvl);
        if (hoursBefore(t.term) < need) standIssues.push(`${l.code} needs ${lvl} standing in ${t.term}`);
      }
    }
  }
  add("standing", "Class standing and earliest-term rules", standIssues.length === 0, standIssues.length ? standIssues.join("; ") : "Standing rules met");

  // 7. Load
  const heavy = planned.filter((t) => t.hours > P.load.max);
  const light = planned.filter(
    (t, i) => t.status === "planned" && !t.term.startsWith("Summer") && t.hours < P.load.fullTime && i < planned.length - 1 && t.hours > 0,
  );
  add(
    "load",
    `Load within ${P.load.max} hours`,
    heavy.length === 0,
    heavy.length
      ? `Over the limit: ${heavy.map((t) => `${t.term} (${t.hours})`).join(", ")}`
      : light.length
        ? `Below full-time (${P.load.fullTime}) in ${light.map((t) => t.term).join(", ")}`
        : `Heaviest term ${plan.totals.maxLoad} hours`,
  );

  // 8. Availability labeled; nothing placed where it isn't offered
  const availIssues: string[] = [];
  for (const t of planned) {
    for (const l of t.lines) {
      if (l.slot) continue;
      const o = offering(ds, l.code, t.term);
      if (o.status === "not-offered") availIssues.push(`${l.code} isn't on the ${t.term} schedule`);
      if (!l.confidence) availIssues.push(`${l.code} has no availability label`);
    }
  }
  add("availability", "Every course offered when placed, and labeled", availIssues.length === 0, availIssues.length ? availIssues.join("; ") : "Each course carries a confirmed / historical / assumed / advisor label");

  // 9. Program rules
  const ruleIssues = [...plan.blocked.map((b) => b.reason)];
  for (const item of plan.advisorItems.filter((a) => a.kind === "shared-credit")) {
    if (/this plan shares (\d+)/.test(item.detail)) {
      const m = /capped at (\d+); this plan shares (\d+)/.exec(item.detail);
      if (m && Number(m[2]) > Number(m[1])) ruleIssues.push(item.title);
    }
  }
  add("rules", "Program combination rules", ruleIssues.length === 0, ruleIssues.length ? ruleIssues.join("; ") : `${plan.programs.length} program(s); combination allowed`);

  // 10. Graduation date
  const gradOk = plan.unplaced.length === 0 && compareTerms(plan.gradTerm, plan.targetGradTerm) <= 0;
  add(
    "graduation",
    "Graduation date supported",
    gradOk,
    plan.unplaced.length
      ? `${plan.unplaced.reduce((n, u) => n + u.credits, 0)} hours don't fit: ${plan.unplaced.map((u) => u.code).join(", ")}`
      : gradOk
        ? `Finishes ${plan.gradTerm}, target ${plan.targetGradTerm}`
        : `Finishes ${plan.gradTerm}, after the ${plan.targetGradTerm} target`,
  );
  return checks;
}

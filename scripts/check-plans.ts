// Independent re-check of saved plans against the RAW data files.
// It deliberately does not import the planning engine: it re-reads courses.json, prereq_overrides.json,
// sections.json and programs.json itself, so a planner bug can't hide behind shared code.
//
// Usage: npm run check            (plans the demo students with the engine, saves them, then re-checks)
//        npm run check -- file.json  (re-check a plan exported from the app)

import fs from "node:fs";
import path from "node:path";

type Ref = { code: string; minGrade?: string; concurrentOk?: boolean };
const raw = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join("data", f), "utf8"));

const courses = new Map<string, { credits: number | null; level: number; prereqs: Ref[][]; coreqs: string[] }>();
for (const c of raw<{ courses: { code: string; credits: number | null; level: number; prereqs: Ref[][]; coreqs: string[] }[] }>("courses.json").courses) courses.set(c.code, c);
const overrides = raw<{ overrides: Record<string, { prereqs?: Ref[][]; coreqs?: string[]; credits?: number | null }> }>("prereq_overrides.json").overrides;
for (const [code, o] of Object.entries(overrides)) {
  const c = courses.get(code);
  if (!c) continue;
  if (o.prereqs) c.prereqs = o.prereqs;
  if (o.coreqs) c.coreqs = o.coreqs;
  if (o.credits !== undefined) c.credits = o.credits;
}
const sections = raw<{ meta: { terms: { term: string; coverage: string; subjects?: string[] }[] }; sections: { code: string; term: string }[] }>("sections.json");
const programs = raw<{
  load: { max: number };
  requirements: Record<string, { type: string; courses?: string[]; count?: number; hours?: number }>;
  programs: Record<string, { requirements: string[] }>;
  cohorts: { id: string; label: string; totalHours: number; upperDivHours: number; requirements: string[] }[];
}>("programs.json");

const seasonIdx = (t: string) => {
  const [s, y] = t.split(" ");
  return Number(y) * 3 + ({ Spring: 0, Summer: 1, Fall: 2 } as Record<string, number>)[s];
};

interface SavedPlan {
  student: { id: string; completed: { code: string; term: string; grade?: string; credits?: number; countsToward?: string }[]; inProgress: { code: string; countsToward?: string; credits?: number }[]; otherHours?: { hours: number; upper?: number }; satisfiedSlots?: Record<string, number> };
  plan: { cohort: string; programs: string[]; gradTerm: string; targetGradTerm: string; terms: { term: string; status: string; hours: number; lines: { code: string; slot: boolean; credits: number; requirementId: string; upper?: boolean }[] }[] };
}

function check(saved: SavedPlan): string[] {
  const { student, plan } = saved;
  const errors: string[] = [];
  const at = new Map<string, string>();
  for (const c of student.completed) if (c.grade !== "F" && c.grade !== "W") at.set(c.code, c.term);
  for (const t of plan.terms) for (const l of t.lines) if (!l.slot) at.set(l.code, t.term);
  const credit = (code: string) => courses.get(code)?.credits ?? 3;

  // Requirements
  const cohort = programs.cohorts.find((c) => c.label === plan.cohort);
  if (!cohort) errors.push(`Unknown cohort ${plan.cohort}`);
  const reqs = [...(cohort?.requirements ?? []), ...plan.programs.flatMap((p) => programs.programs[p]?.requirements ?? [])];
  for (const id of new Set(reqs)) {
    const r = programs.requirements[id];
    if (r.type === "all") for (const c of r.courses ?? []) if (!at.has(c)) errors.push(`Requirement ${id}: ${c} not completed or planned`);
    if (r.type === "choose") {
      const have = (r.courses ?? []).filter((c) => at.has(c)).length;
      if (have < (r.count ?? 1)) errors.push(`Requirement ${id}: ${have}/${r.count} chosen`);
    }
    if (r.type === "slot") {
      const have =
        plan.terms.flatMap((t) => t.lines).filter((l) => l.slot && l.requirementId === id).reduce((n, l) => n + l.credits, 0) +
        (student.satisfiedSlots?.[id] ?? 0) +
        [...student.completed, ...student.inProgress].filter((c) => c.countsToward === id).reduce((n, c) => n + (c.credits ?? credit(c.code)), 0);
      if (have + 0.001 < (r.hours ?? 0)) errors.push(`Requirement ${id}: ${have}/${r.hours} hours`);
    }
  }
  // Hours
  const done = student.completed.reduce((n, c) => n + (c.credits ?? credit(c.code)), 0) + (student.otherHours?.hours ?? 0);
  const total = done + plan.terms.reduce((n, t) => n + t.lines.reduce((m, l) => m + l.credits, 0), 0);
  if (cohort && total < cohort.totalHours) errors.push(`Total hours ${total} < ${cohort.totalHours}`);
  const upper =
    student.completed.filter((c) => courses.get(c.code)?.level! >= 3).reduce((n, c) => n + credit(c.code), 0) +
    (student.otherHours?.upper ?? 0) +
    plan.terms.flatMap((t) => t.lines).reduce((n, l) => n + (l.slot ? (l.upper ? l.credits : 0) : (courses.get(l.code)?.level ?? 0) >= 3 ? l.credits : 0), 0);
  if (cohort && upper < cohort.upperDivHours) errors.push(`Upper-division hours ${upper} < ${cohort.upperDivHours}`);
  // Prereq order, load, availability
  const posted = sections.meta.terms;
  for (const t of plan.terms) {
    const sum = t.lines.reduce((n, l) => n + l.credits, 0);
    if (Math.abs(sum - t.hours) > 0.01) errors.push(`${t.term}: listed hours ${t.hours} != sum ${sum}`);
    if (sum > programs.load.max) errors.push(`${t.term}: ${sum} hours > ${programs.load.max}`);
    if (t.status === "in-progress") continue;
    for (const l of t.lines) {
      if (l.slot) continue;
      const c = courses.get(l.code);
      if (!c) {
        errors.push(`${l.code} is not in courses.json`);
        continue;
      }
      for (const g of c.prereqs) {
        const ok = g.some((r) => {
          const when = at.get(r.code);
          if (!when) return false;
          const d = seasonIdx(when) - seasonIdx(t.term);
          return d < 0 || (d === 0 && !!r.concurrentOk);
        });
        if (!ok) errors.push(`${l.code} (${t.term}) missing prerequisite ${g.map((r) => r.code).join("|")}`);
      }
      const p = posted.find((x) => x.term === t.term && (x.coverage === "complete" || (x.subjects ?? []).includes(l.code.split(" ")[0])));
      if (p && !sections.sections.some((s) => s.code === l.code && s.term === t.term)) errors.push(`${l.code} placed in ${t.term} but has no section there`);
    }
  }
  if (plan.gradTerm !== "Not yet determined" && seasonIdx(plan.gradTerm) > seasonIdx(plan.targetGradTerm)) {
    errors.push(`Graduates ${plan.gradTerm}, after target ${plan.targetGradTerm} (reported, not hidden)`);
  }
  return errors;
}

async function main() {
  let files = process.argv.slice(2);
  if (files.length === 0) {
    // Produce the demo plans with the engine, then check them from raw data
    const { loadData, loadStudent } = await import("../src/lib/engine/load");
    const { buildPlan } = await import("../src/lib/engine/planner");
    const ds = loadData();
    fs.mkdirSync("data/runtime/plans", { recursive: true });
    const cases: [string, string[] | undefined, string][] = [
      ["jordan", undefined, "jordan-base"],
      ["jordan", ["BBA-FINA", "BBA-BIS", "CERT-FINTECH"], "jordan-fintech"],
      ["maya", undefined, "maya-base"],
      ["maya", ["BBA-FINA"], "maya-finance"],
    ];
    files = cases.map(([id, progs, name]) => {
      const student = loadStudent(id);
      const plan = buildPlan(ds, student, { programs: progs });
      const f = `data/runtime/plans/${name}.json`;
      fs.writeFileSync(f, JSON.stringify({ student, plan }, null, 1));
      return f;
    });
  }
  let bad = 0;
  for (const f of files) {
    const errs = check(JSON.parse(fs.readFileSync(f, "utf8")));
    console.log(`${errs.length ? "FAIL" : "PASS"}  ${f}${errs.length ? "\n  - " + errs.join("\n  - ") : ""}`);
    if (errs.length) bad++;
  }
  console.log(`\n${files.length - bad}/${files.length} plans pass the independent check`);
  process.exitCode = bad ? 1 : 0;
}
main();

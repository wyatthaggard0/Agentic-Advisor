// Next-semester schedule builder: picks real sections for the planned courses of one term.
// Hard rules: one section per course (+ its lab), no time overlaps (8-week halves can share a slot),
// skip restricted sections the student doesn't qualify for, label closed / permission sections.
// Soft preferences come from the survey and are scored; search is a capped backtracking search.

import type { Dataset } from "./load";
import { courseTitle } from "./load";
import type { Plan, SchedulePrefs, Section, Student } from "./types";

export interface ChosenSection {
  code: string;
  title: string;
  section: Section;
  lab?: Section;
  labels: string[];
}

export interface ScheduleResult {
  term: string;
  approved: boolean;
  chosen: ChosenSection[];
  untimed: ChosenSection[];
  backups: Record<string, Section[]>;
  unscheduled: { code: string; reason: string; swapOptions: string[] }[];
  warnings: string[];
  score: number;
  tried: number;
  sample: boolean;
}

const MAX_TRIES = 20000;
const TOP_PER_COURSE = 12;

const toMin = (t?: string) => {
  if (!t) return -1;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const dayList = (d: string) => (d.match(/M|Tu|T|W|Th|R|F|Sa|S/g) ?? []).map((x) => (x === "Th" ? "R" : x === "Tu" ? "T" : x));

function sessionsOverlap(a?: string, b?: string) {
  const A = a ?? "1";
  const B = b ?? "1";
  if (A === "1" || B === "1") return true; // a full-term class conflicts with both halves
  return A === B;
}

export function sectionsConflict(a: Section, b: Section): boolean {
  if (!a.days || !b.days || !a.start || !b.start) return false;
  if (!sessionsOverlap(a.session, b.session)) return false;
  const da = dayList(a.days);
  if (!dayList(b.days).some((d) => da.includes(d))) return false;
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

function qualifies(student: Student, s: Section): boolean {
  const attrs = (s.attributes ?? []).map((a) => a.toLowerCase());
  if (attrs.includes("honors") && !student.programs.includes("honors")) return false;
  if (attrs.some((a) => a.includes("fellows")) && !student.programs.includes("neeley-fellows")) return false;
  if (attrs.some((a) => a.includes("study abroad"))) return false;
  return true;
}

function labelsFor(s: Section): string[] {
  const out: string[] = [];
  if (s.status === "Closed" || s.status === "Waitlist") out.push("Closed: waitlist only");
  if (s.consent === "Dept") out.push("Needs department permission: ask the department office");
  if (s.consent === "Instr") out.push("Needs instructor permission: email the instructor");
  if (s.session && s.session !== "1") out.push(s.session === "8W1" ? "First 8 weeks" : "Second 8 weeks");
  if (s.mode && s.mode !== "In Person") out.push(s.mode);
  return out;
}

/** Penalty for one section on its own (lower is better). */
function sectionPenalty(s: Section, p: SchedulePrefs): number {
  let pen = 0;
  if (s.status !== "Open") pen += 40;
  if (s.consent) pen += 15;
  if (!s.days) return pen + (p.mode === "In Person" ? 6 : 0);
  const start = toMin(s.start);
  const end = toMin(s.end);
  if (p.earliestStart && start < toMin(p.earliestStart)) pen += 10;
  if (p.noEvening && end > toMin("17:30")) pen += 12;
  if (p.fridaysFree && dayList(s.days).includes("F")) pen += 10;
  if (p.pattern === "MWF" && !/MWF|MW/.test(s.days)) pen += 4;
  if (p.pattern === "TR" && !/TR|TTh/.test(s.days)) pen += 4;
  if (p.mode && p.mode !== "any" && s.mode && s.mode !== p.mode) pen += 6;
  if (p.lunchGap && start < toMin("13:00") && end > toMin("12:00")) pen += 3;
  return pen;
}

/** Penalty for the whole week: days on campus and long gaps. */
function weekPenalty(secs: Section[], p: SchedulePrefs): number {
  const byDay = new Map<string, [number, number][]>();
  for (const s of secs) {
    if (!s.days || !s.start) continue;
    for (const d of dayList(s.days)) {
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push([toMin(s.start), toMin(s.end)]);
    }
  }
  let pen = p.fewerDays ? byDay.size * 4 : 0;
  for (const slots of byDay.values()) {
    slots.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < slots.length; i++) if (slots[i][0] - slots[i - 1][1] > 120) pen += 3;
  }
  return pen;
}

interface Option {
  code: string;
  lec: Section;
  lab?: Section;
  pen: number;
}

export function buildSchedule(ds: Dataset, student: Student, plan: Plan, approved: boolean, prefsOverride?: SchedulePrefs): ScheduleResult {
  const prefs: SchedulePrefs = { ...(student.preferences ?? {}), ...(prefsOverride ?? {}) };
  const termPlan = plan.terms.find((t) => t.status === "planned");
  const warnings: string[] = [
    "Seat counts change constantly; check Class Search before registering.",
    "This app does not register you. Use the class numbers on my.tcu.edu.",
  ];
  if (ds.sectionsMeta.sample) warnings.unshift("SAMPLE section data: these sections are invented until the TCU Class Search pull is loaded.");
  if (!approved) warnings.unshift("Not approved yet: this is a preview. Your advisor hasn't signed off on the plan.");
  const empty: ScheduleResult = { term: termPlan?.term ?? "", approved, chosen: [], untimed: [], backups: {}, unscheduled: [], warnings, score: 0, tried: 0, sample: !!ds.sectionsMeta.sample };
  if (!termPlan) return empty;

  const courses = termPlan.lines.filter((l) => !l.slot).map((l) => l.code);
  const unscheduled: ScheduleResult["unscheduled"] = [];
  const optionsByCourse = new Map<string, Option[]>();

  for (const code of courses) {
    const secs = ds.sections.filter((s) => s.code === code && s.term === termPlan.term && qualifies(student, s));
    if (secs.length === 0) {
      unscheduled.push({ code, reason: `No section open to you on the ${termPlan.term} schedule`, swapOptions: swapOptions(ds, plan, code, termPlan.term) });
      continue;
    }
    const lecs = secs.filter((s) => (s.component ?? "LEC") !== "LAB");
    const labs = secs.filter((s) => s.component === "LAB");
    const opts: Option[] = [];
    for (const lec of lecs) {
      if (labs.length) {
        const matching = labs.filter((l) => !lec.linkGroup || l.linkGroup === lec.linkGroup);
        for (const lab of matching) {
          if (sectionsConflict(lec, lab)) continue;
          opts.push({ code, lec, lab, pen: sectionPenalty(lec, prefs) + sectionPenalty(lab, prefs) });
        }
      } else {
        opts.push({ code, lec, pen: sectionPenalty(lec, prefs) });
      }
    }
    opts.sort((a, b) => a.pen - b.pen);
    optionsByCourse.set(code, opts.slice(0, TOP_PER_COURSE));
  }

  // Fewest options first
  const order = [...optionsByCourse.keys()].sort((a, b) => optionsByCourse.get(a)!.length - optionsByCourse.get(b)!.length);
  let tried = 0;
  let best: { picks: Option[]; score: number } = { picks: [], score: Infinity };
  const current: Option[] = [];
  const secsOf = (o: Option) => (o.lab ? [o.lec, o.lab] : [o.lec]);
  const fits = (o: Option) => current.every((c) => secsOf(c).every((x) => secsOf(o).every((y) => !sectionsConflict(x, y))));

  const better = (picks: Option[], score: number) =>
    picks.length > best.picks.length || (picks.length === best.picks.length && score < best.score);

  function search(i: number, pen: number) {
    if (tried++ > MAX_TRIES) return;
    if (i === order.length) {
      const score = pen + weekPenalty(current.flatMap(secsOf), prefs);
      if (better(current, score)) best = { picks: [...current], score };
      return;
    }
    // prune: can't beat the best full schedule
    if (best.picks.length === order.length && pen >= best.score) return;
    let placedAny = false;
    for (const o of optionsByCourse.get(order[i])!) {
      if (!fits(o)) continue;
      placedAny = true;
      current.push(o);
      search(i + 1, pen + o.pen);
      current.pop();
    }
    // keep the best partial schedule: try skipping this course
    if (!placedAny || best.picks.length < order.length) {
      const score = pen + 1000;
      if (better(current, score)) best = { picks: [...current], score };
      search(i + 1, pen + 1000);
    }
  }
  search(0, 0);

  const pickCodes = new Set(best.picks.map((p) => p.code));
  for (const code of order) {
    if (pickCodes.has(code)) continue;
    const blockers = new Set<string>();
    for (const o of optionsByCourse.get(code)!) {
      for (const p of best.picks) if (secsOf(p).some((x) => secsOf(o).some((y) => sectionsConflict(x, y)))) blockers.add(p.code);
    }
    unscheduled.push({
      code,
      reason: blockers.size
        ? `Every section of ${code} overlaps ${[...blockers].join(" or ")}`
        : `No usable section of ${code}`,
      swapOptions: swapOptions(ds, plan, code, termPlan.term),
    });
  }

  const toChosen = (o: Option): ChosenSection => ({
    code: o.code,
    title: courseTitle(ds.courses.get(o.code), o.code),
    section: o.lec,
    ...(o.lab ? { lab: o.lab } : {}),
    labels: [...labelsFor(o.lec), ...(o.lab ? labelsFor(o.lab).map((l) => `Lab: ${l}`) : [])],
  });
  const chosen = best.picks.filter((p) => p.lec.days).map(toChosen);
  const untimed = best.picks.filter((p) => !p.lec.days).map(toChosen);

  // One or two backup sections per course that still fit with everything else
  const backups: Record<string, Section[]> = {};
  for (const p of best.picks) {
    const others = best.picks.filter((q) => q !== p).flatMap(secsOf);
    backups[p.code] = (optionsByCourse.get(p.code) ?? [])
      .filter((o) => o.lec.classNumber !== p.lec.classNumber && secsOf(o).every((x) => others.every((y) => !sectionsConflict(x, y))))
      .slice(0, 2)
      .map((o) => o.lec);
  }

  return {
    term: termPlan.term,
    approved,
    chosen,
    untimed,
    backups,
    unscheduled,
    warnings,
    score: best.score === Infinity ? 0 : best.score,
    tried,
    sample: !!ds.sectionsMeta.sample,
  };
}

function swapOptions(ds: Dataset, plan: Plan, code: string, term: string): string[] {
  const line = plan.terms.flatMap((t) => t.lines).find((l) => l.code === code);
  const req = line ? ds.programs.requirements[line.requirementId] : undefined;
  if (!req || req.type !== "choose") return [];
  const planned = new Set(plan.terms.flatMap((t) => t.lines.map((l) => l.code)));
  return (req.courses ?? []).filter((c) => c !== code && !planned.has(c) && ds.sections.some((s) => s.code === c && s.term === term));
}

// Builds a semester-by-semester plan from verified data. No LLM involved: Claude only explains the result.

import type { Dataset } from "./load";
import { courseTitle } from "./load";
import { checkEligibility, offering, semesterIndex, type Offer, type PlanState } from "./eligibility";
import { assignCore, CORE_NAMES } from "./core";
import { compareTerms, nextRegularTerm, regularTermsBetween } from "./terms";
import type {
  AdvisorItem,
  Cohort,
  Confidence,
  Contradiction,
  CoreAssignment,
  Course,
  Plan,
  PlanLine,
  PlanTerm,
  Requirement,
  Student,
} from "./types";
import { validatePlan } from "./validate";

interface Need {
  code: string;
  credits: number;
  reqIds: string[];
  reqNames: string[];
  programs: string[];
  added: "requirement" | "prereq" | "coreq" | "swap";
  why: string;
  source: string;
  choiceReq?: string;
  core?: PlanLine["core"];
}

interface SlotNeed {
  id: string;
  name: string;
  credits: number;
  reqId: string;
  source: string;
  programs: string[];
  upper: boolean;
  kind: "core" | "elective" | "requirement";
}

export interface PlanOptions {
  programs?: string[];
  label?: string;
}

const MAX_EXTRA_TERMS = 4;

export function pickCohort(ds: Dataset, student: Student): Cohort {
  const sorted = [...ds.programs.cohorts].sort((a, b) => compareTerms(a.startsFrom, b.startsFrom));
  let pick = sorted[0];
  for (const c of sorted) if (compareTerms(c.startsFrom, student.startTerm) <= 0) pick = c;
  return pick;
}

/** Illegal combinations are blocked before any planning, each with its source. */
export function checkCombination(ds: Dataset, programIds: string[]): { reason: string; source: string }[] {
  const out: { reason: string; source: string }[] = [];
  const progs = programIds.map((id) => ds.programs.programs[id]).filter(Boolean);
  const unknown = programIds.filter((id) => !ds.programs.programs[id]);
  for (const u of unknown) out.push({ reason: `Unknown program "${u}"`, source: "programs.json" });
  const majors = progs.filter((p) => p.kind === "major");
  if (majors.length > ds.programs.rules.maxMajors) {
    out.push({ reason: `More than ${ds.programs.rules.maxMajors} majors is not allowed`, source: ds.programs.rules.source });
  }
  if (ds.programs.rules.sameFieldMinorBlocked) {
    for (const m of progs.filter((p) => p.kind === "minor")) {
      if (majors.some((mj) => mj.field && mj.field === m.field)) {
        out.push({ reason: `A ${m.name} can't be combined with a major in the same field`, source: ds.programs.rules.source });
      }
    }
  }
  // Program-specific blocks from the planning pack (e.g. Finance minor + Finance major, General Business minor + any BBA)
  for (const p of progs) {
    for (const other of p.blockedWith ?? []) {
      if (programIds.includes(other)) {
        out.push({ reason: `${p.name} can't be combined with ${ds.programs.programs[other]?.name ?? other}`, source: p.source });
      }
    }
    if (p.blockedForBusiness && progs.some((q) => q !== p && q.id.startsWith("BBA-"))) {
      out.push({ reason: `${p.name}: ${p.blockedForBusiness}`, source: p.source });
    }
  }
  return out;
}

function interestScore(c: Course, title: string, interests: string[]): number {
  const text = `${title} ${c.description}`.toLowerCase();
  return interests.reduce((n, k) => n + (text.includes(k.toLowerCase()) ? 1 : 0), 0);
}

export function buildPlan(ds: Dataset, student: Student, opts: PlanOptions = {}): Plan {
  const programIds = opts.programs ?? student.programs;
  const blocked = checkCombination(ds, programIds);
  const cohort = pickCohort(ds, student);
  const P = ds.programs;
  const advisor: AdvisorItem[] = [];
  const dataNotes = [...ds.dataNotes];
  const addAdvisor = (item: AdvisorItem) => {
    if (!advisor.some((a) => a.id === item.id)) advisor.push(item);
  };

  const emptyPlan = (): Plan => ({
    studentId: student.id,
    cohort: cohort.label,
    programs: programIds,
    terms: [],
    gradTerm: student.targetGradTerm,
    targetGradTerm: student.targetGradTerm,
    onTime: false,
    totals: { hours: 0, required: cohort.totalHours, upper: 0, upperRequired: cohort.upperDivHours, maxLoad: 0 },
    unplaced: [],
    swaps: [],
    blocked,
    checks: [],
    advisorItems: [],
    contradictions: [],
    dataNotes,
  });
  if (blocked.length) return emptyPlan();

  // ---------- Student history ----------
  const credit = (code: string, fallback?: number) => ds.courses.get(code)?.credits ?? fallback ?? 3;
  const placedTerm = new Map<string, string>();
  const grades = new Map<string, string>();
  const completedCodes = new Set<string>();
  for (const c of student.completed) {
    placedTerm.set(c.code, c.term);
    if (c.grade) grades.set(c.code, c.grade);
    completedCodes.add(c.code);
    if (c.transfer && !c.transfer.verified) {
      addAdvisor({
        id: `transfer-${c.code}`,
        kind: "transfer",
        title: `Transfer credit for ${c.code} isn't verified`,
        detail: `${c.code} from ${c.transfer.from} isn't confirmed by the registrar. The plan uses it, so any course that depends on it is provisional.`,
        source: "Student transcript",
      });
    }
  }
  for (const c of student.inProgress) {
    placedTerm.set(c.code, student.currentTerm);
    grades.set(c.code, "IP");
    completedCodes.add(c.code);
  }
  const failed = new Set(student.completed.filter((c) => c.grade === "F" || c.grade === "W").map((c) => c.code));
  for (const f of failed) {
    placedTerm.delete(f);
    completedCodes.delete(f);
  }

  // ---------- Requirements ----------
  const reqOrder: { req: Requirement; owner: string }[] = [];
  const seenReq = new Set<string>();
  const pushReq = (id: string, owner: string) => {
    const req = P.requirements[id];
    if (!req) {
      dataNotes.push(`Requirement "${id}" is referenced but not defined in programs.json`);
      return;
    }
    if (seenReq.has(id)) return;
    seenReq.add(id);
    reqOrder.push({ req, owner });
  };
  for (const id of cohort.requirements) pushReq(id, "degree");
  for (const pid of programIds) for (const id of P.programs[pid].requirements) pushReq(id, pid);
  reqOrder.sort((a, b) => ["all", "choose", "slot", "core"].indexOf(a.req.type) - ["all", "choose", "slot", "core"].indexOf(b.req.type));
  // The TCU Core is filled after the business and program courses are known, so they get credit for their Core tags
  const coreReq = reqOrder.find((r) => r.req.type === "core")?.req;

  const needs = new Map<string, Need>();
  const slots: SlotNeed[] = [];
  const usedBy = new Map<string, Set<string>>(); // course -> programs it counts toward
  const appliedCompleted = new Map<string, string[]>(); // completed course -> requirement names
  const missingData: string[] = [];
  const interests = student.survey?.interests ?? [];

  const markUse = (code: string, owner: string) => {
    if (!usedBy.has(code)) usedBy.set(code, new Set());
    usedBy.get(code)!.add(owner);
  };
  const addNeed = (code: string, n: Omit<Need, "code" | "credits">) => {
    const existing = needs.get(code);
    if (existing) {
      for (const r of n.reqIds) if (!existing.reqIds.includes(r)) existing.reqIds.push(r);
      for (const r of n.reqNames) if (!existing.reqNames.includes(r)) existing.reqNames.push(r);
      for (const p of n.programs) if (!existing.programs.includes(p)) existing.programs.push(p);
      return;
    }
    if (!ds.courses.has(code)) {
      missingData.push(code);
      return;
    }
    needs.set(code, { code, credits: credit(code), ...n });
  };

  // Pair rule (e.g. two majors) or a program's own cap (e.g. Leadership minor: 6 hours with anything)
  const sharedLimit = (a: string, b: string): { maxShared: number; source: string } | undefined => {
    const pair = P.rules.sharedHours?.find((r) => r.between.includes(a) && r.between.includes(b));
    const caps = [P.programs[a], P.programs[b]].filter((p) => p?.maxShared).map((p) => ({ maxShared: p!.maxShared!, source: `${p!.name}: at most ${p!.maxShared} shared hours` }));
    return [...(pair ? [pair] : []), ...caps].sort((x, y) => x.maxShared - y.maxShared)[0];
  };
  const sharedHours = (a: string, b: string) => {
    let h = 0;
    for (const [code, set] of usedBy) if (set.has(a) && set.has(b)) h += credit(code);
    return h;
  };
  const canShare = (code: string, owner: string) => {
    for (const other of usedBy.get(code) ?? []) {
      if (other === owner || other === "degree") continue;
      const lim = sharedLimit(owner, other);
      if (lim && sharedHours(owner, other) + credit(code) > lim.maxShared) return false;
    }
    return true;
  };
  const unmetPrereqCount = (code: string, depth = 0): number => {
    const c = ds.courses.get(code);
    if (!c || depth > 3) return 0;
    let n = 0;
    for (const g of c.prereqs) {
      if (g.some((r) => completedCodes.has(r.code) || needs.has(r.code))) continue;
      n += 1 + unmetPrereqCount(g[0].code, depth + 1);
    }
    return n;
  };
  const programGated = (c: Course) =>
    c.conditions.some(
      (k) => k.kind === "program" && !(k.value === "certificate" && programIds.some((p) => p.startsWith("CERT-"))) && !programIds.includes(k.value ?? ""),
    );

  for (const { req, owner } of reqOrder) {
    const ownerName = owner === "degree" ? cohort.label : P.programs[owner]?.name ?? owner;
    if (req.type === "core") continue; // handled after prerequisites, below
    if (req.type === "all") {
      for (const code of req.courses ?? []) {
        markUse(code, owner);
        if (completedCodes.has(code)) {
          appliedCompleted.set(code, [...(appliedCompleted.get(code) ?? []), req.name]);
          continue;
        }
        addNeed(code, {
          reqIds: [req.id],
          reqNames: [req.name],
          programs: [owner],
          added: "requirement",
          why: `Required for ${req.name} (${ownerName}).`,
          source: req.source,
        });
      }
    } else if (req.type === "choose") {
      const target = req.count ?? Math.ceil((req.hours ?? 3) / 3);
      const pool = (req.courses ?? []).filter((code) => {
        if (!ds.courses.has(code)) {
          if (!missingData.includes(code)) missingData.push(code);
          return false;
        }
        return !(req.minLevel && ds.courses.get(code)!.level < req.minLevel);
      });
      const chosen: string[] = [];
      // 1. already completed
      for (const code of pool) if (chosen.length < target && completedCodes.has(code) && canShare(code, owner)) chosen.push(code);
      // 2. already in the plan for another program
      for (const code of pool)
        if (chosen.length < target && !chosen.includes(code) && needs.has(code) && canShare(code, owner)) chosen.push(code);
      // 3. survey match, then 4. fewest new prerequisites
      const rest = pool
        .filter((code) => !chosen.includes(code) && !programGated(ds.courses.get(code)!))
        .map((code) => {
          const c = ds.courses.get(code)!;
          return {
            code,
            score: interestScore(c, courseTitle(c, code), interests),
            prereqs: unmetPrereqCount(code),
            permission: c.conditions.some((k) => k.kind === "permission") ? 1 : 0,
            // prefer courses with schedule evidence over ones never seen on a posted schedule
            evidence: ds.sections.some((s) => s.code === code) ? 0 : 1,
            level: c.level,
          };
        })
        .sort((a, b) => b.score - a.score || a.permission - b.permission || a.evidence - b.evidence || a.prereqs - b.prereqs || a.level - b.level);
      for (const r of rest) {
        if (chosen.length >= target) break;
        if (!canShare(r.code, owner)) continue;
        chosen.push(r.code);
      }
      for (const code of chosen) {
        markUse(code, owner);
        if (completedCodes.has(code)) {
          appliedCompleted.set(code, [...(appliedCompleted.get(code) ?? []), req.name]);
          continue;
        }
        const c = ds.courses.get(code)!;
        const match = interests.filter((k) => `${courseTitle(c, code)} ${c.description}`.toLowerCase().includes(k.toLowerCase()));
        const shared = [...(usedBy.get(code) ?? [])].filter((p) => p !== owner && p !== "degree");
        addNeed(code, {
          reqIds: [req.id],
          reqNames: [req.name],
          programs: [owner],
          added: "requirement",
          why:
            `Fills ${req.name} (${ownerName}).` +
            (shared.length ? ` Also counts toward ${shared.map((s) => P.programs[s]?.name ?? s).join(", ")}.` : "") +
            (match.length ? ` Matches your interest in ${match.join(", ")}.` : ""),
          source: req.source,
          choiceReq: req.id,
        });
      }
      if (chosen.length < target) {
        addAdvisor({
          id: `short-${req.id}`,
          kind: "other",
          title: `Not enough eligible courses for ${req.name}`,
          detail: `Found ${chosen.length} of ${target} courses the student can take from the listed options.`,
          source: req.source,
        });
      }
    } else {
      const done =
        (student.satisfiedSlots?.[req.id] ?? 0) +
        [...student.completed, ...student.inProgress]
          .filter((c) => c.countsToward === req.id && c.grade !== "F" && c.grade !== "W")
          .reduce((n, c) => n + (c.credits ?? credit(c.code)), 0);
      if (done > 0) {
        for (const c of [...student.completed, ...student.inProgress].filter((x) => x.countsToward === req.id)) {
          appliedCompleted.set(c.code, [...(appliedCompleted.get(c.code) ?? []), req.name]);
        }
      }
      let remaining = Math.max(0, (req.hours ?? 0) - done);
      let k = 0;
      while (remaining > 0) {
        const h = Math.min(3, remaining);
        slots.push({
          id: `${req.id}#${k++}`,
          name: req.name,
          credits: h,
          reqId: req.id,
          source: req.source,
          programs: [owner],
          upper: (req.minLevel ?? 0) >= 3,
          kind: req.tags?.includes("core") ? "core" : req.tags?.includes("elective") ? "elective" : "requirement",
        });
        remaining -= h;
      }
    }
  }

  // ---------- Close the prerequisite chain and add corequisites ----------
  let changed = true;
  while (changed) {
    changed = false;
    for (const need of [...needs.values()]) {
      const c = ds.courses.get(need.code)!;
      for (const group of c.prereqs) {
        if (group.some((r) => completedCodes.has(r.code) || needs.has(r.code))) continue;
        const options = group
          .filter((r) => ds.courses.has(r.code) && !programGated(ds.courses.get(r.code)!))
          .sort((a, b) => unmetPrereqCount(a.code) - unmetPrereqCount(b.code) || ds.courses.get(a.code)!.level - ds.courses.get(b.code)!.level);
        const pick = options[0];
        if (!pick) {
          addAdvisor({
            id: `prereq-gap-${need.code}`,
            kind: "permission",
            title: `${need.code} has a prerequisite the plan can't schedule`,
            detail: `Needs ${group.map((r) => r.code).join(" or ")}${c.permissionAlt ? "; the catalog allows instructor or department permission instead" : ""}.`,
            source: c.source,
          });
          continue;
        }
        addNeed(pick.code, {
          reqIds: [`prereq:${need.code}`],
          reqNames: [`Prerequisite for ${need.code}`],
          programs: need.programs,
          added: "prereq",
          why: `Prerequisite for ${need.code}${pick.minGrade ? ` (earn ${pick.minGrade} or better)` : ""}, which you need for ${need.reqNames[0]}.`,
          source: c.source,
        });
        changed = true;
      }
      for (const co of c.coreqs) {
        if (!ds.courses.has(co)) {
          addAdvisor({
            id: `missing-coreq-${need.code}-${co}`,
            kind: "contradiction",
            title: `${need.code} requires ${co}, which isn't in the course data`,
            detail: `The catalog says ${need.code} must be taken with ${co}, but ${co} isn't in the registrar course export. Ask your advisor how to register.`,
            source: c.source,
          });
          continue;
        }
        if (completedCodes.has(co) || needs.has(co)) continue;
        addNeed(co, {
          reqIds: [`coreq:${need.code}`],
          reqNames: [`Corequisite of ${need.code}`],
          programs: need.programs,
          added: "coreq",
          why: `Must be taken in the same term as ${need.code}.`,
          source: c.source,
        });
        changed = true;
      }
    }
  }
  for (const code of missingData) {
    addAdvisor({
      id: `missing-${code}`,
      kind: "contradiction",
      title: `${code} is required but missing from the course data`,
      detail: `The requirement lists ${code}, but it isn't in the registrar course export. The plan can't schedule it until the data is corrected.`,
      source: "courses.json vs programs.json",
    });
  }

  // ---------- Reuse a prerequisite the plan already needs to fill a choice (e.g. INSC 30833 for BIS, since the capstone needs it anyway) ----------
  for (const n of [...needs.values()]) {
    if (!n.choiceReq || n.added !== "requirement" || n.reqIds.length !== 1) continue;
    const req = P.requirements[n.choiceReq];
    const alt = (req.courses ?? []).find((o) => o !== n.code && needs.get(o)?.added === "prereq");
    if (!alt) continue;
    const dependsOnN = [...needs.values()].some((m) => m.code !== n.code && ds.courses.get(m.code)?.prereqs.some((g) => g.every((r) => r.code === n.code)));
    if (dependsOnN) continue;
    const a = needs.get(alt)!;
    a.reqIds.unshift(n.choiceReq);
    a.reqNames.unshift(n.reqNames[0]);
    a.choiceReq = n.choiceReq;
    a.added = "requirement";
    a.why = `Fills ${req.name}, and it's already needed as a ${a.why.charAt(0).toLowerCase()}${a.why.slice(1)}`;
    needs.delete(n.code);
    for (const p of n.programs) markUse(alt, p);
    usedBy.get(n.code)?.clear();
  }

  // ---------- TCU Core: credit Core tags, then pick real courses for the open categories ----------
  let coreAssignments: CoreAssignment[] = [];
  if (coreReq) {
    const reachable = new Set([...completedCodes, ...needs.keys()]);
    const core = assignCore(ds, coreReq, {
      completed: student.completed.filter((c) => !failed.has(c.code)).map((c) => c.code),
      inProgress: student.inProgress.map((c) => c.code),
      planned: [...needs.keys()],
      // degree-audit counts keyed by Core category code (HUM, NSC, ...)
      satisfied: Object.fromEntries(Object.entries(student.satisfiedSlots ?? {}).filter(([k]) => /^[A-Z]{2,3}$/.test(k))),
      interests,
      available: (c) => c.prereqs.every((g) => g.some((r) => reachable.has(r.code))),
      wemFromMajor: programIds.includes("BBA-UNDECIDED"),
      prefer: student.coreChoices?.prefer,
      avoid: student.coreChoices?.avoid,
    });
    for (const p of core.picks) {
      const names = p.categories.map((k) => CORE_NAMES[k] ?? k);
      const two = p.categories.filter((k) => k !== "WEM").length > 1;
      addNeed(p.code, {
        reqIds: [coreReq.id],
        reqNames: [`TCU Core: ${names.join(" + ")}`],
        programs: ["degree"],
        added: "requirement",
        why: `Fills TCU Core ${names.join(" and ")}${two ? " with one course" : ""}.${student.coreChoices?.prefer.includes(p.code) ? " You chose this course." : p.interest.length ? ` Matches your interest in ${p.interest.join(", ")}.` : ""} A suggestion: any approved course in ${p.categories.length > 1 ? "these categories" : "this category"} works.`,
        source: coreReq.source,
        core: { categories: p.categories, alternatives: p.alternatives },
      });
      markUse(p.code, "degree");
    }
    for (const o of core.open) {
      for (let i = 0; i < o.count; i++) {
        slots.push({ id: `core-${o.slot}#${i}`, name: `TCU Core: ${CORE_NAMES[o.slot] ?? o.slot}`, credits: 3, reqId: coreReq.id, source: coreReq.source, programs: ["degree"], upper: o.slot === "WEM", kind: "core" });
      }
    }
    for (const n of core.notes) dataNotes.push(n);
    coreAssignments = core.assignments;
  }

  // ---------- Hour totals: free electives and upper-division hours ----------
  const completedHours =
    student.completed.filter((c) => !failed.has(c.code)).reduce((n, c) => n + (c.credits ?? credit(c.code)), 0) +
    (student.otherHours?.hours ?? 0);
  const ipHours = student.inProgress.reduce((n, c) => n + (c.credits ?? credit(c.code)), 0);
  const levelOf = (code: string) => ds.courses.get(code)?.level ?? 0;
  const upperDone =
    student.completed.filter((c) => levelOf(c.code) >= 3 && !failed.has(c.code)).reduce((n, c) => n + (c.credits ?? credit(c.code)), 0) +
    student.inProgress.filter((c) => levelOf(c.code) >= 3).reduce((n, c) => n + (c.credits ?? credit(c.code)), 0) +
    (student.otherHours?.upper ?? 0);
  const needHours = [...needs.values()].reduce((n, x) => n + x.credits, 0);
  const slotHours = () => slots.reduce((n, s) => n + s.credits, 0);
  let k = 0;
  while (completedHours + ipHours + needHours + slotHours() < cohort.totalHours) {
    const h = Math.min(3, cohort.totalHours - (completedHours + ipHours + needHours + slotHours()));
    slots.push({
      id: `elective#${k++}`,
      name: "Free elective",
      credits: h,
      reqId: "elective",
      source: cohort.source,
      programs: ["degree"],
      upper: false,
      kind: "elective",
    });
  }
  const upperPlanned = [...needs.values()].filter((n) => levelOf(n.code) >= 3).reduce((n, x) => n + x.credits, 0) +
    slots.filter((s) => s.upper).reduce((n, s) => n + s.credits, 0);
  let upperGap = cohort.upperDivHours - upperDone - upperPlanned;
  for (const s of slots) {
    if (upperGap <= 0) break;
    if (s.kind === "elective" && !s.upper) {
      s.upper = true;
      s.name = "Upper-division elective (30000+)";
      upperGap -= s.credits;
    }
  }
  while (upperGap > 0) {
    slots.push({
      id: `upper#${k++}`,
      name: "Upper-division elective (30000+)",
      credits: 3,
      reqId: "upper-division",
      source: cohort.source,
      programs: ["degree"],
      upper: true,
      kind: "elective",
    });
    upperGap -= 3;
  }

  // ---------- Schedule by semester ----------
  // A "light" semester preference from the survey caps planned terms at 15 hours; the hard limit stays the catalog max
  const hardMax = P.load.max;
  const maxLoad = student.survey?.workload === "light" ? Math.min(15, hardMax) : hardMax;
  const loadNote = maxLoad < hardMax ? `your ${maxLoad}-hour preference` : `the ${maxLoad}-hour limit`;
  const fullTime = P.load.fullTime;
  const termHours = new Map<string, number>();
  const plannedLines = new Map<string, PlanLine[]>();
  const holds = new Map((student.holds ?? []).map((h) => [h.term, h]));

  let declaredBy: string | undefined;
  const declareMin = programIds.map((p) => P.programs[p]?.declare?.minHours ?? 0).reduce((a, b) => Math.max(a, b), 0);
  // Declaring needs the six first-year courses finished in an earlier term (MATH 10524 counts for MATH 10283)
  const declareDone = (term: string) =>
    (P.rules.declareCourses ?? []).every((c) => {
      const at = placedTerm.get(c) ?? (c === "MATH 10283" ? placedTerm.get("MATH 10524") : undefined);
      return !!at && compareTerms(at, term) < 0;
    });

  const hoursBefore = (term: string) => {
    let h = completedHours;
    if (compareTerms(student.currentTerm, term) < 0) h += ipHours;
    for (const [t, hrs] of termHours) if (compareTerms(t, term) < 0) h += hrs;
    return h;
  };
  const state: PlanState = { placedTerm, grades, hoursBefore };

  const unplacedNeeds = new Set(needs.keys());
  const unplacedSlots = [...slots];
  const dependents = (code: string, seen = new Set<string>()): number => {
    let best = 0;
    for (const n of unplacedNeeds) {
      if (seen.has(n)) continue;
      const c = ds.courses.get(n)!;
      if (c.prereqs.some((g) => g.some((r) => r.code === code))) {
        seen.add(n);
        best = Math.max(best, 1 + dependents(n, seen));
      }
    }
    return best;
  };

  const offerCache = new Map<string, Offer>();
  const offerFor = (code: string, term: string) => {
    const key = `${code}@${term}`;
    if (!offerCache.has(key)) offerCache.set(key, offering(ds, code, term));
    return offerCache.get(key)!;
  };

  const confidenceOf = (offer: Offer): { conf: Confidence; note: string } => {
    if (offer.status === "confirmed") return { conf: "confirmed", note: offer.note };
    if (offer.status === "historical") return { conf: "historical", note: offer.note };
    if (offer.unverified) return { conf: "advisor", note: offer.note };
    return { conf: "assumed", note: offer.note };
  };

  const lineForNeed = (need: Need, term: string, eligNotes: string[], pending: string[]): PlanLine => {
    const c = ds.courses.get(need.code)!;
    const { conf, note } = confidenceOf(offerFor(need.code, term));
    return {
      code: need.code,
      title: courseTitle(c, need.code),
      credits: need.credits,
      slot: false,
      requirementId: need.reqIds[0],
      requirement: need.reqNames.join(" + "),
      programs: need.programs,
      source: need.source,
      confidence: conf,
      confidenceNote: note,
      why: need.why,
      prereqNote: [
        ...(pending.length ? [`Assumes you pass ${pending.join(", ")} (in progress) with the required grade`] : []),
        ...eligNotes,
      ].join(". ") || undefined,
      added: need.added === "coreq" ? "coreq" : need.added === "prereq" ? "prereq" : need.added === "swap" ? "swap" : "requirement",
      ...(need.core ? { core: need.core } : {}),
    };
  };
  const lineForSlot = (s: SlotNeed): PlanLine => ({
    code: s.id,
    title: s.name,
    credits: s.credits,
    slot: true,
    upper: s.upper,
    requirementId: s.reqId,
    requirement: s.name,
    programs: s.programs,
    source: s.source,
    confidence: "assumed",
    confidenceNote: "You choose the course; any approved course fills this requirement",
    why: s.kind === "core" ? `Any approved course in this TCU Core category fills it.` : s.upper ? "Counts toward the upper-division hour minimum and total hours." : "Counts toward the total hours needed to graduate.",
    added: "elective",
  });

  const planTerms = regularTermsBetween(student.currentTerm, student.targetGradTerm);
  if (planTerms.length === 0) planTerms.push(nextRegularTerm(student.currentTerm));
  const extraTerms: string[] = [];
  const allTerms = () => [...planTerms, ...extraTerms];

  const placeTerm = (term: string, termsLeft: number) => {
    const remainingTerms = [...planTerms, ...extraTerms].filter((t) => compareTerms(t, term) >= 0);
    const lines: PlanLine[] = [];
    let hours = 0;
    termHours.set(term, 0);
    const remaining = [...unplacedNeeds].reduce((n, c) => n + needs.get(c)!.credits, 0) + unplacedSlots.reduce((n, s) => n + s.credits, 0);
    const target = Math.min(maxLoad, Math.max(Math.min(fullTime, remaining), Math.ceil(remaining / Math.max(1, termsLeft))));
    if (!declaredBy && !student.declared && declareMin > 0 && hoursBefore(term) >= declareMin && declareDone(term)) declaredBy = term;
    const hold = holds.get(term);

    if (!hold) {
      let progress = true;
      while (progress) {
        progress = false;
        const cands = [...unplacedNeeds]
          .map((code) => {
            const need = needs.get(code)!;
            const c = ds.courses.get(code)!;
            const offer = offerFor(code, term);
            if (offer.status === "not-offered" || offer.status === "other-season") return null;
            if (c.preferredEarliest !== undefined && termsLeft > 1 && semesterIndex(student.startTerm, term) < c.preferredEarliest && dependents(code) === 0) return null;
            const elig = checkEligibility(ds, student, c, term, state, { declaredBy, programs: programIds });
            if (!elig.ok) return null;
            // Fewer remaining terms that offer it = place it first (e.g. a fall-only capstone); suggested Core picks yield
            const flex = remainingTerms.filter((t) => {
              const o = offerFor(code, t);
              return o.status !== "not-offered" && o.status !== "other-season";
            }).length;
            const prio = need.added === "prereq" ? 0 : need.reqIds[0] === coreReq?.id ? 3 : need.choiceReq ? 2 : 1;
            return { code, need, c, elig, depth: dependents(code), flex, prio };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => b.depth - a.depth || a.flex - b.flex || a.prio - b.prio || a.c.level - b.c.level || a.code.localeCompare(b.code));
        for (const cand of cands) {
          // Corequisites go in the same term, in both directions
          const coreqs = [
            ...cand.c.coreqs.filter((co) => unplacedNeeds.has(co)),
            ...[...unplacedNeeds].filter((o) => o !== cand.code && ds.courses.get(o)!.coreqs.includes(cand.code)),
          ].filter((v, i, a) => a.indexOf(v) === i);
          const add = cand.need.credits + coreqs.reduce((n, co) => n + needs.get(co)!.credits, 0);
          const limit = lines.length === 0 ? hardMax : target;
          if (hours + add > limit) continue;
          for (const code of [cand.code, ...coreqs]) {
            const need = needs.get(code)!;
            const elig = code === cand.code ? cand.elig : { notes: [], pendingGrade: [], advisor: [] as string[] };
            lines.push(lineForNeed(need, term, elig.notes, elig.pendingGrade));
            for (const a of elig.advisor) addAdvisor({ id: `perm-${code}`, kind: "permission", title: a, detail: `Ask the department for permission before registering for ${code} in ${term}.`, source: ds.courses.get(code)!.source });
            unplacedNeeds.delete(code);
            placedTerm.set(code, term);
            hours += need.credits;
            termHours.set(term, hours);
          }
          progress = true;
          break; // re-evaluate: a course placed this term may unlock a concurrent-ok course
        }
      }
    }
    // Fill remaining capacity with slots: Core first, upper-division electives once the student is a junior
    const junior = hoursBefore(term) >= P.standing.junior;
    const slotOrder = [...unplacedSlots].sort((a, b) => {
      const rank = (s: SlotNeed) => (s.kind === "core" ? 0 : s.kind === "requirement" ? 1 : s.upper ? (junior ? 2 : 4) : 3);
      return rank(a) - rank(b);
    });
    for (const s of slotOrder) {
      if (s.upper && !junior) continue;
      if (hours + s.credits > target) continue;
      lines.push(lineForSlot(s));
      unplacedSlots.splice(unplacedSlots.indexOf(s), 1);
      hours += s.credits;
      termHours.set(term, hours);
    }
    plannedLines.set(term, lines);
  };

  for (let i = 0; i < planTerms.length; i++) placeTerm(planTerms[i], planTerms.length - i);

  // ---------- One swap within the same requirement for anything that doesn't fit by the target ----------
  const swaps: Plan["swaps"] = [];
  // Alternatives with schedule evidence and no permission gate first
  const altOrder = (list: string[]) =>
    [...list].sort((a, b) => {
      const rank = (code: string) =>
        (ds.sections.some((s) => s.code === code) ? 0 : 2) + (ds.courses.get(code)?.conditions.some((k) => k.kind === "permission") ? 1 : 0);
      return rank(a) - rank(b);
    });
  const reasonFor = (code: string, term: string) => {
    const elig = checkEligibility(ds, student, ds.courses.get(code)!, term, state, { declaredBy, programs: programIds });
    return elig.missing.length ? `Needs ${elig.missing.join("; ")}` : offerFor(code, term).note;
  };
  for (const code of [...unplacedNeeds]) {
    const need = needs.get(code)!;
    if (!need.choiceReq) continue;
    const reason = reasonFor(code, planTerms[planTerms.length - 1]);
    const req = P.requirements[need.choiceReq];
    let swapped = false;
    const alts = altOrder(req.courses ?? []);
    for (const alt of alts) {
      if (alt === code || needs.has(alt) || completedCodes.has(alt) || !ds.courses.has(alt)) continue;
      const altC = ds.courses.get(alt)!;
      if (programGated(altC)) continue;
      for (const t of planTerms) {
        const o = offerFor(alt, t);
        if (o.status === "not-offered" || o.status === "other-season") continue;
        if ((termHours.get(t) ?? 0) + (altC.credits ?? 3) > maxLoad || holds.has(t)) continue;
        const e = checkEligibility(ds, student, altC, t, state, { declaredBy, programs: programIds });
        if (!e.ok) continue;
        const altNeed: Need = {
          ...need,
          code: alt,
          credits: altC.credits ?? 3,
          added: "swap",
          why: `Swapped in for ${code} (${reason.charAt(0).toLowerCase() + reason.slice(1)}). Fills the same requirement: ${need.reqNames[0]}.`,
        };
        needs.set(alt, altNeed);
        plannedLines.get(t)!.push(lineForNeed(altNeed, t, e.notes, e.pendingGrade));
        placedTerm.set(alt, t);
        termHours.set(t, (termHours.get(t) ?? 0) + altNeed.credits);
        swaps.push({ from: code, to: alt, reason: `${code}: ${reason}. ${alt} fills the same requirement in ${t}.` });
        unplacedNeeds.delete(code);
        needs.delete(code);
        swapped = true;
        break;
      }
      if (swapped) break;
    }
  }

  // ---------- Summer before an extra semester: Core/elective hours can move to a summer term ----------
  const summerUsed: string[] = [];
  const SUMMER_MAX = 7;
  const summers = planTerms
    .filter((t) => t.startsWith("Spring"))
    .map((t) => `Summer ${t.split(" ")[1]}`)
    .filter((su) => compareTerms(su, student.targetGradTerm) < 0);
  const movable = (l: PlanLine) => l.slot && (l.requirementId === "elective" || l.requirementId === "upper-division" || !!P.requirements[l.requirementId]?.tags?.includes("core"));
  const toSummer = (line: PlanLine): string | null => {
    for (const su of summers) {
      if ((termHours.get(su) ?? 0) + line.credits > SUMMER_MAX) continue;
      line.confidenceNote = "Summer course: any approved course; summer offerings vary";
      if (!plannedLines.has(su)) plannedLines.set(su, []);
      plannedLines.get(su)!.push(line);
      termHours.set(su, (termHours.get(su) ?? 0) + line.credits);
      if (!summerUsed.includes(su)) summerUsed.push(su);
      return su;
    }
    return null;
  };
  // 1. A required course that didn't fit: move a Core/elective slot out of a semester to summer to make room
  for (const code of [...unplacedNeeds]) {
    const need = needs.get(code)!;
    // the course itself, or one swap within the same requirement
    const options = [
      code,
      ...(need.choiceReq
        ? altOrder(P.requirements[need.choiceReq].courses ?? []).filter(
            (a) => a !== code && !needs.has(a) && !completedCodes.has(a) && ds.courses.has(a) && !programGated(ds.courses.get(a)!),
          )
        : []),
    ];
    let done = false;
    for (const opt of options) {
      const c = ds.courses.get(opt)!;
      const credits = c.credits ?? 3;
      for (const t of planTerms) {
        const o = offerFor(opt, t);
        if (o.status === "not-offered" || o.status === "other-season" || holds.has(t)) continue;
        const e = checkEligibility(ds, student, c, t, state, { declaredBy, programs: programIds });
        if (!e.ok) continue;
        const lines = plannedLines.get(t)!;
        const slot = lines.find((l) => movable(l) && (termHours.get(t) ?? 0) - l.credits + credits <= maxLoad);
        if (!slot) continue;
        const su = toSummer(slot);
        if (!su) continue;
        lines.splice(lines.indexOf(slot), 1);
        let placed = need;
        if (opt !== code) {
          const reason = reasonFor(code, planTerms[planTerms.length - 1]);
          placed = { ...need, code: opt, credits, added: "swap", why: `Swapped in for ${code} (${reason.charAt(0).toLowerCase() + reason.slice(1)}). Fills the same requirement: ${need.reqNames[0]}.` };
          needs.delete(code);
          needs.set(opt, placed);
          swaps.push({ from: code, to: opt, reason: `${code}: ${reason}. ${opt} fills the same requirement in ${t}.` });
        }
        lines.push(lineForNeed(placed, t, e.notes, e.pendingGrade));
        placedTerm.set(opt, t);
        termHours.set(t, (termHours.get(t) ?? 0) - slot.credits + credits);
        unplacedNeeds.delete(code);
        addAdvisor({
          id: `summer-${opt}`,
          kind: "load",
          title: `${slot.title.replace(/^TCU Core: /, "")} moves to ${su} to make room for ${opt}`,
          detail: `${t} would go over ${loadNote}. Taking ${slot.title.replace(/^TCU Core: /, "")} in ${su} keeps graduation on time. The alternatives are a dean-approved overload or an extra semester.`,
          source: P.load.source,
        });
        done = true;
        break;
      }
      if (done) break;
    }
  }
  // 2. Leftover Core/elective slots go to summer instead of a new semester
  if (!unplacedNeeds.size) {
    for (const s of [...unplacedSlots]) {
      if (s.kind === "requirement") continue;
      const su = toSummer(lineForSlot(s));
      if (!su) break;
      unplacedSlots.splice(unplacedSlots.indexOf(s), 1);
    }
    if (summerUsed.length && !advisor.some((a) => a.id.startsWith("summer-"))) {
      addAdvisor({
        id: "summer",
        kind: "load",
        title: `Plan uses ${summerUsed.join(" and ")}`,
        detail: `The remaining hours don't fit within ${loadNote} per semester, so ${summerUsed.join(" and ")} holds Core or elective hours (summer limit ${SUMMER_MAX}). The alternatives are a dean-approved overload or an extra semester.`,
        source: P.load.source,
      });
    }
  }
  while ((unplacedNeeds.size || unplacedSlots.length) && extraTerms.length < MAX_EXTRA_TERMS) {
    const last = allTerms()[allTerms().length - 1];
    const t = nextRegularTerm(last);
    extraTerms.push(t);
    placeTerm(t, 1);
  }

  // ---------- Anything still unplaced after extra terms ----------
  const unplaced: Plan["unplaced"] = [];
  for (const code of [...unplacedNeeds]) {
    const need = needs.get(code)!;
    const lastTerm = allTerms()[allTerms().length - 1];
    const reason = reasonFor(code, lastTerm);
    unplaced.push({ code, credits: need.credits, reason });
    addAdvisor({
      id: `unplaced-${code}`,
      kind: "unplaced",
      title: `${code} doesn't fit before ${lastTerm}`,
      detail: `${reason}. It's needed for ${need.reqNames[0]}.`,
      source: need.source,
    });
  }
  // Courses that only fit after the target push graduation back: name the bottleneck
  for (const t of extraTerms) {
    for (const l of plannedLines.get(t) ?? []) {
      if (l.slot) continue;
      addAdvisor({
        id: `late-${l.code}`,
        kind: "unplaced",
        title: `${l.code} pushes graduation to ${t}`,
        detail: `${l.code} couldn't be placed by ${student.targetGradTerm}: ${reasonFor(l.code, planTerms[planTerms.length - 1])}.`,
        source: l.source,
      });
    }
  }
  for (const s of unplacedSlots) unplaced.push({ code: s.id, credits: s.credits, reason: `${s.name}: no room within ${maxLoad} hours per term` });

  // ---------- Assemble ----------
  const coreFor = (code: string) => {
    const cats = coreAssignments.filter((a) => a.code === code).map((a) => a.slotName);
    return cats.length ? `TCU Core: ${cats.join(" + ")}` : undefined;
  };
  const terms: PlanTerm[] = [];
  if (student.inProgress.length) {
    terms.push({
      term: student.currentTerm,
      status: "in-progress",
      hours: ipHours,
      lines: student.inProgress.map((ip) => {
        const c = ds.courses.get(ip.code);
        const used = [...(usedBy.get(ip.code) ?? [])];
        return {
          code: ip.code,
          title: courseTitle(c, ip.code),
          credits: ip.credits ?? credit(ip.code),
          slot: false,
          requirementId: "in-progress",
          requirement: appliedCompleted.get(ip.code)?.join(" + ") ?? coreFor(ip.code) ?? "Counts toward total hours",
          programs: used,
          source: "Student schedule",
          confidence: "in-progress" as Confidence,
          confidenceNote: "Enrolled this term",
          why: appliedCompleted.has(ip.code)
            ? `Applied to ${appliedCompleted.get(ip.code)!.join(" and ")}.`
            : coreFor(ip.code)
              ? `In progress; fills ${coreFor(ip.code)}.`
              : "In progress; counts toward total hours.",
        };
      }),
    });
  }
  for (const t of [...allTerms(), ...summerUsed].sort(compareTerms)) {
    const lines = plannedLines.get(t) ?? [];
    const hold = holds.get(t);
    if (!lines.length && !hold && extraTerms.includes(t)) continue;
    terms.push({ term: t, status: hold ? "hold" : "planned", hold: hold?.note, lines, hours: termHours.get(t) ?? 0 });
  }
  const lastWithCourses = [...terms].reverse().find((t) => t.lines.length > 0);
  const gradTerm = unplaced.length ? "Not yet determined" : lastWithCourses?.term ?? student.targetGradTerm;
  const onTime = !unplaced.length && compareTerms(gradTerm, student.targetGradTerm) <= 0;

  // Shared courses between two programs
  for (const [code, set] of usedBy) {
    const progs = [...set].filter((p) => p !== "degree");
    if (progs.length >= 2) {
      const lim = sharedLimit(progs[0], progs[1]);
      addAdvisor({
        id: `shared-${code}`,
        kind: "shared-credit",
        title: `${code} counts toward ${progs.map((p) => P.programs[p]?.name ?? p).join(" and ")}`,
        detail: lim
          ? `Shared hours between these programs are capped at ${lim.maxShared}; this plan shares ${sharedHours(progs[0], progs[1])}. Confirm with your advisor.`
          : "Confirm that this course may count toward both programs.",
        source: lim?.source ?? P.rules.source,
      });
    }
  }
  if (!student.declared && programIds.some((p) => P.programs[p]?.kind === "major")) {
    addAdvisor({
      id: "declaration",
      kind: "declaration",
      title: "Major not declared yet",
      detail: `Upper-division business courses require a declared major. This plan assumes you declare by ${declaredBy ?? "the term you reach the hour minimum"}.`,
      source: programIds.map((p) => P.programs[p]?.declare?.text).filter(Boolean).join(" ") || P.rules.source,
    });
  }
  for (const [term, h] of holds) {
    addAdvisor({ id: `hold-${term}`, kind: "other", title: `${h.type === "study-abroad" ? "Study abroad" : h.type} in ${term}`, detail: `${h.note} Only Core and elective slots are planned that term; confirm which courses transfer back.`, source: "Student profile" });
  }
  const plannedCodes = new Set(terms.flatMap((t) => t.lines.filter((l) => !l.slot).map((l) => l.code)));
  const unverifiedOffers = terms.flatMap((t) => t.lines.filter((l) => l.confidence === "advisor").map((l) => `${l.code} (${t.term})`));
  if (unverifiedOffers.length) {
    addAdvisor({
      id: "unverified-offerings",
      kind: "availability",
      title: "Some courses aren't on any posted schedule",
      detail: `${unverifiedOffers.join(", ")}: no section seen in a posted term, so availability is unverified.`,
      source: ds.sectionsMeta.source,
    });
  }
  const lowParse = [...plannedCodes].filter((c) => ds.courses.get(c)?.parseConfidence === "low");
  if (lowParse.length) {
    dataNotes.push(`Prerequisites for ${lowParse.join(", ")} were auto-parsed with low confidence; check prereq_overrides.json.`);
  }
  // Demo: known TCU data conflicts (programs.json `contradictions`) and course advisor notes stay in the data but aren't shown
  const relevant: Contradiction[] = [];

  const allLines = terms.flatMap((t) => t.lines);
  const plannedHours = terms.filter((t) => t.status !== "in-progress").reduce((n, t) => n + t.hours, 0);
  const upperPlannedFinal = terms
    .filter((t) => t.status !== "in-progress")
    .flatMap((t) => t.lines)
    .reduce((n, l) => n + (l.slot ? (l.upper ? l.credits : 0) : levelOf(l.code) >= 3 ? l.credits : 0), 0);

  const plan: Plan = {
    studentId: student.id,
    cohort: cohort.label,
    programs: programIds,
    terms,
    gradTerm,
    targetGradTerm: student.targetGradTerm,
    onTime,
    totals: {
      hours: completedHours + ipHours + plannedHours,
      required: cohort.totalHours,
      upper: upperDone + upperPlannedFinal,
      upperRequired: cohort.upperDivHours,
      maxLoad: Math.max(0, ...terms.filter((t) => t.status === "planned").map((t) => t.hours)),
    },
    unplaced,
    swaps,
    blocked,
    checks: [],
    advisorItems: advisor,
    contradictions: relevant,
    dataNotes: [...new Set(dataNotes)],
    coreAssignments: (() => {
      // Open categories that got a "choose a course" slot in some term count as planned
      const slotTerm = new Map<string, string>();
      for (const t of terms) for (const l of t.lines) if (l.slot && l.code.startsWith("core-")) slotTerm.set(l.code, t.term);
      const seen = new Map<string, number>();
      return coreAssignments.map((a) => {
        if (a.code) return { ...a, term: placedTerm.get(a.code) };
        const i = seen.get(a.slot) ?? 0;
        seen.set(a.slot, i + 1);
        const term = slotTerm.get(`core-${a.slot}#${i}`);
        return term ? { ...a, source: "planned" as const, title: `Choose a ${a.slotName} course`, term } : a;
      });
    })(),
    ...(coreReq ? { coreLabel: coreReq.name } : {}),
  };
  void allLines;
  plan.checks = validatePlan(ds, student, plan);
  return plan;
}

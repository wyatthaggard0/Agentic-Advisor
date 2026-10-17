// Tools Claude can call. Every academic fact comes from the engine and the data files, never from model memory.

import type { Dataset } from "../engine/load";
import { courseTitle } from "../engine/load";
import { offering } from "../engine/eligibility";
import { buildPlan } from "../engine/planner";
import { comparePlans } from "../engine/compare";
import { nextRegularTerm } from "../engine/terms";
import type { Plan, Student } from "../engine/types";
import { recommend, type Recommendations } from "../careers";

export type UiAction =
  | { type: "show_blueprint"; programs: string[] }
  | { type: "career_survey" }
  | { type: "chips"; chips: string[] }
  | { type: "recommendations"; data: Recommendations };

export interface ToolContext {
  ds: Dataset;
  student: Student;
  programs: string[];
  actions: UiAction[];
  studentPatch: Partial<Student>;
}

export const TOOL_DEFS = [
  {
    name: "get_student_profile",
    description: "Returns the student's profile: programs, catalog cohort, completed and in-progress courses, hours, survey interests. Call this before giving personalized advice.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "build_plan",
    description:
      "Builds and validates the semester-by-semester graduation plan from verified TCU data. Returns each term's courses with the requirement each fills, availability labels, the 10 validation checks, swaps, and items that need advisor review. Omit programs to use the student's current programs.",
    input_schema: {
      type: "object" as const,
      properties: { programs: { type: "array", items: { type: "string" }, description: "Program ids, e.g. BBA-FINA, BBA-BIS, CERT-FINTECH" } },
      additionalProperties: false,
    },
  },
  {
    name: "compare_programs",
    description:
      "Compares the current plan with a what-if plan that adds and/or removes programs (majors, minors, certificates). Returns graduation date, hours, heaviest semester, summer use, swaps and advisor items for both. Use this for questions like 'how does a certificate fit my timeline'. Does not change the student's record.",
    input_schema: {
      type: "object" as const,
      properties: {
        add: { type: "array", items: { type: "string" } },
        remove: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  },
  {
    name: "explain_course",
    description: "Returns verified data for one course: title, credits, prerequisites (with minimum grades), restrictions, which of the student's requirements it fills, and offering evidence for the next terms.",
    input_schema: {
      type: "object" as const,
      properties: { code: { type: "string", description: "Course code like 'FINA 30213'" } },
      required: ["code"],
      additionalProperties: false,
    },
  },
  {
    name: "list_programs",
    description: "Lists the programs the planner knows (id, name, kind, requirements summary) and the opportunity programs.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "search_courses",
    description: "Searches course descriptions by keyword (e.g. 'machine learning', 'real estate'). Returns up to 8 courses with titles and credits. Use to suggest electives that fit a goal.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" }, subjects: { type: "array", items: { type: "string" } } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "career_recommendations",
    description:
      "Returns career guidance matched to the student's saved survey (year, interest areas, preferred locations). For incoming/freshman/sophomore students it returns industries, majors and TCU programs to explore (broad view). For juniors/seniors it returns specific roles to apply for, example employers in their preferred regions, and recruiting timing. Employers are examples to research, never confirmed openings.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "offer_career_survey",
    description: "Shows the Planning Survey form (year, interests, hometown and locations, semester load, study abroad, Fridays, graduation target). Use when the student is unsure about direction or hasn't taken the survey.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "save_survey",
    description: "Saves survey answers (interest keywords and possible careers) to the student's planning profile so plans can match electives to them.",
    input_schema: {
      type: "object" as const,
      properties: { interests: { type: "array", items: { type: "string" } }, careers: { type: "array", items: { type: "string" } } },
      required: ["interests"],
      additionalProperties: false,
    },
  },
  {
    name: "show_blueprint",
    description: "Opens the Graduation Blueprint tab for the given programs so the student can review the full plan and send it for advisor review.",
    input_schema: {
      type: "object" as const,
      properties: { programs: { type: "array", items: { type: "string" } } },
      required: ["programs"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_replies",
    description: "Shows up to 3 short suggested replies as buttons under your message.",
    input_schema: {
      type: "object" as const,
      properties: { chips: { type: "array", items: { type: "string" }, maxItems: 3 } },
      required: ["chips"],
      additionalProperties: false,
    },
  },
];

export function planSummary(ds: Dataset, plan: Plan) {
  return {
    programs: plan.programs.map((p) => `${p} (${ds.programs.programs[p]?.name ?? p})`),
    cohort: plan.cohort,
    graduation: plan.gradTerm,
    target: plan.targetGradTerm,
    onTime: plan.onTime,
    blocked: plan.blocked,
    totals: plan.totals,
    terms: plan.terms.map((t) => ({
      term: t.term,
      status: t.status,
      hours: t.hours,
      courses: t.lines.map((l) => ({
        code: l.slot ? null : l.code,
        title: l.title,
        credits: l.credits,
        fills: l.requirement,
        availability: l.confidence,
        why: l.why,
        ...(l.prereqNote ? { note: l.prereqNote } : {}),
      })),
    })),
    failedChecks: plan.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.detail}`),
    passedChecks: plan.checks.filter((c) => c.pass).length,
    swaps: plan.swaps.map((s) => s.reason),
    unplaced: plan.unplaced,
    advisorItems: plan.advisorItems.map((a) => ({ title: a.title, detail: a.detail, source: a.source })),
    dataNotes: plan.dataNotes,
  };
}

export function profileSummary(ds: Dataset, s: Student) {
  const credit = (code: string) => ds.courses.get(code)?.credits ?? 3;
  return {
    name: s.name,
    sampleStudent: s.sample,
    startTerm: s.startTerm,
    currentTerm: s.currentTerm,
    targetGraduation: s.targetGradTerm,
    programs: s.programs.map((p) => `${p} (${ds.programs.programs[p]?.name ?? p})`),
    declaredMajor: s.declared,
    hoursEarned: s.completed.reduce((n, c) => n + (c.credits ?? credit(c.code)), 0) + (s.otherHours?.hours ?? 0),
    hoursInProgress: s.inProgress.reduce((n, c) => n + (c.credits ?? credit(c.code)), 0),
    completed: s.completed.map((c) => ({
      code: c.code,
      title: courseTitle(ds.courses.get(c.code), c.code),
      grade: c.grade,
      term: c.term,
      ...(c.transfer ? { transfer: c.transfer } : {}),
    })),
    inProgress: s.inProgress.map((c) => ({ code: c.code, title: courseTitle(ds.courses.get(c.code), c.code) })),
    otherCredit: s.otherHours,
    survey: s.survey,
    holds: s.holds,
  };
}

export function runTool(ctx: ToolContext, name: string, input: Record<string, unknown>): unknown {
  const { ds } = ctx;
  const student = { ...ctx.student, ...ctx.studentPatch } as Student;
  const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  switch (name) {
    case "get_student_profile":
      return profileSummary(ds, student);
    case "build_plan": {
      const programs = strList(input.programs);
      const plan = buildPlan(ds, student, { programs: programs.length ? programs : ctx.programs });
      return planSummary(ds, plan);
    }
    case "compare_programs": {
      const add = strList(input.add);
      const remove = strList(input.remove);
      const next = [...ctx.programs.filter((p) => !remove.includes(p)), ...add.filter((p) => !ctx.programs.includes(p))];
      const a = buildPlan(ds, student, { programs: ctx.programs });
      const b = buildPlan(ds, student, { programs: next });
      const cmp = comparePlans(a, b, ctx.programs.join(" + "), next.join(" + "), ds.programs.cost);
      return {
        comparison: cmp,
        whatIfPrograms: next,
        whatIf: { blocked: b.blocked, swaps: b.swaps.map((s) => s.reason), advisorItems: b.advisorItems.map((x) => x.title), failedChecks: b.checks.filter((c) => !c.pass).map((c) => c.detail) },
        note: "What-if only: the student's official record is unchanged.",
      };
    }
    case "explain_course": {
      const code = String(input.code ?? "").toUpperCase().replace(/^([A-Z]{3,4})\s*(\d{5})$/, "$1 $2");
      const c = ds.courses.get(code);
      if (!c) return { error: `${code} is not in the TCU course data. Do not describe it.` };
      const terms = [nextRegularTerm(student.currentTerm), nextRegularTerm(nextRegularTerm(student.currentTerm))];
      const reqs = Object.values(ds.programs.requirements).filter((r) => r.courses?.includes(code)).map((r) => r.name);
      return {
        code,
        title: courseTitle(c, code),
        credits: c.credits,
        prerequisites: c.prereqs.map((g) => g.map((r) => `${r.code}${r.minGrade ? ` (min ${r.minGrade})` : ""}${r.concurrentOk ? " (may be taken the same term)" : ""}`).join(" OR ")),
        corequisites: c.coreqs,
        restrictions: c.conditions.map((k) => k.text),
        permissionAlternative: !!c.permissionAlt,
        prerequisiteText: c.prereqText,
        fillsRequirements: reqs,
        offering: terms.map((t) => ({ term: t, ...offering(ds, code, t) })),
        description: c.description.slice(0, 600),
        source: c.source,
        parseConfidence: c.parseConfidence,
      };
    }
    case "list_programs":
      return {
        programs: Object.values(ds.programs.programs).map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          requirements: p.requirements.map((r) => ds.programs.requirements[r]?.name ?? r),
          note: p.note,
          source: p.source,
        })),
        opportunities: ds.programs.opportunities,
        rulesVerified: ds.programs.meta.verified,
      };
    case "search_courses": {
      const q = String(input.query ?? "").toLowerCase();
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const subjects = strList(input.subjects).map((s) => s.toUpperCase());
      const hits = [...ds.courses.values()]
        .filter((c) => c.level >= 1 && c.level <= 4 && (!subjects.length || subjects.includes(c.subject)))
        .map((c) => {
          const text = `${courseTitle(c, c.code)} ${c.description}`.toLowerCase();
          return { c, score: text.includes(q) ? 10 : words.filter((w) => text.includes(w)).length };
        })
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      return hits.map(({ c }) => ({ code: c.code, title: courseTitle(c, c.code), credits: c.credits, prerequisites: c.prereqText ?? "none listed", source: c.source }));
    }
    case "career_recommendations": {
      if (!student.survey?.completedAt && !student.survey?.areas?.length) return { error: "The student hasn't taken the survey yet. Call offer_career_survey." };
      // The UI renders these as a card with match bars; Claude writes the short text around it
      const majorIds = ctx.programs.filter((p) => ds.programs.programs[p]?.kind === "major" && p !== "BBA-UNDECIDED");
      const recs = recommend(student.survey!, student.currentTerm, student.targetGradTerm, {
        majors: majorIds.map((p) => ds.programs.programs[p].name.replace(/ \(BBA\)$/, "")),
        programIds: ctx.programs,
        business: ctx.programs.some((p) => p.startsWith("BBA-")),
      });
      // For pathways the planner models, show the real effect on this student's plan
      const basePlan = buildPlan(ds, student, { programs: ctx.programs });
      for (const item of [...(recs.doubleMajors ?? []), ...(recs.minors ?? []), ...(recs.certificates ?? [])]) {
        const ids = item.programIds ?? [];
        if (!ids.length || !ids.every((id) => ds.programs.programs[id])) continue;
        const next =
          item.kind === "double-major"
            ? [...ctx.programs.filter((p) => p !== "BBA-UNDECIDED" && !ids.includes(p)), ...ids]
            : [...ctx.programs, ...ids.filter((id) => !ctx.programs.includes(id))];
        const plan = buildPlan(ds, student, { programs: next });
        if (plan.blocked.length) continue;
        const dh = plan.totals.hours - basePlan.totals.hours;
        const left = plan.unplaced.reduce((n, u) => n + u.credits, 0);
        const grad = plan.unplaced.length
          ? `doesn't fit by ${plan.targetGradTerm} (${left} hours left over; ask your advisor about summer or an overload)`
          : plan.gradTerm === basePlan.gradTerm
            ? `graduation stays ${plan.gradTerm}`
            : `graduation moves to ${plan.gradTerm}`;
        const summer = plan.terms.some((t) => t.term.startsWith("Summer")) && !basePlan.terms.some((t) => t.term.startsWith("Summer"));
        const extraCost = comparePlans(basePlan, plan, "", "", ds.programs.cost).cost;
        item.impact = `In your plan: ${grad}, ${dh === 0 ? "same total hours" : `${dh > 0 ? "+" : ""}${dh} hours`}${summer ? ", uses a summer term" : ""}${extraCost && extraCost.studentCost > 0 ? `, about $${extraCost.studentCost.toLocaleString("en-US")} more` : ""}`;
      }
      if (!ctx.actions.some((a) => a.type === "recommendations")) ctx.actions.push({ type: "recommendations", data: recs });
      return recs;
    }
    case "offer_career_survey":
      ctx.actions.push({ type: "career_survey" });
      return { shown: true };
    case "save_survey": {
      const survey = { ...(student.survey ?? { interests: [] }), interests: strList(input.interests), careers: strList(input.careers) };
      ctx.studentPatch.survey = survey;
      return { saved: survey };
    }
    case "show_blueprint": {
      const programs = strList(input.programs);
      ctx.actions.push({ type: "show_blueprint", programs: programs.length ? programs : ctx.programs });
      return { opened: true };
    }
    case "suggest_replies":
      ctx.actions.push({ type: "chips", chips: strList(input.chips).slice(0, 3) });
      return { shown: true };
    default:
      return { error: `Unknown tool ${name}` };
  }
}

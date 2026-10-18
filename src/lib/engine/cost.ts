// Estimated cost of a plan's remaining terms from TCU's tuition rate table (programs.json cost.tuition):
//  - fall/spring: 1-8 hours per hour, 9-11 hours per hour, 12-18 hours flat, each hour over 18 extra
//  - summer: per hour
//  - Neeley differential on every credit hour of a Neeley course (ACCT, BUSI, ENTR, FINA, INSC, MANA, MARK)
//  - housing and food for each fall/spring term
// Terms already in progress are billed, so only planned terms count.

import type { Plan, PlanCost, ProgramsFile, TermCost } from "./types";

export function termTuition(t: NonNullable<NonNullable<ProgramsFile["cost"]>["tuition"]>, hours: number, summer: boolean) {
  if (hours <= 0) return { tuition: 0, overload: 0 };
  if (summer) return { tuition: hours * t.summerPerHour, overload: 0 };
  if (hours < 9) return { tuition: hours * t.perHour1to8, overload: 0 };
  if (hours < t.flatMinHours) return { tuition: hours * t.perHour9to11, overload: 0 };
  const overload = Math.max(0, hours - t.flatMaxHours) * t.perHourOver18;
  return { tuition: t.flatRate + overload, overload };
}

export function planCost(plan: Plan, cost: ProgramsFile["cost"]): PlanCost | undefined {
  const t = cost?.tuition;
  if (!cost || !t) return undefined;
  const terms: TermCost[] = [];
  let slotHours = 0;
  for (const term of plan.terms) {
    if (term.status !== "planned" || !term.lines.length) continue;
    const summer = term.term.startsWith("Summer");
    const hours = term.lines.reduce((n, l) => n + l.credits, 0);
    const neeleyHours = term.lines.filter((l) => !l.slot && t.neeleySubjects.includes(l.code.split(" ")[0])).reduce((n, l) => n + l.credits, 0);
    slotHours += term.lines.filter((l) => l.slot).reduce((n, l) => n + l.credits, 0);
    const { tuition, overload } = termTuition(t, hours, summer);
    const differential = neeleyHours * t.neeleyPerHour;
    const housing = summer ? 0 : cost.housingFoodPerSemester;
    terms.push({ term: term.term, hours, neeleyHours, tuition, overload, differential, housing, total: tuition + differential + housing });
  }
  const sum = (k: keyof TermCost) => terms.reduce((n, x) => n + (x[k] as number), 0);
  const notes = [
    `TCU ${t.year} rates applied to every future term; later years will likely cost more.`,
    "Before financial aid and scholarships; fees, books and travel not included.",
    ...(slotHours ? [`${slotHours} hours are open "choose a course" slots, counted as non-Neeley courses (no differential).`] : []),
    "Housing and food use TCU's on-campus estimate for each fall and spring term.",
  ];
  return {
    terms,
    tuition: sum("tuition"),
    overload: sum("overload"),
    differential: sum("differential"),
    housing: sum("housing"),
    total: sum("total"),
    notes,
    source: t.source,
  };
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

import type { Plan, ProgramsFile } from "./types";
import { regularTermsBetween } from "./terms";

export interface PlanComparison {
  a: string;
  b: string;
  rows: { label: string; a: string; b: string; changed: boolean }[];
  added: string[];
  removed: string[];
  summary: string;
  cost?: { extraSemesters: number; studentCost: number; note: string; source: string };
}

const courseSet = (p: Plan) => new Set(p.terms.flatMap((t) => t.lines.filter((l) => !l.slot).map((l) => l.code)));
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const TERM = /^(Spring|Fall) \d{4}$/;

export function comparePlans(a: Plan, b: Plan, labelA: string, labelB: string, cost?: ProgramsFile["cost"]): PlanComparison {
  const ca = courseSet(a);
  const cb = courseSet(b);
  const added = [...cb].filter((c) => !ca.has(c));
  const removed = [...ca].filter((c) => !cb.has(c));
  const summer = (p: Plan) => p.terms.filter((t) => t.term.startsWith("Summer")).map((t) => t.term).join(", ") || "None";
  const fails = (p: Plan) => p.checks.filter((c) => !c.pass).length;
  const row = (label: string, x: string, y: string) => ({ label, a: x, b: y, changed: x !== y });
  const rows = [
    row("Graduation", a.gradTerm, b.gradTerm),
    row("Total hours", String(a.totals.hours), String(b.totals.hours)),
    row("Heaviest semester", `${a.totals.maxLoad} hrs`, `${b.totals.maxLoad} hrs`),
    row("Summer courses", summer(a), summer(b)),
    row("Swaps needed", String(a.swaps.length), String(b.swaps.length)),
    row("Advisor items", String(a.advisorItems.length), String(b.advisorItems.length)),
    row("Failed checks", String(fails(a)), String(fails(b))),
  ];

  // Cost of graduating later: whole extra semesters of tuition plus housing and food (TCU 2026-27)
  let costInfo: PlanComparison["cost"];
  if (cost && TERM.test(a.gradTerm) && TERM.test(b.gradTerm)) {
    const later = regularTermsBetween(a.gradTerm, b.gradTerm).length;
    const earlier = regularTermsBetween(b.gradTerm, a.gradTerm).length;
    const extra = later - earlier;
    const perSemester = cost.tuitionPerSemester + cost.housingFoodPerSemester;
    const usesSummer = summer(b) !== "None" && summer(a) === "None";
    costInfo = {
      extraSemesters: extra,
      studentCost: extra * perSemester,
      note:
        (extra === 0
          ? "No extra semester."
          : `${extra > 0 ? "+" : ""}${extra} semester${Math.abs(extra) === 1 ? "" : "s"} × ${usd(perSemester)} (${usd(cost.tuitionPerSemester)} tuition + ${usd(cost.housingFoodPerSemester)} housing and food), plus a later start to full-time pay.`) +
        (usesSummer ? " Summer tuition is extra; TCU's summer per-hour rate isn't in our data." : ""),
      source: cost.source,
    };
    rows.push(row("Added cost to you", "$0", extra > 0 ? `${usd(extra * perSemester)}${usesSummer ? " + summer tuition" : ""}` : usesSummer ? "Summer tuition" : extra < 0 ? `Saves ${usd(-extra * perSemester)}` : "$0"));
  }

  const gradChange = a.gradTerm === b.gradTerm ? `Graduation stays ${b.gradTerm}` : `Graduation moves from ${a.gradTerm} to ${b.gradTerm}`;
  const hours = b.totals.hours - a.totals.hours;
  const summary = `${gradChange}. ${hours === 0 ? "Same total hours" : `${hours > 0 ? "+" : ""}${hours} hours`}${added.length ? `; adds ${added.join(", ")}` : ""}${removed.length ? `; drops ${removed.join(", ")}` : ""}.${costInfo && costInfo.extraSemesters > 0 ? ` Estimated added cost: ${usd(costInfo.studentCost)}.` : ""}`;
  return { a: labelA, b: labelB, rows, added, removed, summary, ...(costInfo ? { cost: costInfo } : {}) };
}

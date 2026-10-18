import type { Plan, ProgramsFile } from "./types";
import { regularTermsBetween } from "./terms";
import { usd } from "./cost";

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

  // Cost: each plan's remaining terms priced from TCU's tuition table (flat 12-18 hours, per hour outside it,
  // Neeley differential per Neeley credit hour, housing per fall/spring term). Falls back to whole extra semesters.
  let costInfo: PlanComparison["cost"];
  const extra = TERM.test(a.gradTerm) && TERM.test(b.gradTerm) ? regularTermsBetween(a.gradTerm, b.gradTerm).length - regularTermsBetween(b.gradTerm, a.gradTerm).length : 0;
  if (a.cost && b.cost) {
    const diff = b.cost.total - a.cost.total;
    const part = (label: string, x: number) => (x ? `${x > 0 ? "+" : "−"}${usd(Math.abs(x))} ${label}` : "");
    const parts = [
      part("tuition", b.cost.tuition - b.cost.overload - (a.cost.tuition - a.cost.overload)),
      part("over-18-hour tuition", b.cost.overload - a.cost.overload),
      part("Neeley differential", b.cost.differential - a.cost.differential),
      part("housing and food", b.cost.housing - a.cost.housing),
    ].filter(Boolean);
    costInfo = {
      extraSemesters: extra,
      studentCost: diff,
      note: `${parts.length ? parts.join(", ") : "No change"}. ${b.cost.notes[0]} ${b.cost.notes[1]}`,
      source: b.cost.source,
    };
    rows.push(row("Est. cost of remaining terms", usd(a.cost.total), usd(b.cost.total)));
    rows.push(row("Added cost to you", "$0", diff > 0 ? `+${usd(diff)}` : diff < 0 ? `Saves ${usd(-diff)}` : "$0"));
  } else if (cost && TERM.test(a.gradTerm) && TERM.test(b.gradTerm)) {
    const perSemester = cost.tuitionPerSemester + cost.housingFoodPerSemester;
    costInfo = {
      extraSemesters: extra,
      studentCost: extra * perSemester,
      note: extra === 0 ? "No extra semester." : `${extra} semester${Math.abs(extra) === 1 ? "" : "s"} × ${usd(perSemester)} (${usd(cost.tuitionPerSemester)} tuition + ${usd(cost.housingFoodPerSemester)} housing and food).`,
      source: cost.source,
    };
    rows.push(row("Added cost to you", "$0", extra > 0 ? usd(extra * perSemester) : extra < 0 ? `Saves ${usd(-extra * perSemester)}` : "$0"));
  }

  const gradChange = a.gradTerm === b.gradTerm ? `Graduation stays ${b.gradTerm}` : `Graduation moves from ${a.gradTerm} to ${b.gradTerm}`;
  const hours = b.totals.hours - a.totals.hours;
  const summary = `${gradChange}. ${hours === 0 ? "Same total hours" : `${hours > 0 ? "+" : ""}${hours} hours`}${added.length ? `; adds ${added.join(", ")}` : ""}${removed.length ? `; drops ${removed.join(", ")}` : ""}.${costInfo && costInfo.studentCost > 0 ? ` Estimated added cost: ${usd(costInfo.studentCost)} (${costInfo.note.split(". ")[0]}).` : ""}`;
  return { a: labelA, b: labelB, rows, added, removed, summary, ...(costInfo ? { cost: costInfo } : {}) };
}

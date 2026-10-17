import type { Plan } from "./types";

export interface PlanComparison {
  a: string;
  b: string;
  rows: { label: string; a: string; b: string; changed: boolean }[];
  added: string[];
  removed: string[];
  summary: string;
}

const courseSet = (p: Plan) => new Set(p.terms.flatMap((t) => t.lines.filter((l) => !l.slot).map((l) => l.code)));

export function comparePlans(a: Plan, b: Plan, labelA: string, labelB: string): PlanComparison {
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
  const gradChange = a.gradTerm === b.gradTerm ? `Graduation stays ${b.gradTerm}` : `Graduation moves from ${a.gradTerm} to ${b.gradTerm}`;
  const hours = b.totals.hours - a.totals.hours;
  const summary = `${gradChange}. ${hours === 0 ? "Same total hours" : `${hours > 0 ? "+" : ""}${hours} hours`}${added.length ? `; adds ${added.join(", ")}` : ""}${removed.length ? `; drops ${removed.join(", ")}` : ""}.`;
  return { a: labelA, b: labelB, rows, added, removed, summary };
}

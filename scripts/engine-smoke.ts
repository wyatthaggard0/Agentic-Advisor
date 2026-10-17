// Prints the demo plans so engine changes can be eyeballed quickly: npm test
import { loadData, loadStudent } from "../src/lib/engine/load";
import { buildPlan } from "../src/lib/engine/planner";

const ds = loadData();
const cases: [string, string[] | undefined][] = [
  ["jordan", undefined],
  ["jordan", ["BBA-FINA", "BBA-BIS", "CERT-FINTECH"]],
  ["maya", undefined],
  ["maya", ["BBA-FINA"]],
  ["jordan", ["BBA-FINA", "BBA-BIS", "BBA-UNDECIDED"]],
];
let failed = 0;
for (const [id, programs] of cases) {
  const s = loadStudent(id);
  const plan = buildPlan(ds, s, { programs });
  console.log(`\n=== ${s.name} :: ${plan.programs.join(" + ")} :: ${plan.cohort}`);
  if (plan.blocked.length) {
    console.log("BLOCKED:", plan.blocked.map((b) => b.reason).join("; "));
    continue;
  }
  for (const t of plan.terms) {
    console.log(`  ${t.term} (${t.status}, ${t.hours} hrs): ${t.lines.map((l) => (l.slot ? `[${l.title} ${l.credits}]` : `${l.code}:${l.confidence[0]}`)).join(", ")}`);
  }
  console.log(`  grad ${plan.gradTerm} (target ${plan.targetGradTerm}) hours ${plan.totals.hours}/${plan.totals.required} upper ${plan.totals.upper}/${plan.totals.upperRequired} max ${plan.totals.maxLoad}`);
  for (const c of plan.checks) console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}: ${c.detail}`);
  console.log(`  advisor (${plan.advisorItems.length}): ${plan.advisorItems.map((a) => a.title).join(" | ")}`);
  if (plan.swaps.length) console.log("  swaps:", plan.swaps.map((x) => x.reason).join(" | "));
  if (plan.unplaced.length) console.log("  unplaced:", plan.unplaced.map((u) => `${u.code}: ${u.reason}`).join(" | "));
  failed += plan.checks.filter((c) => !c.pass).length;
}
console.log(`\n${failed} failing checks across demo plans`);

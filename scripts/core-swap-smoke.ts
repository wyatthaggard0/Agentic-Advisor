// Swapping a suggested TCU Core course for one of its listed alternatives: the plan uses the new course and checks still pass
import { loadData, loadStudent } from "../src/lib/engine/load";
import { buildPlan } from "../src/lib/engine/planner";

const ds = loadData();
let failed = 0;
for (const id of ["maya", "jordan"]) {
  const s = loadStudent(id);
  const plan = buildPlan(ds, s);
  const lines = plan.terms.flatMap((t) => t.lines);
  const pick = lines.find((l) => l.core?.alternatives.length);
  if (!pick) { console.log(`${id}: no Core pick with alternatives`); continue; }
  const alt = pick.core!.alternatives[0];
  const swapped = buildPlan(ds, { ...s, coreChoices: { prefer: [alt.code], avoid: [pick.code] } });
  const codes = swapped.terms.flatMap((t) => t.lines.map((l) => l.code));
  const ok = codes.includes(alt.code) && !codes.includes(pick.code) && swapped.checks.every((c) => c.pass);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}: ${pick.code} (${pick.core!.categories.join("+")}) -> ${alt.code} ${alt.title} [${alt.categories.join(", ")}]; ${pick.core!.alternatives.length} options; checks ${swapped.checks.filter((c) => c.pass).length}/${swapped.checks.length}`);
}
process.exit(failed ? 1 : 0);

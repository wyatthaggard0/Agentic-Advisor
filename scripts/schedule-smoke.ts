import { loadData, loadStudent } from "../src/lib/engine/load";
import { buildPlan } from "../src/lib/engine/planner";
import { buildSchedule } from "../src/lib/engine/schedule";
const ds = loadData();
for (const [id, progs] of [["jordan", ["BBA-FINA", "BBA-BIS", "CERT-FINTECH"]], ["maya", undefined]] as const) {
  const s = loadStudent(id);
  const plan = buildPlan(ds, s, { programs: progs ? [...progs] : undefined });
  const r = buildSchedule(ds, s, plan, false);
  console.log(`\n${s.name} ${r.term} tried=${r.tried} score=${r.score}`);
  for (const c of r.chosen) console.log(`  ${c.code} ${c.section.section} #${c.section.classNumber} ${c.section.days} ${c.section.start}-${c.section.end} ${c.labels.join("; ")} backups=${(r.backups[c.code] ?? []).map((b) => b.section).join(",")}`);
  for (const c of r.untimed) console.log(`  UNTIMED ${c.code} ${c.section.section}`);
  for (const u of r.unscheduled) console.log(`  NOT SCHEDULED ${u.code}: ${u.reason} swaps=${u.swapOptions.join(",")}`);
}

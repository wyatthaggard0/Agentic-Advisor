// Checks that survey answers reach the planner and the year-aware recommendations: npx tsx scripts/survey-smoke.ts
import { loadData } from "../src/lib/engine/load";
import { buildPlan } from "../src/lib/engine/planner";
import { sandboxStudent } from "../src/lib/api";
import { loadStudent } from "../src/lib/engine/load";
import { chat } from "../src/lib/ai/chat";

(async () => {
  process.env.BLUEPRINT_OFFLINE = "1";
  const ds = loadData();
  const cases = [
    { id: "maya", survey: { interests: [], year: "incoming", areas: ["investing", "sports"], interestText: "golf, investing club", hometown: "Tulsa, OK", locations: ["Dallas-Fort Worth"], workload: "light", studyAbroad: { plan: "yes", term: "Spring 2028" }, fridaysFree: true, targetGradTerm: "Spring 2030", completedAt: "x" } },
    { id: "jordan", survey: { interests: [], year: "junior", areas: ["technology", "investing"], locations: ["Dallas-Fort Worth", "New York"], workload: "balanced", studyAbroad: { plan: "no" }, fridaysFree: true, targetGradTerm: "Spring 2028", completedAt: "x" } },
  ] as const;
  for (const c of cases) {
    const s = sandboxStudent(loadStudent(c.id), { survey: c.survey as never });
    const plan = buildPlan(ds, s);
    console.log(`\n=== ${s.name}: keywords ${s.survey?.interests.join(", ")} | holds ${JSON.stringify(s.holds ?? [])} | fridays ${s.preferences?.fridaysFree}`);
    console.log(`plan: grad ${plan.gradTerm}, max load ${plan.totals.maxLoad}, checks ${plan.checks.filter((x) => x.pass).length}/10`);
    for (const t of plan.terms) if (t.status === "hold") console.log(`  hold ${t.term}: ${t.lines.map((l) => l.title).join(", ")}`);
    const r = await chat(ds, s, s.programs, [{ role: "user", content: "Survey answers: test" }]);
    console.log(r.reply);
  }
})();

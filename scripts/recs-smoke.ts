// Prints match scores for sample survey answers: npx tsx scripts/recs-smoke.ts
import { recommend } from "../src/lib/careers";
import type { Survey } from "../src/lib/engine/types";

const j = recommend({ interests: [], year: "junior", areas: ["technology", "investing"], interestText: "investing club, golf", locations: ["Dallas-Fort Worth", "New York"], completedAt: "x" } as Survey, "Fall 2026", "Spring 2028");
console.log("companies:", j.companies!.map((c) => `${c.name} ${c.score}`).join(" | "));
console.log("roles:", j.roles!.map((c) => `${c.name} ${c.score}`).join(" | "));
const m = recommend({ interests: [], year: "incoming", areas: ["investing", "sports"], interestText: "investing club, golf", locations: ["Dallas-Fort Worth"], completedAt: "x" } as Survey, "Fall 2026", "Spring 2030");
console.log("majors:", m.majors!.map((c) => `${c.name} ${c.score}`).join(" | "));
console.log("areas:", m.areas!.map((c) => `${c.name} ${c.score}`).join(" | "));

// Pathways through the chat tool (engine impact included)
import { loadData } from "../src/lib/engine/load";
import { sandboxStudent } from "../src/lib/api";
import { loadStudent } from "../src/lib/engine/load";
import { runTool } from "../src/lib/ai/tools";
import type { Recommendations } from "../src/lib/careers";
const ds = loadData();
for (const [id, year, areas] of [["maya", "incoming", ["investing", "technology"]], ["jordan", "junior", ["technology", "investing", "leadership"]]] as const) {
  const s = sandboxStudent(loadStudent(id), { survey: { interests: [], year, areas: [...areas], locations: ["Dallas-Fort Worth"], completedAt: "x" } as Survey });
  const r = runTool({ ds, student: s, programs: s.programs, actions: [], studentPatch: {} }, "career_recommendations", {}) as Recommendations;
  console.log(`\n${s.name} (${year})`);
  for (const k of ["doubleMajors", "minors", "certificates", "neeleyPrograms"] as const)
    console.log(` ${k}:`, (r[k] ?? []).map((x) => `${x.name} ${x.score}${x.impact ? ` [${x.impact}]` : ""}`).join(" | ") || "(none)");
  console.log(" doubleMajoring already:", r.doubleMajoring.already);
}

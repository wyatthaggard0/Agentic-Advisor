// Writes demo exports and checks the workbook totals against the plan: npx tsx scripts/export-smoke.ts
import fs from "node:fs";
import ExcelJS from "exceljs";
import { loadData, loadStudent } from "../src/lib/engine/load";
import { buildPlan } from "../src/lib/engine/planner";
import { buildDegreePlanWorkbook } from "../src/lib/export/degreePlanXlsx";

const ds = loadData();
fs.mkdirSync("data/runtime/exports", { recursive: true });
(async () => {
for (const [id, progs] of [["jordan", ["BBA-FINA", "BBA-BIS", "CERT-FINTECH"]], ["jordan", undefined], ["maya", undefined], ["maya", ["BBA-FINA"]]] as const) {
  const s = loadStudent(id);
  const plan = buildPlan(ds, s, { programs: progs ? [...progs] : undefined });
  const buf = await buildDegreePlanWorkbook(ds, s, plan);
  const f = `data/runtime/exports/${id}-${plan.programs.join("+")}.xlsx`;
  fs.writeFileSync(f, buf);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const v = (a: string) => { const c = ws.getCell(a).value as { result?: number } | number; return typeof c === "object" && c ? c.result : c; };
  const ok = v("A30") === plan.totals.hours;
  console.log(`${ok ? "OK " : "BAD"} ${f}: completed ${v("A18")} + enrolled ${v("A22")} + to-complete ${v("A26")} = ${v("A30")} (plan ${plan.totals.hours})`);
}
})();

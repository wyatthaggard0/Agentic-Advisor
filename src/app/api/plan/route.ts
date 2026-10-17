import { loadData } from "@/lib/engine/load";
import { buildPlan } from "@/lib/engine/planner";
import { comparePlans } from "@/lib/engine/compare";
import { handle, json, resolveStudent } from "@/lib/api";
import type { Student } from "@/lib/engine/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = ((await req.json().catch(() => null)) ?? {}) as { studentId?: string; student?: Partial<Student>; programs?: string[]; basePrograms?: string[] };
    const ds = loadData();
    const { student } = await resolveStudent(body.studentId, body.student);
    const programs = body.programs?.length ? body.programs : student.programs;
    const plan = buildPlan(ds, student, { programs });
    let comparison = null;
    const base = body.basePrograms?.length ? body.basePrograms : student.programs;
    if (base.join("|") !== programs.join("|")) {
      const basePlan = buildPlan(ds, student, { programs: base });
      const name = (ids: string[]) => ids.map((p) => ds.programs.programs[p]?.name ?? p).join(" + ");
      comparison = comparePlans(basePlan, plan, name(base), name(programs));
    }
    return json({ plan, comparison });
  });
}

import { loadData } from "@/lib/engine/load";
import { buildPlan } from "@/lib/engine/planner";
import { buildDegreePlanWorkbook } from "@/lib/export/degreePlanXlsx";
import { bad, handle, resolveStudent } from "@/lib/api";
import type { Student } from "@/lib/engine/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = ((await req.json().catch(() => null)) ?? {}) as { studentId?: string; student?: Partial<Student>; programs?: string[] };
    const ds = loadData();
    const { student } = await resolveStudent(body.studentId, body.student);
    const plan = buildPlan(ds, student, { programs: body.programs?.length ? body.programs : student.programs });
    if (plan.blocked.length) return bad(`This program combination isn't allowed: ${plan.blocked.map((b) => b.reason).join("; ")}`, 409);
    const buf = await buildDegreePlanWorkbook(ds, student, plan);
    const name = `Graduation-Blueprint-${student.name.replace(/[^A-Za-z0-9]+/g, "-")}.xlsx`;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  });
}

import { loadData } from "@/lib/engine/load";
import { buildPlan } from "@/lib/engine/planner";
import { buildSchedule } from "@/lib/engine/schedule";
import { latestReview } from "@/lib/store";
import { handle, json, resolveStudent } from "@/lib/api";
import type { SchedulePrefs, Student } from "@/lib/engine/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = ((await req.json().catch(() => null)) ?? {}) as { studentId?: string; student?: Partial<Student>; programs?: string[]; prefs?: SchedulePrefs };
    const ds = loadData();
    const { student } = await resolveStudent(body.studentId, body.student);
    const review = await latestReview(student.id);
    // Real sections are only scheduled against the plan the advisor approved; otherwise this is a preview
    const approved = review?.status === "approved";
    const plan = approved ? review!.plan : buildPlan(ds, student, { programs: body.programs?.length ? body.programs : student.programs });
    return json({ schedule: buildSchedule(ds, student, plan, approved, body.prefs), reviewStatus: review?.status ?? "none" });
  });
}

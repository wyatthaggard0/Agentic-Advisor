import { loadData } from "@/lib/engine/load";
import { buildPlan } from "@/lib/engine/planner";
import { addReview, clearReviews, decideReview, listReviews, type Review } from "@/lib/store";
import { bad, handle, HttpError, json, resolveStudent } from "@/lib/api";
import { dbEnabled, getViewer } from "@/lib/db";
import type { Student } from "@/lib/engine/types";

async function requireAdvisor() {
  if (!dbEnabled()) return;
  const v = await getViewer();
  if (!v) throw new HttpError(401, "Sign in first");
  if (v.role !== "advisor") throw new HttpError(403, "Only advisors can do that");
}

export async function GET(req: Request) {
  return handle(async () => {
    const id = new URL(req.url).searchParams.get("studentId") ?? undefined;
    if (dbEnabled() && !(await getViewer())) throw new HttpError(401, "Sign in first");
    // Row-level security limits students to their own reviews
    return json({ reviews: await listReviews(id) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = ((await req.json().catch(() => null)) ?? {}) as {
      action?: "submit" | "approve" | "request-changes" | "reset";
      studentId?: string;
      student?: Partial<Student>;
      programs?: string[];
      reviewId?: string;
      note?: string;
    };
    if (!body.action) return bad("action is required");

    if (body.action === "submit") {
      const ds = loadData();
      const { student } = await resolveStudent(body.studentId, body.student);
      const plan = buildPlan(ds, student, { programs: body.programs?.length ? body.programs : student.programs });
      const failing = plan.checks.filter((c) => !c.pass);
      if (failing.length) return bad(`Fix these before sending: ${failing.map((c) => c.name).join(", ")}`, 409);
      const review: Review = {
        id: `${student.id}-${Date.now()}`,
        studentId: student.id,
        studentName: student.name,
        programs: plan.programs,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        plan,
        questions: plan.advisorItems.map((a) => `${a.title}. ${a.detail}`),
      };
      await addReview(review);
      return json({ review });
    }

    if (body.action === "reset") {
      const { student } = await resolveStudent(body.studentId);
      await clearReviews(student.id);
      return json({ ok: true });
    }

    await requireAdvisor();
    if (!body.reviewId) return bad("reviewId is required");
    const r = await decideReview(body.reviewId, body.action === "approve" ? "approved" : "changes-requested", body.note?.slice(0, 2000));
    if (!r) return bad("Review not found", 404);
    return json({ review: r });
  });
}

// Shared helpers for the API routes.
import { loadStudent } from "./engine/load";
import type { Student } from "./engine/types";
import { plannerKeywords } from "./careers";
import { dbEnabled, getViewer, loadStudentFromDb, supabaseServer, type Viewer } from "./db";

const TERM = /^(Spring|Fall) \d{4}$/;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * The student a request is about. With Supabase on, it comes from the signed-in session: students always get
 * their own record (any requested id is ignored) and advisors may open any student. Without Supabase, the
 * sample JSON files are used (local development).
 */
export async function resolveStudent(requestedId: string | undefined, patch?: Partial<Student>): Promise<{ student: Student; viewer: Viewer | null }> {
  if (!dbEnabled()) {
    if (!requestedId) throw new HttpError(400, "studentId is required");
    return { student: sandboxStudent(loadStudent(requestedId), patch), viewer: null };
  }
  const sb = await supabaseServer();
  const viewer = await getViewer(sb);
  if (!viewer) throw new HttpError(401, "Sign in first");
  const key = viewer.role === "advisor" ? requestedId : viewer.studentKey;
  if (!key) throw new HttpError(400, viewer.role === "advisor" ? "Pick a student" : "No student record is linked to this account");
  const base = await loadStudentFromDb(sb, key);
  if (!base) throw new HttpError(404, "Student record not found");
  return { student: sandboxStudent(base, patch), viewer };
}

/** Wraps a route body so HttpErrors become JSON responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return bad(e.message, e.status);
    return bad((e as Error).message, 500);
  }
}

/**
 * The client keeps a sandbox copy of the profile (survey answers, confirmed transcript rows, what-ifs) for
 * unsaved what-ifs. Only these fields may be overridden; identity and history come from the stored record.
 */
export function sandboxStudent(base: Student, patch?: Partial<Student>): Student {
  if (!patch) return applySurvey(base);
  const s: Student = {
    ...base,
    ...(patch.survey ? { survey: patch.survey } : {}),
    ...(patch.preferences ? { preferences: patch.preferences } : {}),
    ...(Array.isArray(patch.completed) ? { completed: patch.completed } : {}),
    ...(Array.isArray(patch.inProgress) ? { inProgress: patch.inProgress } : {}),
    ...(typeof patch.targetGradTerm === "string" && TERM.test(patch.targetGradTerm) ? { targetGradTerm: patch.targetGradTerm } : {}),
  };
  return applySurvey(s);
}

/** Survey answers that change planning: target term, study-abroad hold, Fridays off. */
export function applySurvey(s: Student): Student {
  const sv = s.survey;
  if (!sv?.completedAt) return s;
  const out: Student = { ...s, preferences: { ...(s.preferences ?? {}) } };
  // Picked interest areas and free text become the keywords the planner uses to choose electives
  if (sv.areas?.length || sv.interestText) out.survey = { ...sv, interests: plannerKeywords(sv.areas ?? [], sv.interestText) };
  if (sv.targetGradTerm && TERM.test(sv.targetGradTerm)) out.targetGradTerm = sv.targetGradTerm;
  if (sv.fridaysFree !== undefined) out.preferences!.fridaysFree = sv.fridaysFree;
  if (sv.studyAbroad?.plan === "yes" && sv.studyAbroad.term && TERM.test(sv.studyAbroad.term)) {
    out.holds = [
      ...(s.holds ?? []).filter((h) => h.type !== "study-abroad"),
      { term: sv.studyAbroad.term, type: "study-abroad", note: `Study abroad planned for ${sv.studyAbroad.term} (from your survey).` },
    ];
  }
  return out;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

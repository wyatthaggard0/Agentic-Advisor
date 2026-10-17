// Saves what the student confirms so it never has to be re-entered: survey answers and transcript rows.
// Each saved course record keeps its source (transcript_upload or student_reported); registrar rows stay read-only.
import { bad, handle, HttpError, json } from "@/lib/api";
import { dbEnabled, getViewer, supabaseServer } from "@/lib/db";
import type { Survey } from "@/lib/engine/types";

interface RecordIn {
  code: string;
  grade?: string;
  term: string;
  status: "completed" | "in-progress";
  transferFrom?: string;
  edited?: boolean;
}

export async function POST(req: Request) {
  return handle(async () => {
    if (!dbEnabled()) return json({ saved: false, reason: "No database configured; changes stay in this browser session." });
    const sb = await supabaseServer();
    const viewer = await getViewer(sb);
    if (!viewer) throw new HttpError(401, "Sign in first");
    if (viewer.role !== "student" || !viewer.studentKey) throw new HttpError(403, "Only students save their own profile");
    const key = viewer.studentKey;
    const body = ((await req.json().catch(() => null)) ?? {}) as { kind?: "survey" | "records"; survey?: Survey; records?: RecordIn[] };

    if (body.kind === "survey" && body.survey) {
      const { error } = await sb.from("survey_responses").insert({ student_key: key, answers: body.survey });
      if (error) throw new Error(error.message);
      return json({ saved: true });
    }

    if (body.kind === "records" && Array.isArray(body.records)) {
      // Rows that differ from the registrar feed are stored as the student's confirmed version
      const { data: existing } = await sb.from("course_records").select("code, grade, status, source").eq("student_key", key);
      const registrar = new Map((existing ?? []).filter((r) => r.source === "registrar_sample").map((r) => [r.code as string, r]));
      const { error: delErr } = await sb.from("course_records").delete().eq("student_key", key).in("source", ["transcript_upload", "student_reported"]);
      if (delErr) throw new Error(delErr.message);
      const rows = body.records
        .filter((r) => /^[A-Z]{3,4} \d{5}$/.test(r.code))
        .filter((r) => {
          const reg = registrar.get(r.code);
          return !reg || reg.grade !== (r.grade ?? null) || reg.status !== r.status;
        })
        .map((r) => ({
          student_key: key,
          code: r.code,
          grade: r.status === "in-progress" ? null : r.grade ?? null,
          term: r.term,
          status: r.status,
          transfer_from: r.transferFrom ?? null,
          transfer_verified: r.transferFrom ? false : null,
          source: r.edited ? "student_reported" : "transcript_upload",
        }));
      if (rows.length) {
        const { error } = await sb.from("course_records").insert(rows);
        if (error) throw new Error(error.message);
      }
      return json({ saved: true, rows: rows.length });
    }
    return bad("Nothing to save");
  });
}

// Advisor reviews. With Supabase on they live in the advisor_reviews table (row-level security applies);
// otherwise in data/runtime/reviews.json for local development without a database.
import fs from "node:fs";
import path from "node:path";
import type { Plan } from "./engine/types";
import { dbEnabled, supabaseServer } from "./db";

export interface Review {
  id: string;
  studentId: string;
  studentName: string;
  programs: string[];
  status: "submitted" | "approved" | "changes-requested";
  submittedAt: string;
  decidedAt?: string;
  advisorNote?: string;
  plan: Plan;
  questions: string[];
}

const FILE = path.join(process.cwd(), "data", "runtime", "reviews.json");
const readFile = (): Review[] => {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Review[];
  } catch {
    return [];
  }
};
const writeFile = (list: Review[]) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 1));
};

interface Row {
  id: string;
  student_key: string;
  student_name: string;
  programs: string[];
  status: Review["status"];
  submitted_at: string;
  decided_at: string | null;
  advisor_note: string | null;
  plan: Plan;
  questions: string[];
}
const fromRow = (r: Row): Review => ({
  id: r.id,
  studentId: r.student_key,
  studentName: r.student_name,
  programs: r.programs,
  status: r.status,
  submittedAt: r.submitted_at,
  ...(r.decided_at ? { decidedAt: r.decided_at } : {}),
  ...(r.advisor_note ? { advisorNote: r.advisor_note } : {}),
  plan: r.plan,
  questions: r.questions,
});

/** Reviews visible to the signed-in user (row-level security filters them), newest first. */
export async function listReviews(studentId?: string): Promise<Review[]> {
  if (!dbEnabled()) {
    const all = readFile().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return studentId ? all.filter((r) => r.studentId === studentId) : all;
  }
  const sb = await supabaseServer();
  let q = sb.from("advisor_reviews").select("*").order("submitted_at", { ascending: false });
  if (studentId) q = q.eq("student_key", studentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Row[]).map(fromRow);
}

export async function latestReview(studentId: string): Promise<Review | undefined> {
  return (await listReviews(studentId))[0];
}

export async function addReview(r: Review): Promise<void> {
  if (!dbEnabled()) return writeFile([...readFile(), r]);
  const sb = await supabaseServer();
  const { error } = await sb.from("advisor_reviews").insert({
    id: r.id,
    student_key: r.studentId,
    student_name: r.studentName,
    programs: r.programs,
    status: r.status,
    submitted_at: r.submittedAt,
    plan: r.plan,
    questions: r.questions,
  });
  if (error) throw new Error(error.message);
}

export async function decideReview(id: string, status: "approved" | "changes-requested", note?: string): Promise<Review | null> {
  const decidedAt = new Date().toISOString();
  if (!dbEnabled()) {
    const list = readFile();
    const r = list.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, { status, decidedAt, advisorNote: note });
    writeFile(list);
    return r;
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.from("advisor_reviews").update({ status, decided_at: decidedAt, advisor_note: note ?? null }).eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data as Row) : null;
}

export async function clearReviews(studentId: string): Promise<void> {
  if (!dbEnabled()) return writeFile(readFile().filter((r) => r.studentId !== studentId));
  const sb = await supabaseServer();
  const { error } = await sb.from("advisor_reviews").delete().eq("student_key", studentId);
  if (error) throw new Error(error.message);
}

// Supabase access for the app. Student records live in Postgres (seeded from data/students/*.json as a stand-in
// for an authorized degree-audit export). Row-level security does the access control: route handlers use the
// signed-in user's session, so a student can only read their own rows.

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { CompletedCourse, Student, Survey } from "./engine/types";

export const dbEnabled = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // read-only cookie store (e.g. during render); the session refreshes on the next route call
        }
      },
    },
  });
}

/** Service-role client: seeding and demo reset only. Bypasses row-level security, so never expose it to users. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export interface Viewer {
  userId: string;
  role: "student" | "advisor";
  displayName: string;
  studentKey: string | null;
}

export async function getViewer(sb?: SupabaseClient): Promise<Viewer | null> {
  const client = sb ?? (await supabaseServer());
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data } = await client.from("profiles").select("role, display_name, student_key").eq("user_id", auth.user.id).maybeSingle();
  if (!data) return null;
  return { userId: auth.user.id, role: data.role, displayName: data.display_name, studentKey: data.student_key };
}

interface StudentRow {
  key: string;
  name: string;
  tag: string | null;
  sample: boolean;
  start_term: string;
  current_term: string;
  target_grad_term: string;
  programs: string[];
  declared: boolean;
  other_hours: Student["otherHours"] | null;
  satisfied_slots: Student["satisfiedSlots"] | null;
  holds: Student["holds"] | null;
  preferences: Student["preferences"] | null;
}
interface RecordRow {
  code: string;
  grade: string | null;
  term: string;
  status: "completed" | "in-progress";
  credits: number | null;
  transfer_from: string | null;
  transfer_verified: boolean | null;
  counts_toward: string | null;
  source: string;
}

export type RecordSource = "registrar_sample" | "transcript_upload" | "student_reported";

/** A student's full profile from the database: record rows, latest survey, and where each record came from. */
export async function loadStudentFromDb(sb: SupabaseClient, key: string): Promise<(Student & { tag?: string; recordSources: Record<string, RecordSource> }) | null> {
  const [{ data: s }, { data: recs }, { data: surveys }] = await Promise.all([
    sb.from("students").select("*").eq("key", key).maybeSingle<StudentRow>(),
    sb.from("course_records").select("code, grade, term, status, credits, transfer_from, transfer_verified, counts_toward, source").eq("student_key", key).order("id"),
    sb.from("survey_responses").select("answers").eq("student_key", key).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!s) return null;
  const toCourse = (r: RecordRow): CompletedCourse => ({
    code: r.code,
    ...(r.grade ? { grade: r.grade } : {}),
    term: r.term,
    ...(r.credits !== null ? { credits: Number(r.credits) } : {}),
    ...(r.transfer_from ? { transfer: { from: r.transfer_from, verified: !!r.transfer_verified } } : {}),
    ...(r.counts_toward ? { countsToward: r.counts_toward } : {}),
  });
  const rows = (recs ?? []) as RecordRow[];
  // A later student-reported or transcript row for the same course replaces the registrar row
  const byCode = new Map<string, RecordRow>();
  for (const r of rows) byCode.set(r.code, r);
  const latest = [...byCode.values()];
  const survey = (surveys?.[0]?.answers as Survey | undefined) ?? undefined;
  return {
    id: s.key,
    name: s.name,
    tag: s.tag ?? undefined,
    sample: s.sample,
    startTerm: s.start_term,
    currentTerm: s.current_term,
    targetGradTerm: s.target_grad_term,
    programs: s.programs,
    declared: s.declared,
    completed: latest.filter((r) => r.status === "completed").map(toCourse),
    inProgress: latest.filter((r) => r.status === "in-progress").map((r) => ({ ...toCourse(r), grade: "IP" })),
    ...(s.other_hours ? { otherHours: s.other_hours } : {}),
    ...(s.satisfied_slots ? { satisfiedSlots: s.satisfied_slots } : {}),
    ...(s.holds ? { holds: s.holds } : {}),
    ...(s.preferences ? { preferences: s.preferences } : {}),
    ...(survey ? { survey } : {}),
    recordSources: Object.fromEntries(latest.map((r) => [r.code, r.source as RecordSource])),
  };
}

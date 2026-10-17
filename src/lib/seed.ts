// Creates the demo accounts and loads the sample student records. Used by `npm run db:seed` and the advisor's
// "Reset demo" button. The records stand in for an authorized degree-audit export and are labeled as sample.

import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Student } from "./engine/types";

export const DEMO_USERS = [
  { email: "jordan.kim@example.com", name: "Jordan Kim", role: "student" as const, key: "jordan" },
  { email: "maya.ortiz@example.com", name: "Maya Ortiz", role: "student" as const, key: "maya" },
  { email: "advisor@example.com", name: "Demo Advisor", role: "advisor" as const, key: null },
];

function sampleStudents(): (Student & { tag?: string })[] {
  const dir = path.join(process.cwd(), "data", "students");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

/**
 * @param resetPasswords re-set existing demo accounts' passwords (command-line seed). Off for the in-app reset,
 *   because changing a password signs that account out, including the advisor who pressed Reset.
 */
export async function seedDemo(admin: SupabaseClient, password: string, resetPasswords = true): Promise<string[]> {
  const log: string[] = [];
  // Supabase results are { data, error } unions; fail loudly on any error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const must = (r: { data: any; error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };

  // 1. Student records (sample registrar feed)
  const students = sampleStudents();
  const keys = students.map((s) => s.id);
  for (const t of ["advisor_reviews", "saved_plans", "survey_responses", "course_records"]) {
    must(await admin.from(t).delete().in("student_key", keys), `clear ${t}`);
  }
  for (const s of students) {
    must(
      await admin.from("students").upsert({
        key: s.id,
        name: s.name,
        tag: s.tag ?? null,
        sample: true,
        start_term: s.startTerm,
        current_term: s.currentTerm,
        target_grad_term: s.targetGradTerm,
        programs: s.programs,
        declared: s.declared,
        other_hours: s.otherHours ?? null,
        satisfied_slots: s.satisfiedSlots ?? null,
        holds: s.holds ?? null,
        preferences: s.preferences ?? null,
        source: "registrar_sample",
        updated_at: new Date().toISOString(),
      }),
      `student ${s.id}`,
    );
    const rows = [
      ...s.completed.map((c) => ({ ...c, status: "completed" })),
      ...s.inProgress.map((c) => ({ ...c, status: "in-progress", grade: null })),
    ].map((c) => ({
      student_key: s.id,
      code: c.code,
      grade: c.grade ?? null,
      term: c.term,
      status: c.status,
      credits: c.credits ?? null,
      transfer_from: c.transfer?.from ?? null,
      transfer_verified: c.transfer ? c.transfer.verified : null,
      counts_toward: c.countsToward ?? null,
      source: "registrar_sample",
    }));
    must(await admin.from("course_records").insert(rows), `records ${s.id}`);
    // A starting survey only if the sample file has a completed one
    if (s.survey?.completedAt) must(await admin.from("survey_responses").insert({ student_key: s.id, answers: s.survey }), `survey ${s.id}`);
    log.push(`${s.name}: ${rows.length} course records`);
  }

  // 2. Demo sign-ins (email pre-confirmed; no email is ever sent)
  const existing = must(await admin.auth.admin.listUsers({ perPage: 200 }), "list users").users;
  for (const u of DEMO_USERS) {
    let id: string | undefined = existing.find((x: { email?: string }) => x.email === u.email)?.id;
    if (id) {
      if (resetPasswords) must(await admin.auth.admin.updateUserById(id, { password, email_confirm: true }), `update ${u.email}`);
    } else {
      const created = must(await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true, user_metadata: { name: u.name } }), `create ${u.email}`);
      id = created.user!.id;
    }
    must(await admin.from("profiles").upsert({ user_id: id, role: u.role, display_name: u.name, student_key: u.key }), `profile ${u.email}`);
    log.push(`account ${u.email} (${u.role})`);
  }
  return log;
}

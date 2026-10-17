// Verifies row-level security with real sign-ins (anon key, like the browser): npm run db:rls
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};
async function as(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: process.env.DEMO_PASSWORD });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const pub = await anon.from("course_records").select("code");
check((pub.data ?? []).length === 0, "signed-out visitor sees no course records");

const jordan = await as("jordan.kim@example.com");
const jr = await jordan.from("course_records").select("student_key");
check(jr.data.length > 0 && jr.data.every((r) => r.student_key === "jordan"), `Jordan sees only his own records (${jr.data.length})`);
const js = await jordan.from("students").select("key");
check(js.data.length === 1 && js.data[0].key === "jordan", "Jordan sees only his own student row");
const peek = await jordan.from("course_records").select("code").eq("student_key", "maya");
check(peek.data.length === 0, "Jordan cannot read Maya's records");
const forge = await jordan.from("course_records").insert({ student_key: "jordan", code: "FINA 30153", term: "Fall 2026", status: "completed", grade: "A", source: "registrar_sample" });
check(!!forge.error, "Jordan cannot insert a record labeled as registrar data");
const own = await jordan.from("course_records").insert({ student_key: "jordan", code: "ENGL 20803", term: "Spring 2026", status: "completed", grade: "A", source: "student_reported" }).select("id");
check(!own.error, "Jordan can add a student-reported record");
const other = await jordan.from("course_records").insert({ student_key: "maya", code: "ENGL 20803", term: "Spring 2026", status: "completed", source: "student_reported" });
check(!!other.error, "Jordan cannot add records to Maya");
const editReg = await jordan.from("course_records").delete().eq("student_key", "jordan").eq("source", "registrar_sample").select("id");
check((editReg.data ?? []).length === 0, "Jordan cannot delete registrar records");
const approve = await jordan.from("advisor_reviews").insert({ id: "x-test", student_key: "jordan", student_name: "Jordan Kim", programs: [], status: "approved", plan: {} });
check(!!approve.error, "Jordan cannot create an already-approved review");
if (own.data?.[0]) await jordan.from("course_records").delete().eq("id", own.data[0].id);

const maya = await as("maya.ortiz@example.com");
const mr = await maya.from("course_records").select("student_key");
check(mr.data.length > 0 && mr.data.every((r) => r.student_key === "maya"), `Maya sees only her own records (${mr.data.length})`);

const advisor = await as("advisor@example.com");
const ar = await advisor.from("students").select("key");
check(ar.data.length >= 2, `Advisor sees all students (${ar.data.length})`);
const aw = await advisor.from("course_records").insert({ student_key: "maya", code: "ENGL 20803", term: "Spring 2026", status: "completed", source: "registrar_sample" });
check(!!aw.error, "Advisor cannot write course records (read-only for records)");

console.log(failures ? `\n${failures} security check(s) failed` : "\nAll security checks passed");
process.exitCode = failures ? 1 : 0;

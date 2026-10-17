// Checks the database and Supabase API connections using .env.local (prints no secrets).
import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
// Validate before connecting so a malformed URL is never echoed in an error message
let parsed;
try {
  parsed = new URL(process.env.DATABASE_URL ?? "");
} catch {
  console.log("DATABASE_URL is not a valid URL. Remove any [ ] around the password and URL-encode special characters.");
  process.exit(1);
}
console.log("connecting to", parsed.host);
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  const [r] = await sql`select current_database() as db, version() as v`;
  const tables = await sql`select table_name from information_schema.tables where table_schema='public' order by 1`;
  console.log("postgres OK:", r.db, "|", r.v.split(",")[0], "| public tables:", tables.map((t) => t.table_name).join(", ") || "(none)");
} catch (e) {
  console.log("postgres FAILED:", e.code ?? "", String(e.message).replaceAll(process.env.DATABASE_URL, "[DATABASE_URL]"));
} finally {
  await sql.end();
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.listUsers({ perPage: 50 });
console.log(error ? `auth admin FAILED: ${error.message}` : `auth admin OK: ${data.users.length} users`);

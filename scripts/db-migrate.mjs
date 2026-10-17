// Applies supabase/migrations/*.sql in order: npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { databaseUrl, loadEnv } from "./env.mjs";

loadEnv();
const { url, host } = databaseUrl();
const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`;
  const done = new Set((await sql`select name from public._migrations`).map((r) => r.name));
  const dir = "supabase/migrations";
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) {
      console.log("skip", f);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
      await tx`insert into public._migrations (name) values (${f})`;
    });
    console.log("applied", f);
  }
  await sql`alter table public._migrations enable row level security`;
  console.log(`migrations up to date on ${host}`);
} catch (e) {
  console.error("migration failed:", e.code ?? "", String(e.message).replaceAll(url, "[DATABASE_URL]"));
  process.exitCode = 1;
} finally {
  await sql.end();
}

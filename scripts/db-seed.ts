// Creates demo accounts and loads sample student records into Supabase: npm run db:seed
// @ts-expect-error plain JS helper
import { loadEnv } from "./env.mjs";
import { createClient } from "@supabase/supabase-js";
import { seedDemo } from "../src/lib/seed";

loadEnv();
(async () => {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("Set DEMO_PASSWORD in .env.local");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (const line of await seedDemo(admin, password)) console.log(line);
  console.log("Demo data ready.");
})().catch((e) => {
  console.error("seed failed:", (e as Error).message);
  process.exitCode = 1;
});

// Advisor-only: restore the demo students to their starting records (before a recording or a judge's session).
import { handle, HttpError, json } from "@/lib/api";
import { dbEnabled, getViewer, supabaseAdmin } from "@/lib/db";
import { seedDemo } from "@/lib/seed";

export async function POST() {
  return handle(async () => {
    if (!dbEnabled()) throw new HttpError(503, "No database configured");
    const viewer = await getViewer();
    if (!viewer) throw new HttpError(401, "Sign in first");
    if (viewer.role !== "advisor") throw new HttpError(403, "Only advisors can reset the demo");
    if (!process.env.DEMO_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, "Demo settings missing on the server");
    const log = await seedDemo(supabaseAdmin(), process.env.DEMO_PASSWORD, false);
    return json({ ok: true, log });
  });
}

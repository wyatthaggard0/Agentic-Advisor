// Sign in / sign out. Demo buttons sign in with the server-side DEMO_PASSWORD so it never reaches the browser.
import { bad, handle, json } from "@/lib/api";
import { dbEnabled, supabaseServer } from "@/lib/db";
import { DEMO_USERS } from "@/lib/seed";

export async function POST(req: Request) {
  return handle(async () => {
    if (!dbEnabled()) return bad("Sign-in needs Supabase settings in .env.local", 503);
    const body = ((await req.json().catch(() => null)) ?? {}) as { action?: "demo" | "login" | "logout"; who?: string; email?: string; password?: string };
    const sb = await supabaseServer();
    if (body.action === "logout") {
      await sb.auth.signOut();
      return json({ ok: true });
    }
    let email = body.email?.trim().toLowerCase() ?? "";
    let password = body.password ?? "";
    if (body.action === "demo") {
      const u = DEMO_USERS.find((x) => x.key === body.who || (body.who === "advisor" && x.role === "advisor"));
      if (!u || !process.env.DEMO_PASSWORD) return bad("Unknown demo account");
      email = u.email;
      password = process.env.DEMO_PASSWORD;
    } else if (!/^[^@\s]+@[^@\s]+$/.test(email) || !password) {
      // A bare username like "jordan.kim" maps to the demo domain
      if (email && !email.includes("@") && password) email = `${email}@example.com`;
      else return bad("Enter your username and password");
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return bad("That username and password don't match a demo account.", 401);
    const { data } = await sb.auth.getUser();
    const { data: profile } = await sb.from("profiles").select("role").eq("user_id", data.user!.id).maybeSingle();
    return json({ ok: true, role: profile?.role ?? "student" });
  });
}

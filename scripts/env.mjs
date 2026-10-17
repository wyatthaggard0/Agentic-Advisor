// Loads .env.local into process.env for scripts (Next.js loads it automatically for the app).
import fs from "node:fs";

export function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

/** Validated DATABASE_URL; never echoes the URL (it contains the password). */
export function databaseUrl() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const u = new URL(raw);
    return { url: raw, host: u.host };
  } catch {
    throw new Error("DATABASE_URL is not a valid URL. Remove any [ ] around the password and URL-encode special characters.");
  }
}

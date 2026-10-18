// Imports the TCU Class Search pull into data/sections.json (replaces the invented sample sections).
//   npm run data:sections                      (reads tcu_class_search_2026-27.csv)
//   npx tsx scripts/import-class-search.ts <file.csv>
// Fall and spring terms are complete pulls: a course missing from one means it isn't offered that term.
// Winter Session rows are skipped (the planner plans fall, spring and summer terms only).

import fs from "node:fs";
import path from "node:path";
import type { Section, SectionsFile } from "../src/lib/engine/types";

const file = process.argv[2] ?? "tcu_class_search_2026-27.csv";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = head.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const TERM = /^(Spring|Summer|Fall) \d{4}$/;
const rows = parseCsv(fs.readFileSync(file, "utf8"));
const skipped: Record<string, number> = {};
const sections: Section[] = [];

for (const r of rows) {
  if (!TERM.test(r.term)) {
    skipped[r.term] = (skipped[r.term] ?? 0) + 1;
    continue;
  }
  const consent = r.status === "Dept" ? "Dept" : r.status === "Instr" ? "Instr" : null;
  const seatsOpen = Number(r.seats_open || 0);
  const attributes = [r.restricted_section, ...(r.core_attributes ? r.core_attributes.split(/\s+/).map((a) => `Core ${a}`) : [])].filter(Boolean);
  sections.push({
    term: r.term,
    code: r.course,
    classNumber: r.class_nbr,
    section: r.section,
    component: r.component || undefined,
    days: r.days ?? "",
    ...(r.start_time_24h ? { start: r.start_time_24h, end: r.end_time_24h } : {}),
    session: r.session === "REG" || !r.session ? "1" : r.session,
    // "Dept" / "Instr" in Class Search are permission-required sections; seats decide open vs. closed
    status: r.status === "Closed" || (consent && seatsOpen <= 0) ? "Closed" : "Open",
    seats: { capacity: Number(r.capacity || 0), enrolled: Number(r.enrolled || 0) },
    consent,
    ...(attributes.length ? { attributes } : {}),
    mode: r.mode === "Online Only" ? "Online" : "In Person",
  });
}

const terms = [...new Set(sections.map((s) => s.term))];
const pulledAt = rows.find((r) => r.pulled_at)?.pulled_at ?? "";
const out: SectionsFile = {
  meta: {
    source: `TCU Class Search, pulled ${pulledAt.slice(0, 10)}`,
    pulledAt,
    sample: false,
    terms: terms.map((term) => ({ term, coverage: "complete" as const })),
    note: "Complete pulls for these terms: a course with no section in one is not offered that term. Later terms are projected from the season a course was seen in.",
  },
  sections,
};
fs.writeFileSync(path.join("data", "sections.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`sections.json: ${sections.length} sections, ${new Set(sections.map((s) => s.code)).size} courses, terms ${terms.join(", ")}`);
for (const [t, n] of Object.entries(skipped)) console.log(`  skipped ${n} rows for ${t}`);

// Builds a provisional data/courses.json from the registrar course export CSV.
// Usage: npm run data:courses -- [path/to/courses-report.csv]
// The team's hand-checked courses.json can replace this output at any time; the app reads whatever is in /data.

import fs from "node:fs";
import path from "node:path";
import { courseFromRow } from "../src/lib/engine/prereqParse";
import type { CoursesFile } from "../src/lib/engine/types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
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
  return rows;
}

const input = process.argv[2] ?? fs.readdirSync(".").find((f) => /^courses-report.*\.csv$/.test(f));
if (!input) throw new Error("No courses-report*.csv found; pass the path as an argument.");
const text = fs.readFileSync(input, "utf8").replace(/^﻿/, "");
const [header, ...rows] = parseCsv(text).filter((r) => r.length >= 3);
const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
const iSub = col("subject code");
const iNum = col("catalog number");
const iDesc = col("description");
const source = `Registrar course export (${path.basename(input)})`;

const seen = new Set<string>();
const courses = [];
for (const r of rows) {
  const subject = r[iSub].trim();
  const number = r[iNum].trim();
  if (!/^[A-Z]{3,4}$/.test(subject) || !/^\d{5}$/.test(number)) continue;
  const code = `${subject} ${number}`;
  if (seen.has(code)) continue;
  seen.add(code);
  courses.push(courseFromRow(subject, number, r[iDesc] ?? "", source));
}

const out: CoursesFile = {
  meta: {
    source,
    generatedAt: new Date().toISOString(),
    note: "Auto-parsed from course descriptions. prereq_overrides.json takes precedence. Courses marked parseConfidence 'low' need a human check.",
  },
  courses,
};
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/courses.json", JSON.stringify(out, null, 1));
const low = courses.filter((c) => c.parseConfidence === "low").length;
const withPre = courses.filter((c) => c.prereqs.length).length;
console.log(`Wrote data/courses.json: ${courses.length} courses, ${withPre} with course prerequisites, ${low} flagged low-confidence.`);

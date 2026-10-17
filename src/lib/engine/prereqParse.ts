// Turns the prerequisite sentences in TCU course descriptions into structured data.
// Rules that matter (from the team's verification notes):
//  - "A, or B, or C and D" means A OR B OR (C AND D)
//  - "or concurrent enrollment in X" is not a corequisite: X may be taken before or in the same term
//  - minimum grades are kept exactly ("C-" is not "C")
//  - "or permission/consent of instructor" is an alternate path, not an extra gate
// Anything the parser is unsure about is marked parseConfidence "low" so prereq_overrides.json can fix it.

import type { Condition, Course, PrereqRef } from "./types";

const COURSE_RE = /\b([A-Z]{3,4})\s?(\d{5})\b|\b(\d{5})\b/g;
const PREREQ_HINT = /prereq|standing|must|major|minor|permission|consent|admi|grade|concurrent|enrollment|approval|completion|credit for|\b[A-Z]{3,4}\s?\d{5}\b/i;
const NON_PREREQ_START = /^(students may not|this course|the course|an? (introduction|overview|study|survey)|topics|designed|emphasis|focus)/i;

type Expr = { op: "and" | "or"; items: Expr[] } | { code: number };

export interface ParsedPrereqs {
  prereqs: PrereqRef[][];
  coreqs: string[];
  conditions: Condition[];
  permissionAlt: boolean;
  exclusions: string[];
  prereqText?: string;
  confidence: "high" | "low";
}

function sentences(text: string): string[] {
  // Split on ". " followed by a capital letter, without splitting "C-." style grades or course codes.
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pull the prerequisite clause out of a description. */
function extractClause(desc: string): { clause: string; labeled: boolean } | null {
  const text = desc.replace(/\s+/g, " ").trim();
  const m = /Pre-?requisites?\s*:?\s*/i.exec(text);
  let rest: string;
  let labeled = true;
  if (m) {
    rest = text.slice(m.index + m[0].length);
  } else if (/^[A-Z]{3,4}\s?\d{5}\b/.test(text)) {
    // e.g. "INSC 20263 with a grade of C or better. This course introduces..."
    rest = text;
    labeled = false;
  } else {
    return null;
  }
  const parts = sentences(rest);
  const kept: string[] = [];
  for (const s of parts) {
    if (kept.length > 0 && (NON_PREREQ_START.test(s) || !PREREQ_HINT.test(s))) break;
    if (/^co-?requisites?/i.test(s)) break;
    kept.push(s);
    if (kept.length >= 3) break;
  }
  const clause = kept.join(" ").replace(/^\d+(\.\d+)? (credit )?hours?\.?\s*/i, "");
  return clause ? { clause, labeled } : null;
}

function normGrade(g: string): string {
  return g.replace(/['"]/g, "").toUpperCase();
}

export function parseCourseText(subject: string, number: string, description: string): ParsedPrereqs {
  const out: ParsedPrereqs = { prereqs: [], coreqs: [], conditions: [], permissionAlt: false, exclusions: [], confidence: "high" };
  const desc = description || "";

  // Exclusions: "may not receive credit for both X and Y"
  const ex = /not (?:receive|earn) credit for both ([A-Z]{3,4}\s?\d{5}) and ([A-Z]{3,4}\s?\d{5})/i.exec(desc);
  if (ex) {
    const self = `${subject} ${number}`;
    for (const c of [ex[1], ex[2]]) {
      const code = c.replace(/^([A-Z]{3,4})\s?(\d{5})$/, "$1 $2");
      if (code !== self) out.exclusions.push(code);
    }
  }

  // Corequisites
  const co = /Co-?requisites?\s*:?\s*([^.]*)/i.exec(desc);
  if (co) {
    let subj = subject;
    for (const m of co[1].matchAll(COURSE_RE)) {
      if (m[1]) subj = m[1];
      out.coreqs.push(`${m[1] ?? subj} ${m[2] ?? m[3]}`);
    }
  }

  const found = extractClause(desc);
  if (!found) return out;
  out.prereqText = found.clause;
  if (!found.labeled) out.confidence = "low";
  // Some courses list different prerequisites per audience ("... for Business Majors. ... for Economics Majors.").
  // Neeley students follow the business-major sentence.
  let clause = found.clause;
  const audience = sentences(clause).filter((s) => /\bfor [A-Za-z ,]+ (majors?|minors?)\.?$/i.test(s));
  if (audience.length > 1) {
    clause = audience.find((s) => /for business majors?/i.test(s)) ?? audience[0];
  }
  clause = clause
    .replace(/\([^)]*\)/g, " ") // parenthetical asides
    .replace(/credit for,?\s*or\s+(concurrent)/gi, "$1")
    .replace(/\beither\s+/gi, "");
  // Placement or exam scores are an alternate path around the course prerequisites
  if (/\bor (a )?(passing )?score\b|placement (test|exam)/i.test(clause)) out.permissionAlt = true;

  // ---- Non-course conditions ----
  const lc = clause.toLowerCase();
  const standing = /(freshman|sophomore|junior|senior)(?: or (?:junior|senior))? standing/.exec(lc);
  if (standing) out.conditions.push({ kind: "standing", value: standing[1], text: standing[0] });
  // "declared Business major" / admitted to Neeley means advanced into a major; plain "business major" includes pre-business students
  if (/declared (a )?business major|admitted to (the )?neeley|admission to (the )?neeley|advanced into/.test(lc)) {
    out.conditions.push({ kind: "major", value: "business-declared", text: "Declared business major (advanced into a Neeley major)" });
  } else if (/business major/.test(lc)) {
    out.conditions.push({ kind: "major", value: "business", text: "Business student (pre-business counts)" });
  } else {
    const maj = /must be (?:a |an )?(?:declared )?([a-z ,&]+?) (major|minor)/.exec(lc);
    if (maj) out.conditions.push({ kind: "major", value: maj[1].trim(), text: maj[0] });
  }
  if (/neeley fellows/.test(lc)) out.conditions.push({ kind: "program", value: "neeley-fellows", text: "Neeley Fellows program" });
  if (/\btip\b/i.test(clause)) out.conditions.push({ kind: "program", value: "tip", text: "TIP Board program" });
  if (/certificate in|fintech certificate class/.test(lc)) out.conditions.push({ kind: "program", value: "certificate", text: "Certificate program enrollment" });
  if (/mos test|excel portion/.test(lc)) out.conditions.push({ kind: "test", value: "mos-excel", text: "Excel portion of the MOS test" });
  // Permission: alternate path when introduced by "or", otherwise a gate
  if (/\bor (?:by )?(?:the )?(?:permission|consent|approval)\b/.test(lc) || /\bor (?:departmental|department) (?:permission|approval)/.test(lc)) {
    out.permissionAlt = true;
  } else if (/(permission|consent|approval)/.test(lc)) {
    out.conditions.push({ kind: "permission", value: /instructor/.test(lc) ? "instructor" : "department", text: "Permission required" });
  }
  if (/varies|vary according/.test(lc)) out.confidence = "low";

  // ---- Course mentions ----
  const mentions: { code: string; start: number; end: number }[] = [];
  let subj = subject;
  for (const m of clause.matchAll(COURSE_RE)) {
    if (m[1]) subj = m[1];
    const num = m[2] ?? m[3];
    if (!m[1] && !/^[1-6]/.test(num)) continue;
    mentions.push({ code: `${m[1] ?? subj} ${num}`, start: m.index!, end: m.index! + m[0].length });
  }
  if (mentions.length === 0) return out;

  // Grades: "X with a grade of at least C-", "C or better in X", "grade of 'C' or better"
  const grades = new Map<number, string>();
  const gradeAfter = /(?:with )?(?:a )?(?:minimum )?(?:grade of )?(?:at least |minimum )(?:an? )?['"]?([ABCD][+-]?)['"]?(?![a-z])|['"]?\b([ABCD][+-]?)['"]? (?:or (?:better|higher|above))/g;
  const eachCourse = /in each|all with a grade|each course/i.test(clause);
  for (const g of clause.matchAll(gradeAfter)) {
    const grade = normGrade(g[1] ?? g[2]);
    const pos = g.index!;
    if (eachCourse) {
      mentions.forEach((_, i) => grades.set(i, grade));
      continue;
    }
    // Grade phrase that precedes "in COURSE" applies to the following course
    const after = clause.slice(pos + g[0].length, pos + g[0].length + 40);
    if (/^\s*(?:or concurrent(?:ly)? enroll\w*\s+)?in\b/i.test(after)) {
      const nxt = mentions.findIndex((mm) => mm.start > pos);
      if (nxt >= 0) grades.set(nxt, grade);
      continue;
    }
    // Otherwise apply to preceding courses back to the last separator that is not "and"/"or" between plain courses
    let i = mentions.length - 1;
    while (i >= 0 && mentions[i].start > pos) i--;
    if (i < 0) continue;
    grades.set(i, grade);
    // "A and B with a grade of at least C-" -> both
    while (i > 0) {
      const between = clause.slice(mentions[i - 1].end, mentions[i].start);
      if (/^\s*(,|and|,\s*and)\s*$/i.test(between) && !grades.has(i - 1)) {
        grades.set(i - 1, grade);
        i--;
      } else break;
    }
  }

  // Concurrent-ok: "or concurrent enrollment in X", "credit for, or concurrent enrollment in X", "Concurrent enrollment in X"
  const concurrent = new Set<number>();
  for (const c of clause.matchAll(/concurrent(?:ly)? (?:enrollment|enrolled)(?: in)?/gi)) {
    const nxt = mentions.findIndex((mm) => mm.start > c.index!);
    const prev = [...mentions].reverse().findIndex((mm) => mm.end <= c.index!);
    // "X or concurrent enrollment" (course before) vs "concurrent enrollment in X" (course after)
    const followText = clause.slice(c.index!, c.index! + c[0].length + 2);
    if (/in\s*$/i.test(followText) || /in$/i.test(c[0])) {
      if (nxt >= 0) concurrent.add(nxt);
    } else if (prev >= 0) {
      concurrent.add(mentions.length - 1 - prev);
    } else if (nxt >= 0) concurrent.add(nxt);
  }
  if (/credit for, or concurrent/i.test(clause)) {
    // already handled via "in" lookahead
  }

  // ---- Structure ----
  // Separators between consecutive course mentions, reduced to connector words.
  const seps: string[] = [];
  for (let i = 1; i < mentions.length; i++) {
    // Grade and concurrency phrases are not list connectors
    const raw = clause
      .slice(mentions[i - 1].end, mentions[i].start)
      .toLowerCase()
      .replace(/(?:with )?(?:a )?(?:minimum )?(?:grade of )?(?:at least |minimum )(?:an? )?['"]?[abcd][+-]?['"]?/g, " ")
      .replace(/(?:with )?(?:a )?(?:grade of )?['"]?\b[abcd][+-]?['"]? or (?:better|higher|above)/g, " ")
      .replace(/\bor concurrent(?:ly)? enroll\w*(?: in)?|concurrent(?:ly)? enroll\w*(?: in)?/g, " ");
    let s = "";
    if (/;/.test(raw)) s = ";";
    else {
      const comma = /,/.test(raw);
      const or = /\bor\b/.test(raw);
      const and = /\band\b/.test(raw);
      s = (comma ? "," : "") + (or ? "or" : and ? "and" : "");
      if (!s) s = "and";
      // long gaps with prose usually mean a new clause joined by "and"
      if (raw.length > 60 && !or) s = ",and";
    }
    // "X with a C or better or concurrent enrollment in X": two options for the same course
    if (mentions[i].code === mentions[i - 1].code) s = "or";
    seps.push(s);
  }
  if (seps.some((s) => s.length > 0 && !/^(;|,?(and|or)?)$/.test(s))) out.confidence = "low";

  const leaf = (i: number): Expr => ({ code: i });
  // Build expression over index ranges using precedence: ";" (and) > ", or" (or) > comma-list (by last connector) > "or" > "and"
  function build(idx: number[], sepIdx: (string | undefined)[]): Expr {
    if (idx.length === 1) return leaf(idx[0]);
    const splitOn = (pred: (s: string) => boolean, op: "and" | "or"): Expr | null => {
      if (!sepIdx.some((s) => s !== undefined && pred(s))) return null;
      const groups: number[][] = [[idx[0]]];
      const gseps: (string | undefined)[][] = [[]];
      for (let k = 1; k < idx.length; k++) {
        const s = sepIdx[k - 1]!;
        if (pred(s)) {
          groups.push([idx[k]]);
          gseps.push([]);
        } else {
          groups[groups.length - 1].push(idx[k]);
          gseps[gseps.length - 1].push(s);
        }
      }
      return { op, items: groups.map((g, gi) => build(g, gseps[gi])) };
    };
    const hasCommaOr = sepIdx.includes(",or");
    const hasCommaAnd = sepIdx.includes(",and");
    return (
      splitOn((s) => s === ";", "and") ??
      // "X, or Y, or Z and W, M, and N": the ", or" chain is one item of a larger AND list
      (hasCommaOr && hasCommaAnd ? splitOn((s) => s === "," || s === ",and", "and") : null) ??
      (hasCommaOr ? splitOn((s) => s === ",or" || s === ",", "or") : null) ??
      (() => {
        const commas = sepIdx.filter((s) => s!.startsWith(","));
        if (commas.length === 0) return null;
        const lastConn = [...commas].reverse().find((s) => s!.length > 1) ?? ",and";
        const op: "and" | "or" = lastConn.endsWith("or") ? "or" : "and";
        return splitOn((s) => s.startsWith(","), op);
      })() ??
      // Without commas, "A or B and C" reads as (A or B) and C in catalog prose
      splitOn((s) => s === "and", "and") ??
      splitOn(() => true, "or")!
    );
  }
  const expr = build(mentions.map((_, i) => i), seps);

  // CNF conversion: AND of OR-groups
  function cnf(e: Expr): number[][] {
    if ("code" in e) return [[e.code]];
    if (e.op === "and") return e.items.flatMap(cnf);
    let acc: number[][] = [[]];
    for (const item of e.items) {
      const c = cnf(item);
      const next: number[][] = [];
      for (const a of acc) for (const b of c) next.push([...new Set([...a, ...b])]);
      acc = next.slice(0, 64);
    }
    return acc;
  }
  const groups = cnf(expr);
  const self = `${subject} ${number}`;
  out.prereqs = groups
    .map((g) => {
      // The same course can appear twice ("X with a C or better or concurrent enrollment in X"): merge the options.
      const byCode = new Map<string, PrereqRef>();
      for (const i of g) {
        const code = mentions[i].code;
        if (code === self || out.exclusions.includes(code)) continue;
        const prev = byCode.get(code) ?? { code };
        if (grades.has(i)) prev.minGrade = grades.get(i);
        if (concurrent.has(i)) prev.concurrentOk = true;
        byCode.set(code, prev);
      }
      return [...byCode.values()];
    })
    .filter((g) => g.length > 0);
  // Identical groups can appear after CNF expansion
  const seenGroups = new Set<string>();
  out.prereqs = out.prereqs.filter((g) => {
    const key = g.map((r) => r.code).sort().join("|");
    if (seenGroups.has(key)) return false;
    seenGroups.add(key);
    return true;
  });
  return out;
}

export function courseFromRow(subject: string, number: string, description: string, source: string): Course {
  const parsed = parseCourseText(subject, number, description);
  const last = Number(number.slice(-1));
  return {
    code: `${subject} ${number}`,
    subject,
    number,
    credits: last === 0 ? null : last,
    level: Number(number[0]),
    description: description.replace(/\s+/g, " ").trim(),
    prereqs: parsed.prereqs,
    coreqs: parsed.coreqs,
    conditions: parsed.conditions,
    ...(parsed.permissionAlt ? { permissionAlt: true } : {}),
    ...(parsed.exclusions.length ? { exclusions: parsed.exclusions } : {}),
    ...(parsed.prereqText ? { prereqText: parsed.prereqText } : {}),
    parseConfidence: parsed.confidence,
    source,
  };
}

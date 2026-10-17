// Builds the downloadable Graduation Blueprint in the layout of Neeley's BBA degree-plan worksheet
// ("Example Download Excel Sheet.xlsx"): header block, three column groups with Enrolled / Completed / Needed
// hours, a summary column, and the checklist column. Extra sheets carry the semester plan and advisor items.

import ExcelJS from "exceljs";
import type { Dataset } from "../engine/load";
import { courseTitle } from "../engine/load";
import { pickCohort } from "../engine/planner";
import type { Plan, PlanLine, Student } from "../engine/types";

type Cell = ExcelJS.Cell;
type Status = { kind: "completed" | "enrolled" | "planned" | "shared" | "missing"; credits: number; label: string; flag?: boolean };

const PURPLE = "FF7030A0";
const GRAY = "FFD9D9D9";
const GRAY2 = "FFD0CECE";
const LAVENDER = "FFCCCCFF";
const CORE_HDR = "FF99CC00";
const ELECT_HDR = "FFB4C6E7";
const YELLOW = "FFFFFF00";
const CHECK_FILL = "FFE7E6E6";
const NEEDED_COLOR = "FF548235";
const thin: Partial<ExcelJS.Border> = { style: "thin" };
const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

/** "Fall 2027" -> "FA27" */
const termShort = (t: string) => {
  const [s, y] = t.split(" ");
  return `${s === "Fall" ? "FA" : s === "Spring" ? "SP" : "SU"}${y.slice(2)}`;
};

interface Group {
  label: string; // course column
  enrolled: string;
  completed: string;
  needed: string;
  cat?: string; // category code column (core group only)
  hours?: string; // section hours column (core group only)
}

const G1: Group = { cat: "D", label: "E", enrolled: "F", completed: "G", needed: "H", hours: "C" };
const G2: Group = { label: "K", enrolled: "L", completed: "M", needed: "N" };
const G3: Group = { label: "P", enrolled: "Q", completed: "R", needed: "S" };

interface Row {
  cat?: string;
  status: Status;
  bold?: boolean;
}
interface Section {
  title: string;
  fill: string;
  hours?: number;
  rows: Row[];
}

export async function buildDegreePlanWorkbook(ds: Dataset, student: Student, plan: Plan, advisorName = ""): Promise<Buffer> {
  const P = ds.programs;
  const cohort = pickCohort(ds, student);
  const credit = (code: string) => ds.courses.get(code)?.credits ?? 3;

  // ---------- Where every course stands ----------
  const completed = new Map(student.completed.filter((c) => c.grade !== "F" && c.grade !== "W").map((c) => [c.code, c]));
  const enrolled = new Map(student.inProgress.map((c) => [c.code, c]));
  const plannedLines = new Map<string, { line: PlanLine; term: string }>();
  for (const t of plan.terms) if (t.status !== "in-progress") for (const l of t.lines) if (!l.slot) plannedLines.set(l.code, { line: l, term: t.term });
  const used = new Set<string>(); // courses already shown with hours

  const courseStatus = (code: string): Status => {
    const label = code;
    if (used.has(code)) return { kind: "shared", credits: credit(code), label: `${code} (counted elsewhere)` };
    used.add(code);
    if (completed.has(code)) {
      const c = completed.get(code)!;
      return { kind: "completed", credits: c.credits ?? credit(code), label: c.transfer ? `${label} - TR` : label, flag: !!(c.transfer && !c.transfer.verified) };
    }
    if (enrolled.has(code)) return { kind: "enrolled", credits: enrolled.get(code)!.credits ?? credit(code), label };
    const p = plannedLines.get(code);
    if (p) {
      return {
        kind: "planned",
        credits: p.line.credits,
        label: `${label} - ${termShort(p.term)}${p.line.added === "swap" ? " (swap)" : p.line.added === "prereq" ? " (prereq)" : p.line.added === "coreq" ? " (coreq)" : ""}`,
        flag: p.line.confidence === "advisor",
      };
    }
    return { kind: "missing", credits: credit(code), label: `${label} - not scheduled` };
  };

  // Slot lines (Core categories, electives, undeclared major) in plan order
  const slotLines = plan.terms.filter((t) => t.status !== "in-progress").flatMap((t) => t.lines.filter((l) => l.slot).map((l) => ({ l, term: t.term })));
  const takeSlots = (reqId: string) => {
    const out = slotLines.filter((s) => s.l.requirementId === reqId);
    for (const s of out) slotLines.splice(slotLines.indexOf(s), 1);
    return out;
  };
  const slotRows = (reqId: string, cat: string): Row[] => {
    const req = P.requirements[reqId];
    if (!req) return [];
    const rows: Row[] = [];
    // satisfied by courses tagged to the category on the transcript
    for (const c of [...student.completed, ...student.inProgress].filter((x) => x.countsToward === reqId)) {
      rows.push({ cat, status: courseStatus(c.code) });
    }
    let fromAudit = student.satisfiedSlots?.[reqId] ?? 0;
    while (fromAudit > 0) {
      const h = Math.min(3, fromAudit);
      rows.push({ cat, status: { kind: "completed", credits: h, label: "Completed (degree audit)" } });
      fromAudit -= h;
    }
    for (const s of takeSlots(reqId)) rows.push({ cat, status: { kind: "planned", credits: s.l.credits, label: `Choose course - ${termShort(s.term)}` } });
    return rows;
  };
  const reqRows = (reqId: string, exclude: string[] = []): Row[] => {
    const req = P.requirements[reqId];
    if (!req) return [];
    if (req.type === "all") return (req.courses ?? []).filter((c) => !exclude.includes(c)).map((c) => ({ status: courseStatus(c), bold: true }));
    if (req.type === "choose") {
      const chosen = (req.courses ?? []).filter(
        (c) => completed.has(c) || enrolled.has(c) || [...plannedLines.values()].some((p) => p.line.code === c && p.line.requirement.includes(req.name)),
      );
      // swaps carry the original requirement name
      for (const [code, p] of plannedLines) if (p.line.added === "swap" && p.line.requirement.includes(req.name) && !chosen.includes(code)) chosen.push(code);
      return chosen.map((c) => ({ status: courseStatus(c), bold: true }));
    }
    return slotRows(reqId, "");
  };

  // ---------- Group 1: TCU Core ----------
  const g1: Section[] = [
    {
      title: "Essential Competencies",
      fill: CORE_HDR,
      rows: [
        { cat: "WCO", status: courseStatus("ENGL 10803"), bold: true },
        ...slotRows("core-wco2", "WCO"),
        ...reqRows("bcore-math").map((r) => ({ ...r, cat: "MTH" })),
        ...slotRows("core-oral", "OCO"),
      ],
    },
    {
      title: "Human Experiences and Endeavors",
      fill: CORE_HDR,
      rows: [
        ...slotRows("core-humanities", "HUM"),
        { cat: "SSC", status: courseStatus("ECON 10223") },
        ...slotRows("core-social", "SSC"),
        ...slotRows("core-natsci", "NSC"),
        ...slotRows("core-fine-arts", "FAR"),
      ],
    },
    {
      title: "Heritage, Mission, Vision & Values",
      fill: CORE_HDR,
      rows: [
        ...slotRows("core-religious", "RT"),
        ...slotRows("core-historical", "HT"),
        ...slotRows("core-literary", "LT"),
        // Modeled as overlapping with other courses (catalog allows overlap); the advisor confirms
        { cat: "CA***", status: { kind: "shared", credits: 3, label: "Overlap - confirm" } },
        { cat: "GA***", status: { kind: "shared", credits: 3, label: "Overlap - confirm" } },
        { cat: "CSV***", status: { kind: "shared", credits: 3, label: "Overlap - confirm" } },
      ],
    },
  ];
  for (const s of g1) s.hours = s.rows.filter((r) => r.status.kind !== "shared").reduce((n, r) => n + r.status.credits, 0);

  // ---------- Group 2: lower division, business core, majors ----------
  const bcoreUpper = P.requirements["bcore-upper"]?.courses ?? [];
  const lowerCore = bcoreUpper.filter((c) => (ds.courses.get(c)?.level ?? 3) < 3);
  const g2: Section[] = [
    {
      title: "LDR - Lower Division Requirements",
      fill: LAVENDER,
      rows: [...reqRows("bcore-lower", ["ENGL 10803", "ECON 10223"]), ...lowerCore.map((c) => ({ status: courseStatus(c), bold: true }))],
    },
    { title: "Upper Division B-Core", fill: LAVENDER, rows: reqRows("bcore-upper", lowerCore) },
  ];
  const g3: Section[] = [];
  for (const pid of plan.programs) {
    const prog = P.programs[pid];
    if (!prog) continue;
    const rows = prog.requirements.flatMap((r) => reqRows(r));
    const section = { title: prog.kind === "major" ? `MAJOR - ${prog.name.replace(" (BBA)", "")}` : prog.name, fill: LAVENDER, rows };
    if (prog.kind === "major") g2.push(section);
    else g3.push({ ...section, fill: ELECT_HDR });
  }

  // ---------- Group 3: electives, extras ----------
  const extras: Row[] = [];
  for (const code of [...completed.keys(), ...enrolled.keys(), ...plannedLines.keys()]) if (!used.has(code)) extras.push({ status: courseStatus(code) });
  for (const s of [...slotLines]) {
    extras.push({ status: { kind: "planned", credits: s.l.credits, label: `${s.l.upper ? "Upper elective" : "Elective"} - ${termShort(s.term)}` } });
  }
  slotLines.length = 0;
  g3.unshift({ title: "Free Electives & Prerequisites", fill: ELECT_HDR, rows: extras });

  // ---------- Workbook ----------
  const wb = new ExcelJS.Workbook();
  wb.creator = "Graduation Blueprint prototype";
  wb.calcProperties.fullCalcOnLoad = true;
  const today = new Date();
  const ws = wb.addWorksheet(`${today.getMonth() + 1}.${today.getDate()}.${today.getFullYear()}`, {
    pageSetup: { orientation: "landscape", margins: { left: 0.45, right: 0.2, top: 0.5, bottom: 0.25, header: 0.3, footer: 0.3 } },
  });
  const widths: Record<string, number> = { A: 11.8, B: 1.3, C: 3.5, D: 7.2, E: 19.8, F: 3.7, G: 3.8, H: 3.8, I: 2.5, J: 2.2, K: 19.8, L: 3.8, M: 3.8, N: 3.7, O: 3.5, P: 19.8, Q: 3.8, R: 3.8, S: 3.8, T: 2, U: 40 };
  for (const [col, w] of Object.entries(widths)) ws.getColumn(col).width = w;
  const font = (size = 9, bold = false, color?: string, name = "Calibri"): Partial<ExcelJS.Font> => ({ name, size, bold, ...(color ? { color: { argb: color } } : {}) });
  const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const set = (addr: string, value: ExcelJS.CellValue, style: Partial<Pick<Cell, "font" | "fill" | "alignment" | "border" | "numFmt">> = {}) => {
    const c = ws.getCell(addr);
    c.value = value;
    Object.assign(c, style);
    return c;
  };

  // Header block (rows 1-7)
  // Short codes like the template's "ACCT/BIS"
  const short: Record<string, string> = { "BBA-FINA": "FINA", "BBA-BIS": "BIS", "CERT-FINTECH": "FinTech Cert", "BBA-UNDECIDED": "Pre-business" };
  const programNames = plan.programs.map((p) => short[p] ?? p.replace(/^(BBA|CERT|MIN)-/, "")).join("/");
  for (const [r, text, size, color] of [
    [1, "NEELEY SCHOOL OF BUSINESS", 11, undefined],
    [2, `BBA DEGREE PLAN (${cohort.totalHours} HOURS MINIMUM REQUIRED FOR BBA DEGREE)`, 11, undefined],
    [3, "<<<THE STUDENT IS RESPONSIBLE FOR UNDERSTANDING AND FULFILLING DEGREE REQUIREMENTS>>>", 10, PURPLE],
  ] as const) {
    ws.mergeCells(`A${r}:S${r}`);
    set(`A${r}`, text, { font: font(size, true, color), alignment: { horizontal: "center" } });
  }
  ws.mergeCells("A5:C5");
  set("A5", "STUDENT NAME:", { font: font(10, true), fill: fill(GRAY), alignment: { horizontal: "left" } });
  set("D5", student.name, { font: font(11, true), border: { bottom: thin } });
  set("G5", "MAJOR:", { font: font(10, true), fill: fill(GRAY2) });
  set("K5", programNames, { font: font(11, true, PURPLE), alignment: { horizontal: "left" }, border: { bottom: thin } });
  set("M5", "ADVISOR:", { font: font(10, true), fill: fill(GRAY2), border: { top: thin, bottom: thin } });
  set("P5", advisorName, { font: font(10, false, undefined, "Arial"), border: { bottom: thin } });
  set("A6", "STUDENT ID#:", { font: font(10, true), fill: fill(GRAY) });
  ws.mergeCells("B6:F6");
  set("B6", "", { font: font(11), border: { bottom: thin } });
  set("M6", "DATE:", { font: font(10, true), fill: fill(GRAY2) });
  set("P6", today, { font: font(10, false, undefined, "Arial"), numFmt: "mm-dd-yy", alignment: { horizontal: "left" }, border: { top: thin, bottom: thin } });
  set("A7", "Email address:", { font: font(10, true), fill: fill(GRAY), border: { bottom: thin } });
  ws.mergeCells("N7:P7");
  set("N7", "", { font: font(10, true), border: { top: thin, bottom: thin } });

  // Group headers (rows 9-10)
  set("D9", "TCU CORE REQUIREMENTS:", { font: font(11, true), border: { left: thin, top: thin, bottom: thin } });
  set("K9", "LDR/Bcore/Major:", { font: font(11, true), border: box });
  set("P9", "Electives and Minor:", { font: font(11, true), border: box });
  ws.getRow(10).height = 82;
  set("E10", "GPA: see audit", { font: font(11, true) });
  for (const g of [G1, G2, G3]) {
    set(`${g.enrolled}10`, "Enrolled Hrs", { font: font(9, true, "FFFF0000", "Arial"), alignment: { textRotation: 90 } });
    set(`${g.completed}10`, "Hrs Completed", { font: font(9, true), fill: fill(GRAY), alignment: { textRotation: 90 }, border: { bottom: thin } });
    set(`${g.needed}10`, "Hrs Needed", { font: font(9, true, NEEDED_COLOR), alignment: { horizontal: "center", textRotation: 90 }, border: { bottom: thin } });
  }

  // Sections
  const totals = { enrolled: [] as string[], completed: [] as string[], needed: [] as string[] };
  const writeGroup = (g: Group, sections: Section[], startRow: number) => {
    let r = startRow;
    for (const sec of sections) {
      ws.getRow(r).height = 15;
      if (g.hours && sec.hours) set(`${g.hours}${r}`, sec.hours, { font: font(9), border: { left: thin } });
      const titleCol = g.cat ?? g.label;
      set(`${titleCol}${r}`, sec.title, { font: font(9, true), fill: fill(sec.fill), alignment: { vertical: "middle" } });
      if (g.cat) ws.getCell(`${g.label}${r}`).fill = fill(sec.fill);
      const first = r + 1;
      r++;
      for (const row of sec.rows) {
        ws.getRow(r).height = 15;
        const st = row.status;
        const needy = st.kind === "planned" || st.kind === "missing";
        if (g.cat && row.cat) set(`${g.cat}${r}`, row.cat, { font: font(9, row.cat.endsWith("***")) });
        const label = set(`${g.label}${r}`, st.label + (st.flag ? " *advisor" : ""), {
          font: font(9, !!row.bold),
          border: { top: thin, bottom: thin },
          ...(needy ? { fill: fill(YELLOW) } : {}),
        });
        if (st.flag) label.note = "Needs advisor confirmation (see the Advisor Items sheet).";
        const hoursStyle = { font: font(9), alignment: { horizontal: "center" as const }, border: box, numFmt: "General" };
        if (st.kind === "enrolled") set(`${g.enrolled}${r}`, st.credits, { ...hoursStyle, font: font(9, true) });
        else ws.getCell(`${g.enrolled}${r}`).border = box;
        if (st.kind === "completed") set(`${g.completed}${r}`, st.credits, hoursStyle);
        else if (st.kind === "shared") set(`${g.completed}${r}`, "X", hoursStyle);
        else ws.getCell(`${g.completed}${r}`).border = box;
        // Needed: the course's hours unless completed or counted elsewhere (template convention: enrolled hours stay "needed")
        const comp = `${g.completed}${r}`;
        const result = st.kind === "completed" || st.kind === "shared" ? 0 : st.credits;
        set(`${g.needed}${r}`, { formula: `IF(OR(ISNUMBER(${comp}),${comp}="X"),0,${st.credits})`, result }, {
          ...hoursStyle,
          font: font(9, false, NEEDED_COLOR),
          ...(needy ? { fill: fill(YELLOW) } : {}),
        });
        r++;
      }
      const last = r - 1;
      set(`${g.label}${r}`, "TOTAL", { font: font(9, true) });
      const sum = (col: string, kinds: Status["kind"][], field: "credits" | "needed") => {
        const val = sec.rows.reduce((n, x) => n + (field === "needed" ? (x.status.kind === "completed" || x.status.kind === "shared" ? 0 : x.status.credits) : kinds.includes(x.status.kind) ? x.status.credits : 0), 0);
        return { formula: last >= first ? `SUM(${col}${first}:${col}${last})` : "0", result: val };
      };
      set(`${g.enrolled}${r}`, sum(g.enrolled, ["enrolled"], "credits"), { font: font(9, true), alignment: { horizontal: "center" } });
      set(`${g.completed}${r}`, sum(g.completed, ["completed"], "credits"), { font: font(9, true), alignment: { horizontal: "center" } });
      set(`${g.needed}${r}`, sum(g.needed, [], "needed"), { font: font(9, true), alignment: { horizontal: "center" } });
      totals.enrolled.push(`${g.enrolled}${r}`);
      totals.completed.push(`${g.completed}${r}`);
      totals.needed.push(`${g.needed}${r}`);
      r += 2;
    }
    return r;
  };
  const end1 = writeGroup(G1, g1, 11);
  const end2 = writeGroup(G2, g2, 11);
  const end3 = writeGroup(G3, g3, 11);

  // Summary column A (same rows as the template)
  const allRows = [...g1, ...g2, ...g3].flatMap((s) => s.rows);
  const enrolledHours = allRows.filter((x) => x.status.kind === "enrolled").reduce((n, x) => n + x.status.credits, 0);
  const neededHours = allRows.reduce((n, x) => n + (x.status.kind === "completed" || x.status.kind === "shared" ? 0 : x.status.credits), 0);
  // Audit credit not tied to a listed requirement (e.g. AP or general transfer) is added to the completed total
  const unlisted = Math.max(0, (student.otherHours?.hours ?? 0) - Object.values(student.satisfiedSlots ?? {}).reduce((a, b) => a + b, 0));
  set("A18", { formula: `SUM(${totals.completed.join(",")})${unlisted ? `+${unlisted}` : ""}`, result: allRows.filter((x) => x.status.kind === "completed").reduce((n, x) => n + x.status.credits, 0) + unlisted }, { font: font(11), alignment: { horizontal: "center" } });
  set("A19", "Hrs Completed", { font: font(10, true) });
  set("A22", { formula: `SUM(${totals.enrolled.join(",")})`, result: enrolledHours }, { font: font(11), alignment: { horizontal: "center" } });
  set("A23", "Hrs in Progress", { font: font(10, true) });
  set("A26", { formula: `SUM(${totals.needed.join(",")})-A22`, result: neededHours - enrolledHours }, { font: font(11), alignment: { horizontal: "center" } });
  set("A27", "Hrs to Complete", { font: font(10, true) });
  const totalResult = allRows.filter((x) => x.status.kind === "completed").reduce((n, x) => n + x.status.credits, 0) + unlisted + neededHours;
  set("A30", { formula: "SUM(A26,A22,A18)", result: totalResult }, { font: font(11, true), fill: fill(GRAY), alignment: { horizontal: "center" } });
  set("A31", "TOTAL HOURS", { font: font(10, true) });
  set("A33", `Plan total: ${plan.totals.hours}`, { font: font(8, false, "FF6B607A") });

  // Core footnotes
  set(`D${end1}`, "*** CA, GA, and CSV are assumed to overlap with other courses; confirm with your advisor", { font: font(9, true, PURPLE), fill: fill(GRAY) });
  set(`D${end1 + 1}`, "Writing Emphasis hours are counted in Major courses", { font: font(9, true, PURPLE), fill: fill(GRAY) });
  set(`D${end1 + 2}`, "Yellow = still needed · TR = transfer · X = counted in another program", { font: font(9, true, PURPLE), fill: fill(GRAY) });

  // Checklist column U
  const check = (r: number, text: string, header = false) =>
    set(`U${r}`, text, { font: font(header ? 11 : 10, true, header ? undefined : PURPLE), fill: fill(CHECK_FILL), ...(header ? { border: { left: thin, top: thin } } : { border: { left: thin } }) });
  let u = 14;
  check(u++, "Neeley Admissions Course Requirements", true);
  check(u++, "Complete by the semester you declare a major:");
  for (const c of P.requirements["bcore-lower"]?.courses ?? []) check(u++, c);
  check(u++, "MATH 10283 or MATH 10524");
  check(u++, "3.0 TCU GPA to advance into a Neeley major");
  u++;
  check(u++, "Graduation Checklist", true);
  check(u++, `${cohort.upperDivHours} HOURS MUST BE NUMBERED 30000 OR ABOVE AT TCU`);
  check(u++, "45 HOURS MINIMUM REQUIRED AT TCU");
  check(u++, `${cohort.totalHours} HOURS MINIMUM REQUIRED TO GRADUATE`);
  check(u++, "2.5 Cumulative GPA required to graduate");
  check(u++, "2.5 Major GPA required to graduate");
  check(u++, `Source: ${cohort.source}`);
  u++;
  set(`U${u++}`, "Generated by the Graduation Blueprint prototype (sample data).", { font: font(9, true, "FFB3261E") });
  set(`U${u++}`, "Not an official degree audit. Your advisor and the registrar confirm requirements.", { font: font(9, false, "FFB3261E") });
  void end2;
  void end3;

  // ---------- Sheet 2: semester plan ----------
  const sp = wb.addWorksheet("Semester Plan");
  sp.columns = [
    { header: "Term", key: "term", width: 13 },
    { header: "Course", key: "code", width: 14 },
    { header: "Title", key: "title", width: 40 },
    { header: "Hours", key: "hours", width: 7 },
    { header: "Requirement it fills", key: "req", width: 42 },
    { header: "Availability", key: "conf", width: 13 },
    { header: "Availability note", key: "note", width: 48 },
    { header: "Why it's in the plan", key: "why", width: 70 },
  ];
  sp.getRow(1).font = font(10, true, "FFFFFFFF");
  sp.getRow(1).fill = fill("FF4D1979");
  for (const t of plan.terms) {
    const first = sp.rowCount + 1;
    for (const l of t.lines) {
      sp.addRow({ term: t.term, code: l.slot ? "" : l.code, title: l.title, hours: l.credits, req: l.requirement, conf: l.confidence, note: l.confidenceNote, why: l.why });
    }
    const last = sp.rowCount;
    const tot = sp.addRow({ term: `${t.term} total`, hours: { formula: `SUM(D${first}:D${last})`, result: t.hours } });
    tot.font = font(10, true);
    sp.addRow({});
  }
  sp.eachRow((row, i) => {
    if (i > 1 && !row.font?.bold) row.font = font(10);
    row.alignment = { vertical: "top", wrapText: true };
  });
  sp.views = [{ state: "frozen", ySplit: 1 }];

  // ---------- Sheet 3: advisor items and checks ----------
  const ai = wb.addWorksheet("Advisor Items");
  ai.columns = [
    { header: "Type", key: "kind", width: 16 },
    { header: "Item", key: "title", width: 50 },
    { header: "Detail", key: "detail", width: 80 },
    { header: "Source", key: "source", width: 50 },
  ];
  ai.getRow(1).font = font(10, true, "FFFFFFFF");
  ai.getRow(1).fill = fill("FF4D1979");
  for (const a of plan.advisorItems) ai.addRow({ kind: a.kind, title: a.title, detail: a.detail, source: a.source ?? "" });
  ai.addRow({});
  ai.addRow({ kind: "Plan checks", title: `${plan.checks.filter((c) => c.pass).length} of ${plan.checks.length} pass` }).font = font(10, true);
  for (const c of plan.checks) ai.addRow({ kind: c.pass ? "PASS" : "FAIL", title: c.name, detail: c.detail });
  ai.addRow({});
  for (const n of plan.dataNotes) ai.addRow({ kind: "Data note", detail: n });
  ai.eachRow((row, i) => {
    if (i > 1 && !row.font?.bold) row.font = font(10);
    row.alignment = { vertical: "top", wrapText: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

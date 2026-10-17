// Writes public/sample-transcript.pdf: a fictional unofficial transcript for the demo student Jordan.
import fs from "node:fs";

const lines = [
  "SAMPLE - NOT A REAL STUDENT RECORD",
  "Texas Christian University - Unofficial Transcript (demo)",
  "Student: Jordan Kim     Program: BBA Finance; BBA Business Information Systems",
  "",
  "Transfer credit - Tarrant County College, Summer 2024",
  "  MATH 10283  Applied Calculus                         3.0   B",
  "",
  "Fall 2024",
  "  ENGL 10803  Introductory Composition                 3.0   A-",
  "  ECON 10223  Introductory Microeconomics              3.0   B+",
  "Spring 2025",
  "  INSC 20153  Statistical Analysis                     3.0   B",
  "  ECON 10233  Introductory Macroeconomics              3.0   B",
  "  ENTR 20263  Entrepreneurship and Innovation          3.0   A",
  "Fall 2025",
  "  ACCT 20353  Fundamentals of Accounting               3.0   A-",
  "  INSC 20263  Business Information Systems             3.0   A-",
  "  (TCU Core courses: 36 hours, see degree audit)",
  "",
  "Fall 2026 - In Progress",
  "  FINA 30153  Financial Management                     3.0   IP",
  "  MARK 30153  Marketing Management                     3.0   IP",
  "  INSC 30313  Supply Chain Management                  3.0   IP",
  "  INSC 30723  Business Process Analysis                3.0   IP",
  "  INSC 30801  Business Applications in Excel           1.0   IP",
  "  MANA 30250  Organizational Behavior                  1.5   IP",
];

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const content = ["BT", "/F1 10 Tf", "13 TL", "50 760 Td", ...lines.map((l) => `(${esc(l)}) Tj T*`), "ET"].join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
];
let pdf = "%PDF-1.4\n";
const offsets: number[] = [];
objects.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/sample-transcript.pdf", pdf);
console.log("Wrote public/sample-transcript.pdf");

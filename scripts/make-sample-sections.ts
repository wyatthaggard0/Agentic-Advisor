// Writes a labeled SAMPLE data/sections.json so the demo runs before the TCU Class Search pull exists.
// Every section here is invented for testing the engine. Replace the file with the real pull (same shape).

import fs from "node:fs";
import type { Section, SectionsFile } from "../src/lib/engine/types";

type Row = [code: string, term: "F" | "S", sec: string, days: string, start: string, end: string, extra?: Partial<Section>];

const F = "Fall 2026";
const S = "Spring 2027";
const rows: Row[] = [
  // Business core and lower division
  ["ACCT 20353", "F", "010", "MWF", "09:00", "09:50"], ["ACCT 20353", "F", "020", "TR", "11:00", "12:20"],
  ["ACCT 20353", "S", "010", "MWF", "10:00", "10:50"], ["ACCT 20353", "S", "020", "TR", "14:00", "15:20"],
  ["INSC 20153", "F", "010", "TR", "09:30", "10:50"], ["INSC 20153", "S", "010", "MWF", "11:00", "11:50"], ["INSC 20153", "S", "020", "TR", "12:30", "13:50"],
  ["INSC 20263", "F", "010", "MWF", "13:00", "13:50"], ["INSC 20263", "S", "010", "TR", "09:30", "10:50"], ["INSC 20263", "S", "020", "MWF", "09:00", "09:50"],
  ["ENTR 20263", "F", "010", "TR", "14:00", "15:20"], ["ENTR 20263", "S", "010", "MWF", "13:00", "13:50"], ["ENTR 20263", "S", "020", "TR", "11:00", "12:20"],
  ["MARK 30153", "F", "010", "MWF", "10:00", "10:50"], ["MARK 30153", "S", "010", "TR", "09:30", "10:50"], ["MARK 30153", "S", "020", "MWF", "14:00", "14:50"],
  ["FINA 30153", "F", "010", "TR", "11:00", "12:20"], ["FINA 30153", "S", "010", "MWF", "09:00", "09:50"], ["FINA 30153", "S", "020", "TR", "14:00", "15:20"],
  ["INSC 30313", "F", "010", "MWF", "11:00", "11:50"], ["INSC 30313", "S", "010", "TR", "12:30", "13:50"], ["INSC 30313", "S", "020", "MWF", "10:00", "10:50"],
  ["INSC 30801", "F", "010", "F", "13:00", "14:50", { session: "8W1" }], ["INSC 30801", "S", "010", "F", "13:00", "14:50", { session: "8W1" }],
  ["INSC 30801", "S", "020", "F", "13:00", "14:50", { session: "8W2" }],
  ["BUSI 30383", "F", "010", "TR", "15:30", "16:50"], ["BUSI 30383", "S", "010", "MWF", "11:00", "11:50"], ["BUSI 30383", "S", "020", "TR", "17:00", "18:20"],
  ["BUSI 30383", "S", "060", "", "", "", { mode: "Online" }],
  // Finance
  ["FINA 30203", "F", "010", "MWF", "09:00", "09:50"], ["FINA 30203", "S", "010", "TR", "09:30", "10:50"], ["FINA 30203", "S", "020", "MWF", "10:00", "10:50"],
  ["FINA 30213", "F", "010", "TR", "12:30", "13:50"], ["FINA 30213", "S", "010", "TR", "11:00", "12:20"],
  ["FINA 30213", "S", "080", "TR", "11:00", "12:20", { attributes: ["Honors"] }],
  ["FINA 30233", "F", "010", "MWF", "10:00", "10:50"], ["FINA 30233", "F", "020", "TR", "14:00", "15:20"], // fall only
  ["FINA 40153", "F", "010", "TR", "09:30", "10:50"], ["FINA 40153", "S", "010", "MWF", "13:00", "13:50"],
  ["ACCT 30153", "F", "010", "MWF", "08:00", "08:50"], ["ACCT 30153", "S", "010", "TR", "08:00", "09:20"], ["ACCT 30153", "S", "020", "MWF", "13:00", "13:50"],
  ["ACCT 30253", "F", "010", "TR", "08:00", "09:20"], ["ACCT 30253", "S", "010", "MWF", "09:00", "09:50"],
  ["FINA 40313", "F", "010", "TR", "15:30", "16:50"], ["FINA 40313", "S", "010", "TR", "15:30", "16:50"],
  ["FINA 30223", "S", "010", "MWF", "14:00", "14:50"],
  ["FINA 40533", "F", "010", "MWF", "11:00", "11:50"],
  ["FINA 40623", "S", "010", "TR", "12:30", "13:50"],
  ["ACCT 30303", "F", "010", "MWF", "14:00", "14:50"],
  ["FINA 40183", "F", "010", "TR", "17:00", "18:20", { consent: "Dept" }], ["FINA 40193", "S", "010", "TR", "17:00", "18:20", { consent: "Dept" }],
  // BIS and FinTech: single-season pattern from 2026-27 (planning pack): 30723/30823/40813/40843 fall, 30833/30853 spring
  ["INSC 30723", "F", "010", "MWF", "13:00", "13:50"], ["INSC 30723", "F", "020", "TR", "09:30", "10:50"],
  ["INSC 30823", "F", "010", "TR", "11:00", "12:20"], ["INSC 30823", "F", "020", "MWF", "10:00", "10:50"],
  ["INSC 30833", "S", "010", "MWF", "11:00", "11:50"], ["INSC 30833", "S", "020", "TR", "14:00", "15:20"],
  ["INSC 30853", "S", "010", "TR", "12:30", "13:50"], ["INSC 30853", "S", "020", "MWF", "10:00", "10:50", { status: "Closed" }],
  ["INSC 40843", "F", "010", "TR", "14:00", "15:20"],
  ["INSC 40813", "F", "010", "TR", "09:30", "10:50"],
  ["INSC 40383", "F", "010", "MWF", "10:00", "10:50"], ["INSC 40383", "S", "010", "TR", "15:30", "16:50"],
  ["INSC 30263", "S", "010", "MWF", "14:00", "14:50"], ["INSC 30263", "S", "020", "TR", "11:00", "12:20", { status: "Closed" }], // spring only
  ["INSC 30283", "F", "010", "TR", "12:30", "13:50"], ["INSC 30283", "S", "010", "TR", "11:00", "12:20"],
  ["INSC 30283", "S", "020", "MW", "15:30", "16:50", { consent: "Instr" }],
  ["INSC 30273", "F", "010", "MWF", "11:00", "11:50"], ["INSC 30273", "S", "010", "TR", "15:30", "16:50"],
  // First-year requirements and common TCU Core courses (sample; subjects not marked as fully covered)
  ["ECON 10233", "F", "010", "MWF", "10:00", "10:50"], ["ECON 10233", "S", "010", "MWF", "10:00", "10:50"], ["ECON 10233", "S", "020", "TR", "12:30", "13:50"],
  ["ENGL 20803", "F", "010", "TR", "09:30", "10:50"], ["ENGL 20803", "S", "010", "MWF", "13:00", "13:50"],
  ["COMM 10123", "F", "010", "MWF", "11:00", "11:50"], ["COMM 10123", "S", "010", "TR", "11:00", "12:20"],
  ["ARHI 10043", "F", "010", "TR", "14:00", "15:20"], ["ARHI 10043", "S", "010", "TR", "14:00", "15:20"],
  ["BIOL 10003", "F", "010", "MWF", "09:00", "09:50"], ["BIOL 10003", "S", "010", "MWF", "09:00", "09:50"],
  ["BIOL 10523", "F", "010", "TR", "12:30", "13:50"], ["BIOL 10523", "S", "010", "TR", "09:30", "10:50"],
  ["CHEM 10203", "F", "010", "MWF", "13:00", "13:50"], ["CHEM 10203", "S", "010", "MWF", "14:00", "14:50"],
  ["ENGL 10103", "F", "010", "TR", "11:00", "12:20"], ["ENGL 10103", "S", "010", "MWF", "11:00", "11:50"],
  ["PHIL 10103", "F", "010", "MWF", "14:00", "14:50"], ["PHIL 10103", "S", "010", "TR", "15:30", "16:50"],
  ["GEOG 10023", "F", "010", "TR", "15:30", "16:50"], ["GEOG 10023", "S", "010", "MWF", "12:00", "12:50"],
  ["HIST 10203", "F", "010", "MWF", "10:00", "10:50"], ["HIST 10203", "S", "010", "TR", "11:00", "12:20"],
  ["CRES 10103", "F", "010", "TR", "09:30", "10:50"], ["CRES 10103", "S", "010", "TR", "09:30", "10:50"],
  // Management: MANA 30253 runs (many sections); MANA 30250 and MANA 40250 have none (known data problem)
  ["MANA 30253", "F", "010", "MWF", "09:00", "09:50"], ["MANA 30253", "F", "020", "TR", "12:30", "13:50"],
  ["MANA 30253", "S", "010", "MWF", "13:00", "13:50"], ["MANA 30253", "S", "020", "TR", "09:30", "10:50"], ["MANA 30253", "S", "030", "MWF", "11:00", "11:50"],
  ["MANA 30153", "F", "010", "MWF", "14:00", "14:50"], ["MANA 30153", "S", "010", "TR", "14:00", "15:20"],
  ["MANA 40153", "F", "010", "TR", "11:00", "12:20"], ["MANA 40153", "S", "010", "MWF", "09:00", "09:50"],
];

let n = 10100;
const sections: Section[] = rows.map(([code, t, sec, days, start, end, extra]) => ({
  term: t === "F" ? F : S,
  code,
  classNumber: String(n++),
  section: sec,
  component: "LEC",
  days,
  ...(start ? { start, end } : {}),
  session: "1",
  status: "Open",
  seats: { capacity: 40, enrolled: 20 + ((n * 7) % 20) },
  consent: null,
  mode: days ? "In Person" : "Online",
  instructor: "Staff",
  ...extra,
}));

const out: SectionsFile = {
  meta: {
    source: "SAMPLE sections (invented for the demo; replace with the TCU Class Search pull)",
    pulledAt: "",
    sample: true,
    terms: [
      { term: F, coverage: "partial", subjects: ["ACCT", "BUSI", "ENTR", "FINA", "INSC", "MANA", "MARK"] },
      { term: S, coverage: "partial", subjects: ["ACCT", "BUSI", "ENTR", "FINA", "INSC", "MANA", "MARK"] },
    ],
    note: "Coverage is limited to the listed subjects. In those subjects a missing section means 'not offered'. Other subjects have no schedule evidence.",
  },
  sections,
};
fs.writeFileSync("data/sections.json", JSON.stringify(out, null, 1));
console.log(`Wrote data/sections.json with ${sections.length} SAMPLE sections`);

// Shared data shapes for the Graduation Blueprint engine.
// The JSON files in /data follow these shapes; see data/README.md.

export type Season = "Spring" | "Summer" | "Fall";

/** One option inside an OR-group: the course, an optional minimum grade, and whether it may be taken in the same term. */
export interface PrereqRef {
  code: string;
  minGrade?: string;
  concurrentOk?: boolean;
}

export type ConditionKind = "standing" | "major" | "admission" | "permission" | "program" | "test" | "other";

/** A non-course gate such as class standing, a declared major, or department approval. */
export interface Condition {
  kind: ConditionKind;
  value?: string;
  text: string;
}

export interface Course {
  code: string; // "FINA 30153"
  subject: string;
  number: string;
  title?: string;
  credits: number | null; // null = variable credit
  level: number; // first digit of the catalog number
  description: string;
  /** AND of OR-groups: every group must be satisfied by at least one option. */
  prereqs: PrereqRef[][];
  coreqs: string[];
  conditions: Condition[];
  /** "or permission of instructor" style alternate path around the course prerequisites. */
  permissionAlt?: boolean;
  exclusions?: string[];
  prereqText?: string;
  parseConfidence: "high" | "low" | "override";
  source: string;
}

export interface CoursesFile {
  meta: { source: string; generatedAt: string; note?: string };
  courses: Course[];
}

export interface PrereqOverride {
  prereqs?: PrereqRef[][];
  coreqs?: string[];
  conditions?: Condition[];
  permissionAlt?: boolean;
  credits?: number | null;
  title?: string;
  note?: string;
  source?: string;
}

export interface Section {
  term: string; // "Spring 2027"
  code: string;
  classNumber: string;
  section: string;
  component?: string; // LEC, LAB, ...
  days: string; // "MWF", "TR", "" when unscheduled
  start?: string; // "11:00"
  end?: string; // "12:20"
  session?: string; // "1" full term, "8W1"/"8W2" half-term
  status: "Open" | "Closed" | "Waitlist";
  seats?: { capacity: number; enrolled: number };
  consent?: "Dept" | "Instr" | null;
  attributes?: string[]; // "Honors", "Neeley Fellows", "Study Abroad"
  mode?: "In Person" | "Online" | "Hybrid";
  instructor?: string;
  linkGroup?: string; // lecture/lab pairing key
}

export interface SectionsFile {
  meta: {
    source: string;
    pulledAt: string;
    sample?: boolean;
    /** Terms with a posted schedule. coverage "complete" means a missing course is not offered. */
    terms: { term: string; coverage: "complete" | "partial"; subjects?: string[] }[];
    note?: string;
  };
  sections: Section[];
}

export interface Requirement {
  id: string;
  name: string;
  /** all: every course; choose: count courses or hours from the list; slot: placeholder of hours (e.g. a Core category). */
  type: "all" | "choose" | "slot";
  courses?: string[];
  count?: number;
  hours?: number;
  minLevel?: number;
  tags?: string[]; // used for survey matching
  source: string;
  note?: string;
  verified?: boolean;
}

export interface Program {
  id: string;
  name: string;
  kind: "major" | "minor" | "certificate" | "degree" | "core";
  field?: string;
  requirements: string[];
  hours?: number;
  declare?: { text: string; minHours?: number; courses?: string[] };
  source: string;
  verified?: boolean;
  note?: string;
}

export interface Cohort {
  id: string;
  label: string;
  /** Inclusive start term for this rulebook; the latest cohort whose start is <= the student's start term applies. */
  startsFrom: string;
  totalHours: number;
  upperDivHours: number;
  requirements: string[]; // degree-wide requirement ids (Core, business core, ...)
  source: string;
}

export interface EarliestRule {
  course: string;
  rule: "standing" | "afterTerm" | "declaredMajor";
  value: string;
  source: string;
}

export interface Contradiction {
  id: string;
  title?: string;
  text: string;
  affects: string[];
  source: string;
}

export interface ProgramsFile {
  meta: { source: string; catalogYear: string; verified: boolean; note?: string };
  standing: { sophomore: number; junior: number; senior: number; source: string };
  load: { max: number; fullTime: number; source: string };
  cohorts: Cohort[];
  requirements: Record<string, Requirement>;
  programs: Record<string, Program>;
  rules: {
    maxMajors: number;
    sharedHours?: { between: string[]; maxShared: number; source: string }[];
    sameFieldMinorBlocked?: boolean;
    earliest: EarliestRule[];
    source: string;
  };
  contradictions: Contradiction[];
  opportunities: { id: string; name: string; text: string; source: string }[];
}

export interface CompletedCourse {
  code: string;
  grade?: string; // letter grade, "P", or "IP" for in progress
  term: string;
  transfer?: { from: string; verified: boolean; note?: string };
  credits?: number;
  /** Slot requirement this course fills (e.g. a TCU Core category), per the student's degree audit. */
  countsToward?: string;
}

export interface Student {
  id: string;
  name: string;
  sample: boolean;
  startTerm: string;
  currentTerm: string;
  targetGradTerm: string;
  programs: string[]; // declared or intended program ids
  declared: boolean;
  completed: CompletedCourse[];
  inProgress: CompletedCourse[];
  /** Hours earned outside the course list (AP, general transfer) counted toward totals only. */
  otherHours?: { hours: number; label: string; upper?: number };
  /** Core / elective requirement slots already satisfied, by requirement id. */
  satisfiedSlots?: Record<string, number>;
  holds?: { term: string; type: "study-abroad" | "neeley-fellows" | "internship"; note: string }[];
  survey?: Survey;
  preferences?: SchedulePrefs;
}

export type StudentYear = "incoming" | "freshman" | "sophomore" | "junior" | "senior";

export interface Survey {
  /** Planner keywords used to match electives: "data", "investing", "technology", ... */
  interests: string[];
  /** Interest areas picked in the survey (keys of data/careers.json) */
  areas?: string[];
  interestText?: string;
  year?: StudentYear;
  hometown?: string;
  locations?: string[];
  careers?: string[];
  /** light caps semesters at 15 hours; balanced and heavy allow up to the 18-hour limit */
  workload?: "light" | "balanced" | "heavy";
  studyAbroad?: { plan: "no" | "maybe" | "yes"; term?: string };
  fridaysFree?: boolean;
  targetGradTerm?: string;
  completedAt?: string;
}

export interface SchedulePrefs {
  earliestStart?: string; // "09:00"
  fridaysFree?: boolean;
  noEvening?: boolean; // nothing after 17:30
  pattern?: "MWF" | "TR" | "any";
  mode?: "In Person" | "Online" | "any";
  lunchGap?: boolean;
  fewerDays?: boolean;
}

export type Confidence = "confirmed" | "historical" | "assumed" | "advisor" | "in-progress" | "completed";

export interface PlanLine {
  code: string; // course code or slot id
  title: string;
  credits: number;
  slot: boolean;
  /** Slot that must be filled with a 30000+ course */
  upper?: boolean;
  requirementId: string;
  requirement: string;
  programs: string[];
  source: string;
  confidence: Confidence;
  confidenceNote: string;
  why: string;
  prereqNote?: string;
  added?: "prereq" | "coreq" | "requirement" | "elective" | "swap";
}

export interface PlanTerm {
  term: string;
  status: "completed" | "in-progress" | "planned" | "hold";
  hold?: string;
  lines: PlanLine[];
  hours: number;
}

export interface CheckResult {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
}

export interface AdvisorItem {
  id: string;
  kind: "transfer" | "permission" | "availability" | "contradiction" | "catalog" | "shared-credit" | "declaration" | "unplaced" | "load" | "other";
  title: string;
  detail: string;
  source?: string;
}

export interface Plan {
  studentId: string;
  cohort: string;
  programs: string[];
  terms: PlanTerm[];
  gradTerm: string;
  targetGradTerm: string;
  onTime: boolean;
  totals: { hours: number; required: number; upper: number; upperRequired: number; maxLoad: number };
  unplaced: { code: string; credits: number; reason: string }[];
  swaps: { from: string; to: string; reason: string }[];
  blocked: { reason: string; source: string }[];
  checks: CheckResult[];
  advisorItems: AdvisorItem[];
  contradictions: Contradiction[];
  dataNotes: string[];
}

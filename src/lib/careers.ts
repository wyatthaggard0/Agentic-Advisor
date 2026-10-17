// Year-aware career guidance from data/careers.json, scored against the student's survey answers.
// Freshmen/sophomores: majors and career areas to explore. Juniors/seniors: job titles, internships, companies.
// Match % is an explainable formula (picked interest areas + free-text words + location fit), not a hiring
// prediction. Employers are examples to research, never openings or TCU partnerships.

import fs from "node:fs";
import path from "node:path";
import { parseTerm } from "./engine/terms";
import type { StudentYear, Survey } from "./engine/types";

interface Area {
  label: string;
  keywords: string[];
  industries: string[];
  majors: string[];
  programs: string[];
  roles: string[];
}
interface Company {
  name: string;
  industry: string;
  areas: string[];
}
interface Pathway {
  id: string;
  kind: "double-major" | "minor" | "certificate" | "program";
  name: string;
  areas: string[];
  years: StudentYear[];
  majors?: string[];
  field?: string;
  programIds?: string[];
  nonBusinessOnly?: boolean;
  detail: string;
  when?: string;
  source: string;
}
export interface PathwayItem extends MatchItem {
  kind: Pathway["kind"];
  source: string;
  when?: string;
  programIds?: string[];
  /** Engine-computed effect on this student's plan, when the programs are modeled */
  impact?: string;
}
export interface StudentContext {
  majors: string[]; // current major names, e.g. "Finance"
  programIds: string[];
  business: boolean;
}
export interface CareersFile {
  meta: { source: string; note: string; scoring?: string };
  pathways: Pathway[];
  doubleMajorRule: { text: string; source: string };
  interests: Record<string, Area>;
  locations: Record<string, Company[]>;
  regionStrengths: Record<string, string[]>;
  timing: { early: string; junior: string; senior: string };
}

export interface MatchItem {
  name: string;
  score: number; // 0-100, match to survey answers
  reasons: string[];
  detail?: string;
}
export interface Internship extends MatchItem {
  when: string;
  apply: string;
  companies: string[];
}
export interface Recommendations {
  stage: "explore" | "apply";
  year: StudentYear | "unknown";
  headline: string;
  timing: string;
  majors?: MatchItem[];
  areas?: MatchItem[];
  roles?: MatchItem[];
  internships?: Internship[];
  companies?: MatchItem[];
  programs: string[];
  doubleMajors?: PathwayItem[];
  minors?: PathwayItem[];
  certificates?: PathwayItem[];
  neeleyPrograms?: PathwayItem[];
  doubleMajoring: { text: string; source: string; already: boolean };
  note: string;
  scoring: string;
  source: string;
}

export function loadCareers(): CareersFile {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "careers.json"), "utf8")) as CareersFile;
}

export function interestOptions(): { id: string; label: string }[] {
  return Object.entries(loadCareers().interests).map(([id, a]) => ({ id, label: a.label }));
}

/** Keywords the planner uses to match electives, from the picked areas plus free text. */
export function plannerKeywords(areas: string[], text = ""): string[] {
  const c = loadCareers();
  const kw = areas.flatMap((a) => c.interests[a]?.keywords ?? []);
  const free = text.toLowerCase().split(/[,;\n]+/).map((w) => w.trim()).filter((w) => w.length > 2 && w.length < 30);
  return [...new Set([...kw, ...free])];
}

const cap = (n: number) => Math.max(5, Math.min(97, Math.round(n)));
const isEarly = (y?: StudentYear) => !y || y === "incoming" || y === "freshman" || y === "sophomore";

export function recommend(
  survey: Survey,
  currentTerm: string,
  targetGradTerm: string,
  student: StudentContext = { majors: [], programIds: [], business: true },
): Recommendations {
  const c = loadCareers();
  const picked = (survey.areas ?? []).filter((a) => c.interests[a]);
  const text = `${survey.interestText ?? ""}`.toLowerCase();
  const locs = (survey.locations ?? []).filter((l) => c.locations[l]);

  // Which free-text words point at an area (e.g. "investing club" -> investing)
  const textWords = (id: string) => {
    const a = c.interests[id];
    return [...a.keywords, ...a.label.toLowerCase().split(/[^a-z]+/)].filter((k) => k.length > 3 && text.includes(k));
  };
  const regionFor = (id: string) => locs.filter((l) => (c.regionStrengths[l] ?? []).includes(id));

  /** Area score: picked +70, free-text mention +15, a preferred region known for it +10. */
  const areaScore = (id: string) => {
    const reasons: string[] = [];
    let s = 0;
    if (picked.includes(id)) {
      s += 70;
      reasons.push(`You picked ${c.interests[id].label}`);
    }
    const words = textWords(id);
    if (words.length) {
      s += 15;
      reasons.push(`You wrote "${words[0]}"`);
    }
    const regions = regionFor(id);
    if (regions.length) {
      s += 10;
      reasons.push(`Strong in ${regions[0]}`);
    }
    return { s, reasons };
  };
  // Areas in play: picked ones, plus any the free text points to
  const inPlay = Object.keys(c.interests).filter((id) => picked.includes(id) || textWords(id).length);
  const areaIds = inPlay.length ? inPlay : ["consulting", "data"];
  const programs = [...new Set(areaIds.flatMap((id) => c.interests[id].programs))];

  // ---------- Pathways: double majors, minors, certificates, Neeley programs ----------
  const year = survey.year ?? "freshman";
  const doubleMajoring = student.majors.length >= 2;
  const pathItems: PathwayItem[] = [];
  for (const p of c.pathways ?? []) {
    if (!p.years.includes(year)) continue; // window has passed (e.g. Fellows after first year)
    if (p.programIds?.length && p.programIds.every((id) => student.programIds.includes(id))) continue; // already in it
    if (p.kind === "double-major") {
      if (doubleMajoring) continue;
      if ((p.majors ?? []).every((m) => student.majors.includes(m))) continue;
    }
    if (p.kind === "minor" && ((p.field && student.majors.includes(p.field)) || (p.nonBusinessOnly && student.business))) continue;
    const overlap = p.areas.filter((a) => areaIds.includes(a));
    const reasons = overlap.map((a) => c.interests[a].label);
    const has = (p.majors ?? []).filter((m) => student.majors.includes(m));
    let s =
      25 +
      45 * (overlap.length / Math.max(1, Math.min(areaIds.length, 3))) +
      12 * (overlap.length / p.areas.length) +
      (areaIds.includes(p.areas[0]) ? 10 : 0) +
      (overlap.some((a) => textWords(a).length) ? 5 : 0);
    if (has.length) {
      s += 5;
      reasons.push(`Builds on your ${has[0]} major`);
    }
    if (!overlap.length) s = Math.min(s, 30);
    if (p.when) reasons.push(p.when);
    pathItems.push({
      name: has.length && p.majors ? `Add ${p.majors.filter((m) => !has.includes(m)).join(" + ")} to ${has[0]}` : p.name,
      score: cap(s),
      reasons,
      detail: p.detail,
      kind: p.kind,
      source: p.source,
      when: p.when,
      programIds: p.programIds,
    });
  }
  const top = (kind: PathwayItem["kind"], n: number) =>
    pathItems.filter((x) => x.kind === kind).sort((a, b) => b.score - a.score).slice(0, n);
  const pathways = {
    doubleMajors: top("double-major", 3),
    minors: top("minor", 3),
    certificates: top("certificate", 3),
    neeleyPrograms: top("program", 4),
    doubleMajoring: { ...(c.doubleMajorRule ?? { text: "", source: "" }), already: doubleMajoring },
  };

  const base = {
    ...pathways,
    year: (survey.year ?? "unknown") as Recommendations["year"],
    programs,
    note: `Possibilities to explore, not guarantees. ${c.meta.note}`,
    scoring: c.meta.scoring ?? "Match % reflects your survey answers.",
    source: "careers.json, team-curated examples",
  };

  if (isEarly(survey.year)) {
    // Majors: best area score among areas that list it, +5 for each additional matching area
    const majors = new Map<string, MatchItem>();
    for (const id of areaIds) {
      const { s, reasons } = areaScore(id);
      for (const [rank, m] of c.interests[id].majors.entries()) {
        const prev = majors.get(m);
        // the first major listed for an area is its closest fit; later ones count a little less
        if (!prev) majors.set(m, { name: m, score: s - rank * 8, reasons: [...reasons], detail: `Fits ${c.interests[id].label}` });
        else {
          prev.score = Math.max(prev.score, s) + 5;
          prev.reasons = [...new Set([...prev.reasons, ...reasons])];
          prev.detail = `${prev.detail} and ${c.interests[id].label}`;
        }
      }
    }
    const areas: MatchItem[] = areaIds.flatMap((id) => {
      const { s, reasons } = areaScore(id);
      return c.interests[id].industries.map((ind, i) => ({ name: ind, score: s - i * 4, reasons, detail: c.interests[id].label }));
    });
    return {
      ...base,
      stage: "explore",
      headline: "Majors and career areas to explore",
      timing: c.timing.early,
      majors: [...majors.values()].map((m) => ({ ...m, score: cap(m.score) })).sort((a, b) => b.score - a.score).slice(0, 5),
      areas: areas.map((a) => ({ ...a, score: cap(a.score) })).sort((a, b) => b.score - a.score).slice(0, 6),
    };
  }

  // Juniors and seniors: job titles, internships, companies
  const senior = survey.year === "senior";
  const roles: (MatchItem & { area: string })[] = areaIds.flatMap((id) => {
    const { s, reasons } = areaScore(id);
    return c.interests[id].roles.map((r, i) => {
      const hit = text && r.toLowerCase().split(/[^a-z]+/).some((w) => w.length > 4 && text.includes(w));
      return { name: senior ? r.replace(/\s*(summer )?(intern|analyst intern)$/i, (m) => (/analyst/i.test(m) ? " analyst" : "")).replace(/ summer analyst$/i, " analyst") : r, score: s - i * 4 + (hit ? 8 : 0), reasons, detail: c.interests[id].label, area: id };
    });
  });
  const candidates = (locs.length ? locs : ["Dallas-Fort Worth", "Anywhere"]).flatMap((l) => c.locations[l].map((co) => ({ ...co, region: l })));
  const companies: (MatchItem & { areas: string[] })[] = candidates.map((co) => {
    const overlap = co.areas.filter((a) => areaIds.includes(a));
    const reasons = [
      ...overlap.map((a) => c.interests[a].label),
      locs.includes(co.region) ? `In ${co.region}, where you want to be` : `${co.region} (default)`,
    ];
    // coverage of the student's areas, how focused the company is on them, its main industry, location, free text
    const s =
      25 +
      35 * (overlap.length / Math.max(1, Math.min(areaIds.length, 3))) +
      15 * (overlap.length / co.areas.length) +
      (areaIds.includes(co.areas[0]) ? 10 : 0) +
      (locs.includes(co.region) ? 8 : 0) +
      (overlap.some((a) => textWords(a).length) ? 5 : 0);
    if (areaIds.includes(co.areas[0])) reasons.unshift(`Known for ${co.industry.toLowerCase()}`);
    return { name: co.name, score: overlap.length ? s : 20, reasons, detail: `${co.industry} · ${co.region}`, areas: co.areas };
  });
  const topRoles = roles.map((r) => ({ ...r, score: cap(r.score) })).sort((a, b) => b.score - a.score);
  const topCompanies = companies.map((x) => ({ ...x, score: cap(x.score) })).sort((a, b) => b.score - a.score);

  // Next summer after the current term
  const cur = parseTerm(currentTerm);
  const summerYear = cur.season === "Fall" ? cur.year + 1 : cur.year;
  const internships: Internship[] = topRoles.slice(0, 3).map((r) => ({
    name: senior ? `Full-time: ${r.name}` : `Summer ${summerYear}: ${r.name}`,
    score: r.score,
    reasons: r.reasons,
    detail: r.detail,
    when: senior ? `Starts after ${targetGradTerm}` : `Summer ${summerYear}`,
    apply: senior
      ? `Recruiting runs fall ${cur.season === "Fall" ? cur.year : cur.year - 1}; return offers from internships count`
      : `Apply in fall ${summerYear - 1}${r.area === "investing" || r.area === "consulting" ? " (banking and consulting often recruit earlier)" : ""}`,
    companies: topCompanies.filter((co) => co.areas.includes(r.area)).slice(0, 3).map((co) => co.name),
  }));

  return {
    ...base,
    stage: "apply",
    headline: senior ? "Roles, full-time opportunities and companies" : "Job titles, internships and companies",
    timing: senior ? c.timing.senior : c.timing.junior,
    roles: topRoles.slice(0, 6).map(({ area: _a, ...r }) => r),
    internships,
    companies: topCompanies.slice(0, 8).map(({ areas: _a, ...co }) => co),
  };
}

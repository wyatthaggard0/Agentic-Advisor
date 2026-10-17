import type { Season } from "./types";

const ORDER: Record<Season, number> = { Spring: 0, Summer: 1, Fall: 2 };

export interface TermKey {
  season: Season;
  year: number;
}

export function parseTerm(label: string): TermKey {
  const m = /^(Spring|Summer|Fall)\s+(\d{4})$/.exec(label.trim());
  if (!m) throw new Error(`Bad term label: ${label}`);
  return { season: m[1] as Season, year: Number(m[2]) };
}

export function termLabel(t: TermKey): string {
  return `${t.season} ${t.year}`;
}

/** Sortable index; Spring < Summer < Fall within a year. */
export function termIndex(label: string): number {
  const t = parseTerm(label);
  return t.year * 3 + ORDER[t.season];
}

export function compareTerms(a: string, b: string): number {
  return termIndex(a) - termIndex(b);
}

/** Next regular (fall/spring) term. */
export function nextRegularTerm(label: string): string {
  const t = parseTerm(label);
  if (t.season === "Fall") return `Spring ${t.year + 1}`;
  return `Fall ${t.year}`;
}

/** Fall/spring terms strictly after `from`, through `to` inclusive. */
export function regularTermsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = nextRegularTerm(from);
  while (compareTerms(cur, to) <= 0) {
    out.push(cur);
    cur = nextRegularTerm(cur);
  }
  return out;
}

export function seasonOf(label: string): Season {
  return parseTerm(label).season;
}

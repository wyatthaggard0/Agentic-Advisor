# Graduation Blueprint

Working prototype of an AI academic planning assistant for TCU Neeley students (Neeley AI Forward competition, Advanced Track).

The planning engine is ordinary TypeScript working from the data files in `/data`. It picks the rulebook, fills requirements, closes prerequisite chains, schedules semesters, runs 10 checks and builds next-semester section schedules. Claude handles the conversation: intake, the career survey, reading transcripts and explaining plans. It calls the engine through tools and never places courses itself.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

The chat uses Claude (`claude-opus-5-5`) when `ANTHROPIC_API_KEY` is set. Without a key it falls back to an offline assistant that answers from the same engine tools, so a live demo never depends on the network. To force offline mode, set `BLUEPRINT_OFFLINE=1`.

The chat requests also turn on Anthropic's server-side refusal fallback (`fallbacks: "default"`), so a request the main model declines is retried on a fallback model.

Deep links for recording: `/#plan`, `/#schedule`, `/#maya`, `/#maya-plan`. The advisor queue is at `/advisor`.

## Database and sign-in (Supabase)

1. Create `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (Session pooler; password without brackets)
   - `DEMO_PASSWORD`
   - optionally `ANTHROPIC_API_KEY`
2. `npm run db:migrate`: creates the tables and row-level security policies.
3. `npm run db:seed`: creates the demo accounts and loads the sample student records. Run it again any time to reset.
4. `npm run db:rls`: checks that students can see only their own data.

Without the Supabase variables, the app runs in local mode from `data/students/*.json`, with a student switcher and no sign-in.

## Scripts

| Command | What it does |
|---|---|
| `npm run data:pack` | Imports `neeley-planning-pack/` (courses, programs, rules) into `data/`. Re-run after the team edits the pack |
| `npm run data:courses` | Rebuilds `data/courses.json` from `courses-report*.csv`, parsing prerequisites out of the descriptions |
| `npm test` | Prints the demo plans and their checks |
| `npm run check` | Re-verifies the demo plans from the **raw** data files without using engine code. Exits 1 on any failure. `npm run check -- plan.json` checks an exported plan |
| `npx tsx scripts/export-smoke.ts` | Writes demo Excel exports to `data/runtime/exports/` and checks their totals against the plans |
| `npx tsx scripts/make-sample-sections.ts` | Rewrites the SAMPLE `sections.json` |
| `npx tsx scripts/make-sample-transcript.ts` | Rewrites `public/sample-transcript.pdf` |

## Data files (refresh without a rebuild)

The app re-reads these whenever they change on disk.

- **`courses.json`**: `{ meta, courses: Course[] }`. Each course has `prereqs` as an AND of OR-groups: `[[{code, minGrade?, concurrentOk?}]]`. It also has `coreqs`, `conditions` (standing, major, permission, program, test), `permissionAlt`, `credits` and `level`. The current file is auto-parsed from the registrar export. The team's verified file can replace it.
- **`prereq_overrides.json`**: `{ overrides: { "SUBJ 12345": { prereqs?, coreqs?, conditions?, credits?, title?, note, source } } }`. Overrides always win over the parsed data. Add the 34 pending corrections here.
- **`sections.json`**: currently a labeled SAMPLE. The Class Search pull should match this shape:
  - `meta.terms[]`: `{ term: "Spring 2027", coverage: "complete" }`. With complete coverage, a course with no section is treated as not offered.
  - `sections[]`: `{ term, code, classNumber, section, component: "LEC"|"LAB", days: "MWF"|"TR"|"", start: "13:00", end: "13:50", session: "1"|"8W1"|"8W2", status: "Open"|"Closed"|"Waitlist", seats, consent: "Dept"|"Instr"|null, attributes: ["Honors"], mode, linkGroup }`.
  - Use `linkGroup` to pair a lecture with its lab.
- **`programs.json`**: the rules.
  - Standing thresholds and the load cap.
  - Cohorts (`startsFrom`, total and upper-division hours, requirement list).
  - Requirements (`all` / `choose` / `slot`), programs, and combination rules (max majors, shared-hour caps, same-field minors).
  - Earliest-semester rules, data contradictions, opportunities, and course titles.
  - The current file is provisional, compiled from the 2026-27 catalog and the archived 2025-26 PDF.
- **`students/*.json`**: sample students. Any profile in this shape works.

## Rules the engine applies

- Offering evidence:
  - A section in a posted term means **confirmed**.
  - No section in a fully covered posted term means **not offered**, and the course is never placed there.
  - A future term in a season where the course appeared means **historical**, assumed to repeat.
  - Seen only in the other season means the course is avoided in that term.
  - Seen in neither season means **needs advisor**.
- Choice requirements are filled in this order: already completed, already in the plan for another program, survey match, has schedule evidence, fewest new prerequisites.
- Scheduling:
  - Respects prerequisites, corequisites, class standing, declared-major gates, earliest-term rules, holds, a balanced load and the 18-hour cap.
  - When a course doesn't fit, the engine tries one same-requirement swap, then moves a Core or elective slot to summer.
  - Only after that does it add a semester, naming the course that pushes graduation back.
- Contradictions in the TCU data are shown to the student and the advisor, never silently resolved. Examples: MANA 30350 is missing from the export, MANA 30250/40250 have no sections, ACCT 20153 doesn't exist, and sources disagree on 120 vs. 124 hours.
- The schedule builder uses real sections only after advisor approval. Before approval it shows a preview with a banner. It runs a backtracking search (fewest options first, top 12 per course, capped at 20,000 tries) with hard rules and soft survey preferences.

## Known limitations

- Section data is invented until the Class Search pull lands. Program rules are unverified.
- TCU Core categories are hour slots. Overlap between categories (Writing Emphasis, Responsible Citizenship) is assumed.
- The registrar export has no course titles. Titles come from `programs.json`, and other courses show "Title not in course export".
- Reviews are stored in `data/runtime/reviews.json`. This is a prototype, not a records system.

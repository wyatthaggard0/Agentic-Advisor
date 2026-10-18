# Graduation Blueprint

Prototype for the **Neeley AI Forward competition (Advanced Track)**, case "The Graduation Blueprint" (`Context.md`). The deliverable is a **3-minute video** of a working, reusable AI academic planning assistant for TCU Neeley students. The judges score academic accuracy, feasibility, evidence and responsible AI above the interface. The case says plainly that it does not want "another chatbot".

## Core principle: the engine decides, Claude explains

- `src/lib/engine/` is ordinary TypeScript with no LLM. It picks the rulebook (cohort), fills requirements, closes prerequisite chains, schedules semesters, runs the 10 validation checks, compares what-if plans, and builds next-semester section schedules.
- Claude (`src/lib/ai/`) handles conversation only: intake, the Planning Survey, transcript reading, career guidance, and explaining plans. It reaches the engine through tools in `tools.ts`.
- Every course, requirement, prerequisite, offering, date or employer Claude mentions must come from a tool result. Never let the model place courses or state academic facts from memory.
- `offline.ts` is a rule-based fallback that answers from the same tools when there's no API key, so a live demo never depends on the network.

## Non-negotiables (from the case)

- Never invent courses, section times, requirements or approvals. Unknowns are labeled, not guessed.
- Every plan line carries the requirement it fills, its source, and an availability label: `confirmed` / `historical` / `assumed` / `advisor`.
- Contradictions in TCU data are recorded in `programs.json` `contradictions` (useful for Part 1 findings). For the demo the planner does not show them in the app.
- Never say a student is "cleared to graduate" or registered. Advisor review and my.tcu.edu registration are separate steps. What-if plans never change the official record.
- Career suggestions are possibilities to explore. Employers are examples to research, not openings or TCU partnerships.
- Sample data is always labeled as sample in the UI, the exports and the files.

## Data (`/data`, re-read at runtime, no rebuild needed)

| File | Status | Notes |
|---|---|---|
| `courses.json` | **From `neeley-planning-pack/courses.csv`** (`npm run data:pack`) | Titles, prerequisites (AND of OR-groups; 151 Neeley courses hand-verified), same-term allowances, min grades, Core tags, season rules, earliest-semester rules, which programs use each course. `npm run data:courses` is the older fallback that parses the raw export |
| `prereq_overrides.json` | Few entries | Always beats the course data. Add hand corrections here |
| `sections.json` | **SAMPLE (invented)** | Replace with the TCU Class Search pull. Shape is in README.md. Every class time and fall/spring-only pattern in the demo comes from this file |
| `programs.json` | **From `neeley-planning-pack/neeley_programs.json`** (`npm run data:pack`) | Both rulebooks (old = started before summer 2025, new = summer 2025+), TCU Core slots and rules per version, all 7 majors + Real Estate concentration, minors, certificates, combination rules, declare-major courses, earliest-semester defaults, 21 known TCU data problems, opportunities, cost of an extra semester. Edit the pack and re-run the importer; don't hand-edit this file |
| `neeley_rules.md` | Copy of the pack's `NEELEY_RULES.md` | Sent to Claude as cached reference text for explanations; the engine still decides |
| `careers.json` | Team-curated | Interest areas mapped to industries, majors, roles and programs. Example employers by region. Recruiting timing |
| `students/*.json` | Sample personas | Maya (incoming freshman, undecided) and Jordan (junior, Finance + BIS, considering FinTech) |

Parsing rules that matter:
- "A, or B, or C and D" means A OR B OR (C AND D).
- "or concurrent enrollment" means the course may be taken in the same term. It is not a corequisite.
- "C-" is not "C".
- "or permission of instructor" is an alternative path, not an extra gate.
- Prerequisites that differ by major use the Business-major sentence.

## Accounts and database (Supabase)

- **Sign-in:** `/login` with demo accounts Jordan, Maya and Advisor (`@example.com`). The demo buttons sign in on the server with `DEMO_PASSWORD`, so it never reaches the browser.
- **Student records live in Postgres:** `students`, `course_records`, `survey_responses`, `saved_plans` and `advisor_reviews`, defined in `supabase/migrations/`.
  - Seeded from `data/students/*.json` as a stand-in for an authorized degree-audit export (FR-08).
  - Every course record carries a `source`: `registrar_sample`, `transcript_upload` or `student_reported`.
- **Row-level security does the access control:**
  - Students read only their own rows and can add only transcript or student-reported records.
  - Advisors read everything and decide reviews.
  - `npm run db:rls` proves this with real sign-ins.
- **API routes** resolve the student from the session (`resolveStudent` in `src/lib/api.ts`). Students can't request another student's id. Without Supabase env vars, the app falls back to the JSON files.
- **Commands:** `npm run db:migrate`, `npm run db:seed` (also resets the demo), `npm run db:rls`, `npm run db:ping`. The advisor's **Reset demo data** button reseeds without signing anyone out.
- **Secrets** live in `.env.local` (gitignored) and, later, Vercel env vars. Never print `DATABASE_URL`; scripts only show its host.

## Planning rules from the pack (engine)

- **Rulebook** by start term: `cohorts` old/new set business groups, total and upper-division hours, and the Core version.
- **TCU Core** (`src/lib/engine/core.ts`) credits the degree audit (`satisfiedSlots` counts per category code), then completed, in-progress and planned courses by their Core tags, then picks real courses for open categories:
  - prefers double-dips and interest matches
  - follows TCU's rules: at most 2 categories plus WEM, OCO/WCO alone, the prefix cap, and old-Core Heritage/diversity
  - `plan.coreAssignments` shows what fills each category
- **Placement** also checks:
  - hard earliest-semester index (`course.earliest`, or the business 30000+ default)
  - soft preferred semester
  - season rules (`course.seasons`)
  - "declared business major" only after the six declare courses and 24 hours
  - program admission via `usedBy`
- **Scheduling priority:** longest chain of dependents, then fewest remaining terms that offer the course (fall-only capstones first), then requirements before suggested Core picks.
- **Cost** (`src/lib/engine/cost.ts`, rates in `programs.json` `cost.tuition` from TCU's 2026-27 tuition page): each planned term is priced at $33,260 flat for 12-18 hours, $1,735 per hour over 18, per-hour rates under 12, summer per hour, plus the $270 Neeley differential per credit hour of ACCT/BUSI/ENTR/FINA/INSC/MANA/MARK courses and housing and food per fall/spring term. So a Core class inside 18 hours adds $0 and a Neeley class adds $270 per hour. The Blueprint shows the remaining cost, a per-term table and the cost of semesters past the target; comparisons show the difference between two plans.

## Product surface

- **Advisor Chat:**
  - Claude-style thread with the **Recommended: Planning Survey** block under the greeting.
  - Transcript upload with a confirm/correct step.
  - Suggested-reply chips.
- **Planning Survey** (`components/SurveyForm.tsx`) asks for year, interests (chips plus free text), hometown and desired locations, semester load, study abroad, no Fridays, and graduation target. Answers feed the planner:
  - "Light" caps semesters at 15 hours.
  - A study-abroad term becomes a hold semester.
  - Fridays off goes to the schedule builder.
  - Interests steer electives.
  - The target term becomes the plan's target.
  - Career guidance is year-aware and shows as a results card (`components/RecommendationsCard.tsx`) with a **match bar** per item and the reasons behind it:
    - Incoming, freshman and sophomore students get **majors** and **career areas**.
    - Juniors and seniors get **job titles**, **internship opportunities** (summer, when to apply, best-fit companies) and **companies**.
    - Both stages also get **Programs & pathways**: double majors, minors, certificates, and Neeley programs (TIP Board, Fellows, NLP, Educational Investment Fund, the Consultative Selling/Sales certificate), plus a double-majoring rule box. These come from `careers.json` `pathways` and are filtered by year and by what the student already has. Pathways the planner models show their real effect on the plan (graduation date and hours).
    - Match % is an explainable formula in `src/lib/careers.ts`: picked interest areas, free-text words, location fit, and company focus. It isn't AI output and isn't a hiring prediction.
- **Graduation Blueprint:**
  - Semester grid with a drawer per course. Suggested Core courses list other courses that fill the same categories; "Use this" swaps one in (`student.coreChoices`).
  - Program what-ifs: each row shows only the student's programs, with Change / Add opening the full list. Comparison table.
  - The 10 checks and advisor items (collapsed to their titles).
  - Send for advisor review.
  - **Download Excel** in Neeley's degree-plan worksheet format (`src/lib/export/degreePlanXlsx.ts`, modeled on `Example Download Excel Sheet.xlsx`; never copy that file's personal data).
- **Next Semester:** section schedule. It's a preview until the advisor approves; after approval it uses real sections.
- **/advisor:** review queue with approve or request-changes.

## Demo scenarios the video must show

1. **On-time plan:** Maya's 8 semesters.
2. **Adding a program:** Jordan adds FinTech. Graduation stays May 2028 only with one Core course moved to Summer 2027 and one same-requirement swap. Shared credit with BIS is flagged.
3. **Bottleneck:** a fall-only or spring-only course forces a swap or a later term.
4. **AI gets it wrong / uncertainty:**
   - Jordan's unverified transfer credit.
   - The MANA 30350 / 120-vs-124 data conflicts.
   - Unverified offerings.
   - All routed to the advisor.

## Commands

```bash
npm run dev                         # app on :3000
npm run data:pack                   # import neeley-planning-pack into data/
npm test                            # demo plans + checks
npm run check                       # independent re-check from raw files (no engine code)
npx tsx scripts/export-smoke.ts     # Excel export totals vs plan
npx tsx scripts/survey-smoke.ts     # survey -> planner + recommendations
npx tsx scripts/core-swap-smoke.ts  # swap a suggested Core course for an alternative
npx tsc --noEmit                    # typecheck
```

Set `ANTHROPIC_API_KEY` for Claude (`claude-opus-5-5`), or `BLUEPRINT_OFFLINE=1` to force offline mode.

## Conventions

- **UI:** TCU-style look (purple gradient masthead, Montserrat, heavy uppercase headings, teal accent, square corners). Our "GB" mark, not the official TCU logo. Copy is plain, active voice, and never overclaims.
- **Engine:** keep it pure and testable. After changing planner logic, run `npm test` and `npm run check` and keep all demo plans at 10/10.
- **Data:** new academic facts go into `/data` with a `source`, not into code.

## Open items

- **Class Search pull** for `sections.json` (real times and offerings).
- **Pack follow-ups:** AP credit and math placement questions in the survey (NEELEY_RULES §4), subjects to avoid for Core picks, Neeley Fellows hold on business core.
- **Pick-lists:** the survey's "first semester at TCU" picks the rulebook for students without a record.
- **Claude API key** on the demo machine.

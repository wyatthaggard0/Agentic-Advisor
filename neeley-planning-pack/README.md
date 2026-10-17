# Neeley planning reference pack

Everything an AI needs to make correct degree-planning and scheduling decisions for TCU Neeley students. Built 2026-10-17 from official TCU sources and a scrape of TCU Class Search.

## What's in the folder

| File | Size | What it's for |
|---|---|---|
| `NEELEY_RULES.md` | ~25 KB | **The rules.** Rulebooks by start term, progression, when a course can be taken, Core double counting, schedule rules, deadlines, known data problems, sources. Put this in the AI's instructions or knowledge. |
| `neeley_programs.json` | ~45 KB | **The requirements.** All 7 Neeley majors, the Finance Real Estate concentration, 8 minors and 5 certificates, with exact course lists; both rulebooks; Core slots and rules; earliest-semester rules; standing; application programs; advisor items. |
| `courses.csv` | 3,888 rows | **Every course in TCU's course list** (your course export CSV). Per course: credits, prerequisites (AND/OR), same-semester allowances, corequisites, conditions, minimum grade, Core tags, season rule, earliest semester, which Neeley programs use it, and whether the prerequisite was hand-verified. |

Section times, seats and status are **not** included. They change every term, so pull them live from TCU Class Search and join on the course number.

## How to plug it into your site

**Option A: give the files to the AI directly** (Claude Projects, a custom GPT, or an Assistants/Files API):
1. Put `NEELEY_RULES.md` into the system prompt or project instructions.
2. Upload `neeley_programs.json` and `courses.csv` as knowledge files. Pass the Class Search sections for the term you're scheduling in the conversation or a tool call.
3. Use the decision prompt below as the system prompt.

**Option B: your code looks things up, the AI explains** (more accurate, recommended for anything shown to judges):
1. Load `neeley_programs.json` and `courses.csv` into your backend, next to your live Class Search pull.
2. Your code does the checks in `NEELEY_RULES.md` sections 3, 4 and 6: prerequisites, standing, earliest semester, offering, load, overlaps.
3. Send the AI only the student's answers plus the rows your code selected, and ask it to rank options and explain them in plain English.

The AI should never be the thing that decides whether a prerequisite is met or two sections overlap. Code should.

**How to read `courses.csv`**
- `prerequisites`: `ACCT 20353 AND (MATH 10283 OR MATH 10524)`. Every AND part must be finished in an earlier semester.
- `may_take_same_semester`: prerequisites that may be in the same semester instead.
- `corequisites_required`: must be in the same semester.
- `conditions`: standing, major or program restrictions, approvals. "(alternative)" means approval is another way in, not an extra requirement.
- `earliest_semester_index`: 0 = first fall, 1 = first spring, 2 = sophomore fall…
- `prereq_source`: `verified` = checked by hand against TCU's text; `parsed from TCU text` = read automatically. Show `prereq_text_original` when in doubt.
- `refs_missing_from_catalog` / `advisor_note`: known problems to send to an advisor.

**What your Class Search pull needs** (per section): course (e.g. FINA 30153), Class Nbr, section, type (LEC, LAB, LCL…), session (REG, 8W1, 8W2), days (M T W R F, R = Thursday), start and end time, mode, status (Open, Closed, Dept = department permission, Instr = instructor permission), title, and Core codes. Convert times to minutes after midnight for overlap checks. First- and second-8-week classes can share a time slot.

- `used_by`: which Neeley programs require the course or list it as an option, so the AI can tell a Finance elective from a random course.

## Decision prompt (paste as the system prompt)

```
You are the planning assistant for Neeley Blueprint, a degree planner for TCU Neeley School of Business students.

Use ONLY the attached files: NEELEY_RULES.md (rules), neeley_programs.json (program requirements) and courses.csv (every TCU course with prerequisites), plus the live Class Search sections provided for the term being scheduled. Never invent a course, course number, prerequisite, section, time, rule or approval. If something isn't in the files, say "I don't have that in TCU's data" and suggest asking a Neeley advisor.

Before recommending anything:
1. Find the student's start term. Started summer 2025 or later = the "new" rulebook and new TCU Core; earlier = "old". Apply only that rulebook.
2. List what they still need: their cohort's business requirements, each chosen program's requirements, open Core slots, and hours to 120 (36 or 42 upper-division).
3. Check combinations: at most 2 majors; no minor in the major's own field; General Business and E&I minors are not for Neeley majors; Leadership minor shares at most 6 hours.

When building a semester plan, place a course only if:
- every prerequisite group is finished in an EARLIER semester (or is listed in may_take_same_semester);
- corequisites are in the same semester;
- class standing is met (24 / 54 / 84 earned hours before that semester; label these "historical");
- "Declared business major" courses come only after ENGL 10803, ECON 10223, MATH 10283, ACCT 20353, INSC 20153 and INSC 20263 are done and the student has 24+ hours;
- the earliest-semester rule is met (no business core in the first year);
- the course is offered that season per the live Class Search data (no section in a posted term = not offered; FINA 40623 and INSC 40353 fall only; FINA 40533 and INSC 40343 spring only);
- the semester stays between 12 and 18 hours, and never more than the student asked for.
Place courses with the longest chain of later courses first. If a course can't fit, swap it for another option in the same requirement and explain exactly why.

For every course you recommend, say: the requirement it satisfies, its prerequisites, and a label: confirmed, historical (ran in 2026-27, assumed to repeat), assumed, or needs advisor.

For Core classes, prefer courses that fill two open Core slots at once and match the student's interests; avoid subjects they said they dislike; obey the Core double-counting rules for their cohort.

When picking sections: one section per course plus a lab when the course has one; no overlapping times (first- and second-8-week classes may share a slot); skip Neeley Fellows and Honors sections unless the student is in them; label sections that need permission or are full; respect their time preferences; give the Class Nbr and one backup per course.

Always surface the known data problems in NEELEY_RULES.md section 8 when they affect the student, and route them to an advisor. Never say a student is cleared to graduate, never register them, and never change their record. Career suggestions are possibilities to explore, not promises.

Write plainly: lead with the answer, one line per course, short sentences.
```

## How to make the survey better (what each answer should feed)

| Ask | Use it for |
|---|---|
| First semester at TCU (dropdown) | Picks the rulebook. This is the most important question. |
| Target graduation (dropdown) | Number of semesters to plan |
| Interests (search + chips) | Ranking majors and minors (`match_tags` in `neeley_programs.json`) and Core picks (match against course titles and descriptions in `courses.csv`) |
| Jobs that sound interesting (search + chips, include "Not sure yet") | Major and minor ranking; which application programs to show (`opportunities`) |
| People vs numbers, structure vs creative, safe vs risky (toggles) | Tie-breakers in the major ranking |
| Subjects you enjoy / want to skip (chips) | Core picks: reward enjoyed subjects, penalize skipped ones |
| AP credit (chips with scores) | Completed courses: AP Micro 4+ → ECON 10223, AP Macro 4+ → ECON 10233, AP Calc AB 3 → MATH 10283, AB 4-5 → MATH 10524, AP Stats → MATH 10043 |
| Math placement (dropdown) | No placement adds MATH 10273 before MATH 10283 |
| Semester load (dropdown: 15 / 16 / 18) | Max hours per semester |
| Study abroad semester (dropdown) | Keeps single-season courses out of that term |
| Morning / Friday / evening preferences (dropdowns) | Section scoring |
| Current students: completed courses (search over `courses.csv`, or paste a list) | What's already done; flag codes not in the file |

Keep it to four short steps with three or fewer questions per screen. Use pick-lists instead of text boxes. Every question must change the plan or the schedule; if it doesn't, cut it.

## What's verified and what isn't

- **Verified by hand against TCU's text:** prerequisites for the 151 courses that any Neeley major, minor or certificate requires or lists as an option (labeled `verified` in `courses.csv`; 20 also cross-checked on the live catalog). The other 3,737 courses are read automatically from TCU's text (`parsed from TCU text`); `prereq_text_original` is there to check them.
- **From official pages, with conflicts flagged:** all program requirements in `neeley_programs.json`.
- **Not confirmed for 2026-27:** class-standing cutoffs, the catalog-year rule, and whether first-year business students count as "business majors" for course gates. All are labeled in the files.
- **Not published by TCU:** the Sustainable Business Certificate's full course list and the Fintech Scholar Certificate's requirements.

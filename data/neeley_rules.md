# TCU Neeley degree-planning rules (AI reference)

**What this is:** the rules an AI must follow when it recommends programs, builds a semester plan or picks class sections for a TCU Neeley School of Business student. Built 2026-10-17 from official TCU sources (listed at the end). Pair it with the data files in this folder:

| File | What it holds |
|---|---|
| `neeley_programs.json` | All 7 Neeley majors + the Real Estate concentration, 8 minors (including the 2 not open to Neeley majors) and 5 certificates, with exact course requirements; both rulebooks (cohorts); Core rules; earliest-semester rules; standing; application programs |
| `courses.csv` | All 3,888 courses in TCU's course list (from the course export CSV): credits, prerequisites as AND/OR, same-semester allowances, corequisites, conditions, minimum grade, Core tags, season rules, earliest semester, and which Neeley programs use each course |

**Not included on purpose:** section times, seats and status. Those change every term; pull them live from TCU Class Search (section 6 says which fields the AI needs).

**Ground rules for the AI**
1. Use only courses, numbers and rules found in these files, and only sections from your live Class Search pull. Never invent one.
2. Every recommended course must name the requirement it satisfies and how sure we are: **confirmed** (official source or posted section), **historical** (ran in 2026-27, assumed to repeat), **assumed** (a rule we could not confirm), or **needs advisor**.
3. When the files contradict each other or are silent, say so and send it to the advisor. Do not pick a side silently.
4. Never tell a student they are cleared to graduate, never register them, never change their official record. The Degree Progress Report in my.TCU is the authority.

---

## 1. Pick the right rulebook first

TCU replaced its Core Curriculum and Neeley replaced its checklists at the same time. **The student's first term at TCU decides which set applies, not today's catalog.**

| | Started **before summer 2025** (`cohorts.old`) | Started **summer 2025 or later** (`cohorts.new`) |
|---|---|---|
| Total hours | 120 (Neeley Graduation Checklist says 124: conflict, ask advisor) | 120 |
| Upper-division (30000-40000) hours | 42 | 36 |
| Hours that must be taken at TCU | 58 | 45 |
| Required for business | MATH 10283, ECON 10223, ECON 10233, ENGL 10803, ENGL 20803 | same |
| Business foundation | BUSI 10153, BUSI 10151, INSC 20153, ACCT 20353, INSC 20263, ENTR 20153 | INSC 20153, ACCT 20353, INSC 20263 |
| Business core | 19 hrs: FINA 30153, BUSI 30383, INSC 30313, INSC 30801, MANA 30153, MARK 30153, MANA 40153 | 16 hrs: ENTR 20263, FINA 30153, INSC 30313, INSC 30801, MANA 30250 + partner (see section 8), MARK 30153 |
| Core Curriculum | Old Core (3 groups) | New Core (4 competencies) |

A current junior or senior almost always started before summer 2025. An incoming freshman is always on the new rules.

**GPA:** graduation needs a 2.50 cumulative GPA and a 2.5 GPA in the major.

---

## 2. Neeley progression: what has to happen before what

1. **First year (pre-major "business student"):** to stay in Neeley after year one, a student needs 24 hours, a 2.75 cumulative GPA, ENGL 10803, ECON 10223 and MATH 10283 (or MATH 10524) for a letter grade, and both **Microsoft Office Specialist** certifications.
2. **MOS certifications:** Excel by **Nov 11** of the first fall and PowerPoint by **Apr 7** of the first spring (dates for Fall 2026 entrants; $75 per attempt, booked through my.TCU). Passing Excel is the prerequisite for INSC 20153.
3. **Declaring a major:** 3.0 cumulative GPA, 2.75 across the first-year required courses, and ENGL 10803, ECON 10223, MATH 10283, ACCT 20353, INSC 20153, INSC 20263 completed by the semester they declare.
4. **Changing into Neeley from another TCU major:** 3.25 TCU GPA, an application and essay, and a 2.75 GPA across ENGL 10803, ECON 10223, ECON 10233 and MATH 10283. Windows: Sept 21–Dec 4, 2026; Mar 29–Apr 30, 2027; Jun 1–Jul 23, 2027.

**Class standing** (earned hours before the semester starts): sophomore 24, junior 54, senior 84. These come from older TCU catalogs and are not confirmed for 2026-27. Use them, label them "historical," and list them for the advisor.

---

## 3. When a course can go in a semester

A course may be placed in a semester only if **all** of these hold:

1. **Prerequisites.** `courses.csv` → `prerequisites` is written as AND of OR-groups, e.g. `ACCT 20353 AND (MATH 10283 OR MATH 10524)`. Every group must be met by a course finished in an **earlier** semester. A course listed in `may_take_same_semester` may be in the same semester instead.
   - "A, or B, or C and D" means A OR B OR (C AND D). In the file it appears as `(A OR B OR C) AND (A OR B OR D)`.
   - Read `min_grade` (C-, C, B) and tell the student when a grade below it would block the next course.
2. **Corequisites.** Courses in `corequisites_required` must be in the same semester, and their sections must not overlap.
3. **Class standing.** If `conditions` says Sophomore/Junior/Senior standing, the hours earned before that semester must meet section 2.
4. **Major status.**
   - "Declared business major" means the six declare-major courses (section 2) are done and the student has 24+ hours.
   - "Business major" alone: TCU does not say whether first-year business students count. Use the earliest-semester rule below and list it for the advisor.
   - Other restrictions, such as "Leadership minor only," "BIS majors only," "Accounting majors only" or "admission to the certificate," must be met.
5. **Earliest semester** (from TCU's official after-summer-2025 four-year plans). Semester index: 0 = first fall, 1 = first spring, 2 = sophomore fall, 3 = sophomore spring, 4 = junior fall, and so on. For a current student, index ≈ hours completed ÷ 15.
   - **Hard (never earlier):**
     - ECON 10233 ≥ 1
     - INSC 20153 ≥ 1
     - ACCT 20353 ≥ 2
     - INSC 20263 ≥ 2
     - ENTR 20263 ≥ 3
     - FINA 30153 ≥ 3
     - INSC 30313 ≥ 3
     - MANA 30250 / MANA 30253 ≥ 3
     - ACCT 30153 ≥ 3
     - INSC 30801 ≥ 4
     - any other 30000-40000 ACCT, BUSI, ENTR, FINA, INSC, MANA or MARK course ≥ 3
   - **Soft (prefer later, move earlier only if needed; never delay a course that other planned courses require, e.g. MARK 30153 for a Marketing major):**
     - ENGL 20803 ≥ 3
     - COMM 10123 ≥ 2
     - MARK 30153 ≥ 5
     - BUSI 30383 ≥ 5
   - A typical Neeley first year is ENGL 10803, ECON 10223, MATH 10283, ECON 10233, INSC 20153 and Core classes. No business core.
6. **Offered that semester.** Check your live Class Search pull for that term.
   - A course with a section in that term is **confirmed**.
   - **A posted term with no section for the course = not offered. Never place it there.**
   - Future terms that aren't posted yet: use the same season from the most recent year in your pull (label **historical**: "ran last fall, assumed to repeat").
   - A course that hasn't run in any term you've pulled is **unverified**: it may be retired or replaced, so flag it.
   - `season_rule` in `courses.csv` overrides all of this: FINA 40623 and INSC 40353 are fall only; FINA 40533 and INSC 40343 are spring only (Neeley checklists). Missing the fall course in a fall-then-spring pair costs a full year (INSC 40353 → INSC 40343). In 2026-27 the BIS courses also ran in one season each (INSC 30723, 30823, 40813, 40843 in fall; INSC 30833, 30853 in spring); confirm against your pull.
7. **Load.** Full-time is 12-18 hours. More than 18 needs dean approval. Summer sessions allow at most 7 hours at a time, and the May session 4. Spread hours evenly: remaining hours ÷ remaining semesters.
8. **Study abroad.** Don't put fall-only or spring-only courses in the abroad semester.
9. **Neeley Fellows.** Students applying in their first year should hold the business core out of year one. Fellows take ACCT 20353 and MARK 30153 (sophomore fall), FINA 30153 and INSC 20263 (sophomore spring), MANA 30253 and INSC 30453 (junior fall) and BUSI 30383 (junior spring) inside the cohort, and cohort courses can't be repeated.

**Placement priority:**
1. Courses with the longest chain of later courses depending on them.
2. Business requirements.
3. Core.
4. Electives.

**If a course can't fit:** swap it for another option in the same requirement and explain why. For example: "FINA 40623 is offered only in fall; Fall 2027 is too early because FINA 30203 isn't finished until then, and Fall 2028 is your abroad semester, so the plan uses BUSI 30383." If nothing fits, say how many hours are left over and offer a summer session, a heavier load or a later graduation.

---

## 4. Building the list of courses a student needs

1. Take the cohort's business groups (section 1).
2. Add each selected program's requirements from `neeley_programs.json`:
   - `all`: every course
   - `one`: pick one option
   - `hours`: pick options until the hours are met
3. When choosing options, prefer, in order:
   1. courses already completed
   2. courses already needed for another program (double counting, but flag it when the rule is unclear)
   3. courses that match the student's interests
   4. courses with fewer new prerequisites
   - **A course fills only one choice requirement inside the same program.**
   - Don't default to application-only courses (EIF FINA 40183/40193, certificate courses) unless the student said they're applying.
4. Add any prerequisite that isn't completed or already planned (e.g. MATH 10273 when the student has no math placement for MATH 10283).
5. Fill the Core (section 5).
6. Add electives until total hours and upper-division hours are met. If upper-division hours are short, the electives must be 30000-40000 level.

**Combination rules (check before planning):**
- Up to two majors. Three won't fit in eight semesters.
- No minor in the same field as the major (Finance major + Finance minor, Accounting + Accounting minor, BIS + BIS minor).
- **General Business minor** and **Entrepreneurship & Innovation minor (non-business)** are not open to Neeley majors.
- **Global Business minor** is only for Neeley majors.
- **Leadership minor:** at most 6 hours may also count toward another major, minor or certificate.
- **Major + minor overlap:** Neeley says courses "generally cannot" count toward both. Count them once and flag for the advisor.
- **Two majors:** no Neeley rule on shared courses was found. Count shared courses once and flag.
- **Accounting and Finance minors:** the catalog says business or economics majors may pursue them; the Neeley site says only another business major. Flag for economics majors.
- **Minors:** Finance, Accounting and General Business minors need a 2.50 minor GPA, and all minor coursework must be taken at TCU after enrolling.

**Exam and transfer credit:**
- AP/IB/CLEP counts only within the first 66 college hours, posts as specific TCU courses, and has no grade. Mappings:
  - AP Micro 4+ → ECON 10223
  - AP Macro 4+ → ECON 10233
  - AP Calc AB 3 → MATH 10283; AB 4-5 → MATH 10524, which also satisfies the MATH 10283 prerequisite
  - AP Statistics → MATH 10043, not INSC 20153
- Transfer credit needs a C- or better.
- After enrolling at TCU, taking courses elsewhere needs prior written dean approval, and only up to 4 courses / 16 hours (study abroad excepted).

**Pass/No-Credit:** at most 2 courses or 8 hours. Never for any course counted toward a major, minor or associated requirement, or any Neeley business course.

---

## 5. TCU Core: any department can fill it

Core courses come from **any** TCU department. Find them in `courses.csv` → `core_attributes` (codes below). These tags came from TCU Class Search in 2026-27; your live Class Search pull is the authority if a tag changes. Required business courses already cover some slots: ECON 10223/10233 (SSC), MATH 10283 (MTH), ENGL 10803/20803 (WCO), BUSI 30383 (CA), FINA 40623 (GA), and FINA 30203, FINA 30213, ACCT 30273, ACCT 40253 (WEM). **Credit those first, then fill only the open slots.**

| Code | Category | Slots |
|---|---|---|
| MTH | Mathematics | 1 |
| NSC | Natural Sciences | 2 |
| OCO | Oral Communication | 1 |
| WCO | Written Communication I and II | 2 |
| WEM | Writing Emphasis | 2 |
| HUM | Humanities | 3 |
| SSC | Social Sciences | 3 |
| FAR | Fine Arts | 1 |
| HT | Historical Traditions | 1 |
| LT | Literary Traditions | 1 |
| RT | Religious Traditions | 1 |
| CA | Cultural Awareness | 1 |
| GA | Global Awareness | 1 |
| CSV | Citizenship & Social Values | 1 |

Both versions are 63 nominal hours, 39-63 in practice because of double counting.

**New Core (started summer 2025+)** groups:
- Critical & Creative Thinking: FAR, HUM×3, SSC×3, HT, LT, RT
- Quantitative & Scientific Reasoning: MTH, NSC×2
- Communication: OCO, WCO×2, WEM×2
- Responsible Citizenship: CA, GA, CSV

Rules:
- A course counts for **at most 2** Core categories plus WEM.
- OCO and WCO courses count only for themselves.
- At most **4** Core requirements from one subject prefix (not counting OCO and WCO).
- WEM must be 30000-40000 level and taken at TCU; transfer credit can't satisfy WEM.

**Old Core (started before summer 2025)** groups:
- Essential Competencies: MTH, OCO, WCO×2, plus WEM×2
- Human Experiences & Endeavors: HUM×3, SSC×3, NSC×2, FAR
- Heritage, Mission, Vision & Values: RT, HT, LT, CA, GA, CSV

Rules:
- No course fills two Heritage categories.
- At most 2 courses per prefix within each group.
- HUM, SSC and NSC each need two different prefixes.
- WEM can overlap anything.
- CA, GA, CSV and WEM must be taken at TCU (a 2023 guide says so; the Provost page says only WEM; ask the advisor).

**Picking Core classes that fit the student:** among courses that fill open slots, rank by:
1. how many open slots one course fills (double dipping)
2. match with the student's interests and favorite subjects
3. penalty for subjects they want to avoid

Skip:
- courses whose prerequisites aren't in the plan
- honors-only courses (HNRS, HCOL, HSPR)
- graduate courses

Prefer courses that run both fall and spring.

---

## 6. Picking class sections (schedule builder)

Only for the **next** semester, only after the advisor approves the plan (otherwise label it a preview). Section data comes from your live TCU Class Search pull. The AI needs these fields per section: course, Class Nbr, section, type (LEC, LAB, LCL…), session (REG full term, 8W1 first 8 weeks, 8W2 second 8 weeks), days (M T W R F; R = Thursday), start and end time, mode (in person or online), status (Open, Closed, Dept, Instr) and title.

**Hard rules:**
- **One section per course.** If the course has both a lecture-type section and a `LAB` section that term, pick one of each, and they must not overlap. `LCL` is a combined lecture-lab and needs no pair.
- **No overlaps.** Two meetings overlap when they share a day and each starts before the other ends.
  - `8W1` and `8W2` never overlap each other.
  - `REG` overlaps both.
- **Sections without days or times** (online, arranged, directed study) never conflict. List them separately.
- **Skip restricted sections** (titles containing "Neeley Fellows" or "Honors") unless the student is in that program.
- **Status:**
  - `Open`: fine.
  - `Dept` / `Instr`: needs department or instructor permission. Allowed, but say who to ask.
  - `Closed`: last resort, waitlist.

**Preferences** (score, then take the best valid combination):
- Penalize sections that break the student's time preferences:
  - no classes before a time
  - Fridays free
  - nothing after 5:30 p.m.
- Reward their day pattern (MWF or TR), fewer days on campus, a lunch gap, and fewer gaps over 2 hours.

**When nothing fits:** name the course and what it collides with ("every section of MARK 30113 overlaps FINA 30213"). Offer a swap with another course from the **same requirement** that has open sections. That swap doesn't need new advisor approval; a change that alters which requirements are met does.

**Show:** a weekly grid, a table with Class Nbr (the number students enter in my.TCU), section, days and time, session and status, and 1-2 backup sections per course.

**Freshman's first fall:** sections aren't posted yet. Show a preview from the same season last year in your pull, clearly labeled.

## 7. Applications and deadlines to surface early

| Program | When | What it needs | Effect on the plan |
|---|---|---|---|
| Neeley Fellows | Apply in the first year (2025 window was Feb 3–Mar 7) | 3.5 GPA each first-year semester, Honors College, ~30 per year | Hold business core out of year one |
| TIP Board | Usually sophomore year | Application; FINA 20203 needs admission and a permission number | Adds FINA 20203 |
| Educational Investment Fund | Junior year | FINA 30213 done or in progress, interview, two consecutive semesters | FINA 40183 then FINA 40193 |
| Consulting Career Preparation Course | Sophomore or junior year | Application; one graded 3-hour course | One elective |
| Professional Program in Accounting | Junior year | 3.0 GPA; starts with ACCT 30101; BBA + Master of Accounting in 5 years, GMAT waived | Adds ACCT 30101 |
| BNSF Neeley Leadership Program | Early (3-year cohort) | Selective | Its BUSI 30833/30843/40843/40853 courses form the program track of the Leadership minor |
| FinTech Certificate | Before INSC 30263/30283/30273 | Application; C or better in each | 9 hours; INSC 30273 needs INSC 30283 first |
| Consultative Selling Certificate | Before MARK 40263 | 2.5 GPA to apply; B or better in sales classes | MARK 30153, 40263, 40273, 40770 (twice) |
| Study abroad | A year ahead | Approved coursework | Keep single-season courses out of that term |

---

## 8. Known problems in TCU's own data

These are real contradictions in official sources. **Show them to the student and send them to the advisor. Never resolve them silently.**

| Problem | Evidence | What to do |
|---|---|---|
| New business core lists MANA 30250 + **MANA 30350**. MANA 30350 is not in TCU's course list. | Neeley checklists vs TCU course export | Treat as unresolved; advisor confirms |
| New four-year plans pair MANA 30250 with **MANA 40250** (Strategy), not MANA 30350 | Plans vs checklists | Probably the same course renumbered; advisor confirms |
| **Neither MANA 30250 nor MANA 40250 has a section** in Fall 2026 or Spring 2027. **MANA 30253** (OB and Strategy, 3 hrs) has 22 sections. | Class Search | Plan MANA 30253 in their place; advisor confirms |
| Checklists say take the two MANA halves **together**; plans put them a year apart | Checklists vs plans | Advisor item |
| MANA 30153 and MANA 30253 list **ACCT 20153** as a prerequisite. It doesn't exist. | Course text | Treat as ACCT 20353; advisor confirms |
| **BUSI 10153** is on older checklists and plans but not in TCU's course list. BUSI 10151 has no sections. | Course export, Class Search | Completed = fine. Still needed = advisor picks the replacement (BUSI 20151 Careers in Business looks likely). |
| ENTR 20153 (old foundation) has no 2026-27 sections | Class Search | Advisor approves a substitute (likely ENTR 20263) |
| Total hours 120 vs 124 | TCU Advising FAQ vs Neeley Graduation Checklist | Use 120; flag for older cohorts |
| Residency: 45 TCU / 36 upper-level (new checklists) vs 58 / 42 (Graduation Checklist) | Neeley pages | Use the cohort's numbers; flag |
| Accounting major: 21 hrs (program page) vs 31.5-33 (major page) vs 25.5 + 9-12 associated (checklist, which adds graduate-numbered ACCT 55450/55460) | Catalog vs checklist | Advisor confirms |
| Global Business minor parts add to 24 hrs but it's published as 18 | Catalog | Plan the parts; flag |
| BIS minor's last 6 hours: the page doesn't say how many to pick from the "OR" block | Catalog | Assume 2 courses; flag |
| Class standing hour cutoffs not confirmed for 2026-27 | Older catalogs only | Use 24/54/84; flag |
| Whether first-year business students count as "business majors" for course gates | Not stated | Use earliest-semester rules; flag |
| Sustainable Business Certificate total hours not published; Fintech Scholar Certificate has no published requirements | Neeley pages | Never mark complete; advisor |
| Energy Certificate is a graduate certificate | Ralph Lowe Energy Institute | Not available to undergraduates |
| Management major: the catalog requires MANA 40153; the after-summer-2025 checklist lists MANA 30313 instead and adds MANA 40323 as an elective | Catalog vs checklist | Plan the catalog list; flag |
| Supply & Value Chain major: catalog = 3 required + 12 elective hours; checklist = 8 fixed courses (22 hrs), no electives | Catalog vs checklist | Plan the catalog list; flag |
| Accounting major also needs graduate-numbered ethics ACCT 55450 + 55460 and 6 hrs of career content (ACCT 55153 / 55253 / 55303); checklist adds a 1.5-hr ACCT elective and a legal-content choice | Catalog + checklist | Include; ACCT 55xxx needs ACCT 30253 and ACCT 30273 first |
| Finance with Real Estate: choosing FINA 40623 for global content adds a 1.5-hr ethics course, but the 55000-level ethics courses need ACCT 30253 and ACCT 30273 (not in this major) and the 30000-level versions aren't scheduled | Catalog, Class Search | Steer to BUSI 30383; flag |
| Finance electives: FINA 40970 counts only for the topics Alternative Asset Investments and Equity Investments Practicum | Catalog | Check the section title before counting it |
| BIS major: current catalog has no elective; INSC 40383 is required. INSC 30273 may replace INSC 40843 and INSC 30283 may replace INSC 30833 | Catalog | Use the substitutions in `neeley_programs.json` |
| FAME 30213 and FAME 40293 are listed as Supply & Value Chain electives, but their own text restricts them to Merchandising majors | Catalog vs course text | Don't pick them by default; flag |
| FINA 30313 is a Finance elective option but is restricted to Real Estate concentration majors | Course text | Only offer it to Real Estate students |
| Marketing checklist lists MARK 40033, which isn't in TCU's course list (catalog has MARK 40030) | Checklist vs export | Use MARK 40030; flag |
| Leadership minor has two tracks: standard (MANA 30833, 30843, 40213, 40343, 40853 + 1 elective) and BNSF Neeley Leadership Program (BUSI 30833, 30843, 40843, 40853), which only adds up to 15 of the 18 hours | Catalog | Flag the program track |

---

## 9. What the AI should say, and how

- **Lead with the answer:** "You can finish by May 2029 at about 16 hours a semester."
- **Explain each course in one line:** "FINA 30213 Investments: Finance major requirement; also counts as Writing Emphasis; needs FINA 30153 first."
- **Career suggestions are possibilities to explore,** never promises: "Students interested in investment banking often take…".
- **For anything flagged, say what's uncertain and who decides:** "This needs your advisor's approval because…"
- **Cost of an extra semester** (TCU 2026-27, financialaid.tcu.edu):
  - tuition $33,260 (half of $66,520)
  - housing and food about $9,390 on campus
  - a later start to full-time pay
  - Keep the student's cost separate from the university's (TCU gains tuition from an extra semester).

---

## Sources

- TCU undergraduate catalog (2026-2027, pages unlabeled): https://undergraduate.catalog.tcu.edu/ (Core: /pages/M1TbuvPKvvRxtdUoaexi; Neeley majors and minors under /colleges/business/)
- Neeley checklists and four-year plans: https://www.neeley.tcu.edu/bba/fina-checklist-after-summer2025, https://www.neeley.tcu.edu/bba/fina-4year-plan-after-summer-2025, https://neeley.tcu.edu/bba/fina-checklist and the acct-, mana-, mark-, bis- variants
- Neeley first-year and change-of-major requirements: https://www.neeley.tcu.edu/bba/first-year-admission-requirements, https://neeley.tcu.edu/BBA/Change-of-Major-Requirements
- Neeley Graduation Checklist: https://www.neeley.tcu.edu/BBA/Graduation-Checklist
- TCU Advising FAQ: https://tcu.edu/academics/advising/faq.php
- Registrar enrollment, grading and transfer policies: https://registrar.tcu.edu/current-students/enrollment/policies.php, https://registrar.tcu.edu/current-students/enrollment/grading.php, https://registrar.tcu.edu/prospective-students/transfer-credit.php
- Credit by exam: https://admissions.tcu.edu/apply/freshman/college-credits/credit-by-exam.php
- Core guides: https://provost.tcu.edu/faculty-resources/core-curriculum/core-curriculum-students/, https://studentsuccess.tcu.edu/wp-content/uploads/2023/05/2023-Advising-Guide.pdf
- TCU Class Search (public; used on 2026-10-17 to find Core tags, single-season courses and courses with no sections): https://classes.tcu.edu/Default.aspx
- TCU course export `courses-report.2026-10-17.csv` (provided by the team)
- Cost of attendance 2026-27: https://financialaid.tcu.edu/cost/cost-of-attendance/undergraduate.php

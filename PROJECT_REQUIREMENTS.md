Project Requirements: The Graduation Blueprint
Competition: Neeley AI Forward: AI Innovation Competition (Advanced Track) Project: AI academic planning assistant for TCU Neeley School of Business students Source document: Business Case (case study brief) Status: Draft v0.1 Last updated: 2026-10-17

1. Purpose and Scope
1.1 Problem statement
Neeley students make course decisions each semester that affect graduation date, tuition cost, and career preparation. Requirements, prerequisites, course availability, section times, and program rules interact in ways students often don't see, and advisors have limited time to explore every pathway. The result is confusion, missed opportunities, and avoidable extra semesters.

1.2 Project goal
Build a reusable AI academic planning assistant that combines verified TCU requirements with a student's academic record, interests, and goals to produce an accurate, personalized, evidence-based, semester-by-semester graduation plan. The assistant must explain its reasoning, flag uncertainty, compare alternative paths, and route decisions that need official approval to a human advisor.

1.3 Guiding principles
Accuracy over polish. A plan with wrong courses, outdated requirements, or an infeasible timeline is a failure, however well presented.
Evidence, not memory. Every material academic claim is grounded in an official TCU source, never in model memory or general assumptions about universities.
Support advisors, don't replace them. The tool informs decisions; it does not make official ones.
Transparent uncertainty. Confirmed facts, historical patterns, forecasts, and assumptions are always distinguished.
1.4 In scope
Part 1 (Map): requirements map, course dependency analysis, findings table, Sharpest Bottleneck.
Part 2 (Build and Decide): working, reusable planning assistant, validation, and a 12-month implementation recommendation.
Four final deliverables (see Section 10).
1.5 Out of scope
Changing a student's official record, major, minor, or registration.
Issuing official graduation clearance.
Approving substitutions, exceptions, or transfer credit evaluations.
Guaranteeing employment outcomes or future course offerings.
2. Stakeholders and Users
Stakeholder	Role / interest
Neeley undergraduate students (primary users)	Understand remaining requirements, plan to graduation, explore options
Academic advisors	Receive escalations; spend more time on complex cases
Registrar	Authoritative owner of catalog, policies, records, schedules
Neeley School administration	Sponsor; on-time graduation and student outcomes
Career services	Source for career and graduate-school alignment information
Independent reviewer	Verifies academic correctness of test plans
Competition judges	Evaluate against the criteria in Section 11
3. Part 1 Requirements: Map
ID	Requirement	Priority
MAP-01	Produce a requirements map showing how university-wide (TCU Core / foundational), Neeley, major, minor, elective, prerequisite, and credit-hour rules interact for at least two different student profiles.	Must
MAP-02	Produce a course dependency analysis: prerequisite chains, bottleneck courses, and scheduling constraints that can affect graduation.	Must
MAP-03	Deliver a findings table with at least five findings, one row per finding, each containing: Finding (one plain-English sentence), Evidence (source, catalog year, course number, or policy), Student impact (estimate with assumptions shown), Affected students, and Confidence (High / Medium / Low).	Must
MAP-04	Identify the Sharpest Bottleneck: the single most consequential and least obvious planning issue found.	Must
MAP-05	Investigate each risk scenario in Section 3.1 and identify additional scenarios beyond those listed.	Must
MAP-06	For each risk, classify whether it can be detected automatically, needs more information, or must be referred to an advisor.	Must
3.1 Risk scenarios to investigate
Scenario	Description
Prerequisite bottlenecks	Infrequently offered course gating several advanced courses
Course availability mismatches	Needed course not offered in the needed term, or section conflicts
Hidden degree constraints	Overlooked credit minimum, upper-level hours, foundational course, residency rule
Late major/minor changes	Unclear which completed credits transfer to the new program
Overlapping requirements	Double major or major+minor restrictions on shared credits; unrealistic sequence
Career-alignment gaps	Minimum requirements met but no career-relevant coursework or experiences
False confidence	AI invents a requirement, uses outdated catalog, or assumes future offerings
Registration constraints	Valid plan made impractical by section times, restrictions, capacity, or workload
4. Part 2 Functional Requirements: Build and Decide
4.1 Student intake and profile
ID	Requirement	Priority
FR-01	Collect the student's declared major, degree program, school, and catalog year.	Must
FR-02	Collect completed courses, in-progress courses, grades, earned credits, and transfer credits / approved substitutions where available.	Must
FR-03	Collect intended graduation date, preferred course formats, preferred class times, and maximum semester workload.	Must
FR-04	Collect post-graduation interests: career fields, industries, graduate/professional school plans, internship / research / leadership / study-abroad interests, skills to develop, subjects enjoyed, and courses to avoid.	Must
FR-05	Collect potential majors, minors, certificates, or concentrations under consideration.	Must
FR-06	Allow the student to correct their profile at any time.	Must
FR-07	Support hypothetical "what-if" scenarios (e.g., add a minor, change major) that never alter the official record.	Must
FR-08	Accept profile data from an authorized degree audit / record export, or from manual entry when records are unavailable (labeled as student-reported).	Should
4.2 Requirements and course knowledge base
ID	Requirement	Priority
FR-10	Maintain a structured representation of degree requirements: TCU Core, Neeley requirements, major, minor, certificate, credit-hour totals, upper-level hours, minimum grades, residency, and other graduation rules.	Must
FR-11	Scope every requirement by applicability: all students, Neeley only, specific major, specific catalog year, or specific circumstance.	Must
FR-12	Represent prerequisites, corequisites, required sequences, and enrollment restrictions as a queryable dependency graph.	Must
FR-13	Map each course to every requirement it can satisfy, including permitted alternatives.	Must
FR-14	Encode rules for double-counting / overlapping credits across majors, minors, and Core.	Must
FR-15	Store course offerings with an explicit evidence level: Confirmed (published schedule), Historical pattern, Forecast, or Assumption.	Must
FR-16	Store section data (meeting days/times, delivery format, location, instructor, capacity, enrollment status) when authorized data is available.	Should
FR-17	Attach source metadata to every requirement and course record: authoritative origin / owner, date or version, and catalog year governed.	Must
FR-18	Allow academic data to be updated without rebuilding the application (e.g., data files or database separate from logic).	Must
4.3 Analysis and planning engine
ID	Requirement	Priority
FR-20	Perform a remaining-requirements analysis applying completed and in-progress courses to the correct requirements.	Must
FR-21	Generate a semester-by-semester plan through the intended graduation date.	Must
FR-22	Ensure the plan satisfies prerequisites/corequisites in sequence, total and upper-level credit hours, and workload limits.	Must
FR-23	Check known section meeting times for schedule conflicts.	Must
FR-24	Place required courses only in terms with verified availability, or explicitly label the placement as an assumption.	Must
FR-25	Detect and report prerequisite problems, scheduling conflicts, missing information, and potential graduation delays.	Must
FR-26	Incorporate interests and career goals into elective, minor, and certificate recommendations.	Must
FR-27	Generate at least one alternative plan (e.g., add a minor, change major, prioritize a career interest).	Must
FR-28	Produce a trade-off comparison between plans: added requirements, credit hours, scheduling implications, workload, graduation date impact, and estimated cost impact.	Must
FR-29	When a bottleneck or conflict is found, propose an evidence-supported alternative if one exists, or state that none was found.	Must
4.4 Explanation, transparency, and escalation
ID	Requirement	Priority
FR-30	Explain why each recommended course is included and which requirement it satisfies.	Must
FR-31	Provide source references for every material academic claim.	Must
FR-32	Display clear warnings when future offerings, policies, transfer credits, or other details are unverified.	Must
FR-33	Visually and verbally distinguish official requirements from suggested electives and career-oriented recommendations.	Must
FR-34	Present career suggestions as possibilities to explore, never as guarantees or claims that a major is required for a career.	Must
FR-35	Provide an advisor-review pathway for substitutions, exceptions, transfer evaluations, policy interpretation, and any decision needing official approval.	Must
FR-36	Detect incomplete, outdated, or conflicting information and decline to present an unsupported plan as fact.	Must
FR-37	Never state that a student is officially cleared to graduate.	Must
FR-38	Let students question, correct, or challenge any recommendation.	Must
FR-39	Produce an exportable plan summary a student can bring to an advisor meeting.	Should
5. Data Requirements
5.1 Required sources
Source	Purpose	Owner / origin
Official TCU undergraduate catalog (per catalog year)	Requirements, policies, course descriptions	Registrar
Official degree maps; major, minor, and Core requirements	Requirements map, plan generation	Neeley / Registrar
Official course descriptions, numbers, credit hours, prereqs, coreqs	Course knowledge base	Registrar
Current and planned course schedules (sections, times, formats)	Availability and conflict checks	Registrar / class search
Policies: degree completion, transfer credit, substitutions, overlap, graduation eligibility	Rule enforcement and escalation triggers	Registrar
Authorized degree audits or sample academic records	Test cases	Registrar / authorized students
Official advising guidance	Escalation rules, best practices	Neeley Advising
Career and graduate-school prerequisite information	Career alignment	Career services; reliable external sources
5.2 Data rules
ID	Requirement
DR-01	Every source record carries: owner/origin, date or version, catalog year governed.
DR-02	Confirmed facts, historical patterns, forecasts, and assumptions are stored and displayed as distinct categories.
DR-03	A course offered every fall historically is never shown as guaranteed for a future fall.
DR-04	Where live registration or student records are unavailable, the limitation is documented and clearly labeled sample data is used.
DR-05	The system never invents courses, course numbers, section times, requirements, or approval decisions.
6. Non-Functional Requirements
ID	Category	Requirement
NFR-01	Accuracy	Requirements, course numbers, prerequisites, and plans must match authoritative sources in all validated test cases.
NFR-02	Reusability	Works for any student profile without code changes.
NFR-03	Maintainability	Academic data updatable independently of application logic; catalog-year versioning supported.
NFR-04	Traceability	Every recommendation traceable to a source record.
NFR-05	Usability	Understandable by a typical undergraduate without training; no new system to "learn to navigate."
NFR-06	Fairness	Evaluated across different majors, academic histories, and student circumstances.
NFR-07	Determinism of rules	Hard constraints (prereqs, credits, conflicts) are checked by deterministic logic, not by LLM judgment alone. (Design recommendation to prevent false confidence.)
7. Responsible AI and Privacy Requirements
ID	Requirement
RAI-01	Use student records only with appropriate authorization and access controls.
RAI-02	Minimize personal information collected; retain only as long as needed.
RAI-03	Do not use private student records to train or improve models without required authorization.
RAI-04	Identify the official source for each important degree requirement.
RAI-05	Distinguish official requirements from suggestions.
RAI-06	Never guarantee future availability or graduation eligibility without sufficient evidence.
RAI-07	Never automatically change a student's major, minor, registration, or record.
RAI-08	Refer substitutions, exceptions, and approval decisions to the appropriate authority.
RAI-09	Comply with FERPA for any handling of student education records.
8. Required Demonstration Scenarios (Acceptance Tests)
ID	Scenario	Pass criteria
SC-1	On-time graduation. Student provides completed courses and major.	Remaining requirements correctly identified; feasible plan meets the intended graduation date.
SC-2	Adding a minor. Student adds a minor based on a career interest.	Original vs. proposed plan compared; additional requirements, scheduling implications, and graduation impact explained.
SC-3	Prerequisite bottleneck. Required course unavailable in preferred term or conflicts with another required class.	Problem detected; evidence-supported alternative proposed, or absence of one stated.
SC-4	The AI gets it wrong. Incomplete, outdated, or conflicting input.	Uncertainty detected; unsupported plan not presented as fact; student directed to advisor or official resource.
9. Validation Requirements
For each test case, verify and record:

Every required course and credit-hour condition is accounted for.
Completed courses are applied to the correct requirements.
Prerequisites and corequisites are satisfied in proper sequence.
Course meeting times do not conflict.
Required courses are placed in verified-availability terms, or labeled as assumptions.
Plan respects academic policies and student constraints.
Proposed graduation date is supported by requirements and course information.
Uncertainty and need for official approval are clearly communicated.
Additional validation requirements:

ID	Requirement
VAL-01	At least one independent reviewer (advisor, registrar representative, or person with authoritative access) verifies academic correctness of the test plans.
VAL-02	Report all results, including errors, failed scenarios, and cases where the assistant correctly declined to give a definitive answer.
VAL-03	Document at least one instance where the AI was wrong or uncertain and how the team handled it.
10. Deliverables
ID	Deliverable	Required contents
D-A	Pitch deck with appendix	Problem, findings, Sharpest Bottleneck, solution, demo, validation results, implementation recommendation, expected impact. Appendix: sources, test cases, plan comparisons, assumptions, calculations, limitations.
D-B	Reusable AI build	Working prototype / assistant / tool / no-code workflow usable with another student profile. A one-off conversation or non-functional mockup does not qualify.
D-C	"How we built it" report	Tools and data sources; how TCU data was collected, structured, validated; profile and requirement representation; key prompts/workflows/components; how recommendations were checked; an AI-was-wrong instance; what we'd improve with another week.
D-D	Impact and implementation plan	12-month roadmap, partnerships, estimated resources, proposed pilot, success metrics, expansion criteria.
10.1 Implementation proposal (Decide) must address
Topic	Question to answer
Solution	What does the tool do and how do students use it?
Data	Which sources, how updated, what permissions?
Users	Who is served first; how are advisors supported, not replaced?
Implementation	Technical resources, staff, partnerships, budget
Impact	How to measure planning accuracy, student understanding, on-time readiness
Alternatives	Two other approaches considered and why rejected
Risks	Inaccurate recommendations, schedule changes, privacy, overreliance on AI
Evidence	Pilot results that justify expansion, or cause change/stop
Financial impact	Estimate of avoided extra semesters, separating total tuition + living costs, marginal costs actually avoided, and effects on the university vs. the student
11. Evaluation Criteria (Traceability)
Judging criterion	Primary requirements
Academic accuracy	FR-10 to FR-14, FR-20, NFR-01, Section 9
Graduation feasibility	FR-21 to FR-25, SC-1, SC-3
Personalization	FR-04, FR-26, FR-27, SC-2
Evidence and transparency	FR-17, FR-30 to FR-33, DR-01, DR-02
Problem-solving	MAP-02, MAP-04, FR-25, FR-29
Technical execution	FR-18, NFR-02, NFR-03, D-B
Responsible AI	Section 7, FR-35 to FR-37, SC-4
Practical impact	Section 10.1, D-D
12. Assumptions, Constraints, and Open Questions
Assumptions
Live registration and individual student record access may be unavailable during the competition; labeled sample data will substitute (DR-04).
The current catalog year and published schedules are the baseline; other catalog years are supported only where loaded.
Constraints
Must rely on official TCU information, not model knowledge.
Must not modify official records or issue approvals.
Open questions
Which two student profiles (majors / catalog years) will be used for the requirements map?
What access can we obtain to the class schedule, degree audit exports, and historical offering data?
Who will serve as the independent reviewer, and when are they available?
What platform will the build use (custom app, custom GPT/assistant, no-code workflow)?
Which minor and career interest will be used for Scenario 2?
What tuition, fee, and living-cost figures and sources will support the financial impact estimate?
Neeley AI Forward: AI Innovation Competition
Advanced Track Case Study
The Graduation Blueprint: Build the Plan, Find the Path
Can AI help every TCU Neeley student build a degree plan that gets them to graduation on time while connecting their academic choices to the career and life they want after college?
College students make decisions every semester that can affect their graduation date, tuition costs, career preparation, and future opportunities. Build an AI-powered academic planning system that turns TCU’s Neeley School of Business degree requirements, course offerings, and students’ individual interests into an accurate, personalized, and actionable graduation plan.
The goal is not to create another chatbot that answers registration questions. It is to build a reusable AI tool that understands the requirements, evaluates the options, identifies potential obstacles, and helps students make informed academic decisions.
A polished AI-generated degree plan earns nothing if the courses are wrong, the requirements are outdated, or the student cannot graduate on time.
Background
Choosing college classes is one of the most consequential decisions students make, yet many students do not fully understand how their individual choices fit into the bigger picture.
At Texas Christian University, Neeley School of Business, students must navigate degree requirements, foundational courses, major and minor requirements, prerequisites, course availability, class schedules, and individual academic interests. They must also consider how their education prepares them for internships, graduate school, and their intended careers.
These decisions are interconnected. A student might select a class because it sounds interesting without realizing that another course is a prerequisite for a required upper-level class. A student might discover a minor late in college and learn that the additional coursework conflicts with remaining major requirements. Another might change majors without understanding how many credits will still apply toward graduation.
Students may have access to academic advisors and registrar resources, but navigating complex requirements can be difficult, particularly when students have different interests, academic histories, and career goals. Advisors have limited time to understand every student’s circumstances and explore every possible academic pathway.
The result can be unnecessary confusion, missed opportunities, delayed graduation, and additional tuition and living expenses.
The opportunity: Build an AI academic planning assistant that gives students a clearer understanding of their options before they register for classes, change majors, decide on double majors, add minors, gain certificates or make other decisions that affect their degree progress.
The system should combine verified university requirements with a student’s academic record, interests, and goals to create a personalized, evidence-based plan. It should also identify when human advisor review is necessary rather than pretending every academic decision can be automated.
The Challenge
This case has two parts: Part 1: Map and Part 2: Build and Decide.
Part 1: Map — Understand the requirements and find the risks
Teams must investigate how TCU’s academic requirements and course offerings fit together. They should identify the information needed to build accurate degree plans, the common situations that can delay graduation, and the academic choices students may not realize are available to them.
Teams must go beyond a generic explanation of degree requirements. The objective is to uncover the specific dependencies, scheduling conflicts, and decision points that can materially change a student’s path to graduation.
Part 2: Build and Decide — Create a working academic planning assistant
Teams must build a reusable AI tool that takes a student’s academic history, current degree requirements, interests, and career goals and produces a realistic degree plan.
The tool must demonstrate that it can do more than recommend classes. It must account for required courses, prerequisites, semester availability, class meeting times, credit requirements, and other relevant constraints. It must explain why it recommends a particular path, flag uncertainty, and show students the consequences of alternative choices.
Teams must defend their design decisions and demonstrate that the system’s recommendations are accurate enough to be useful in a real academic planning environment.
1. What the AI system needs to know
The assistant should build its recommendations from reliable, current, and appropriately authorized TCU academic information.
A. Degree requirements and graduation rules
The system should understand the applicable requirements for each student’s degree, including:
•      University-wide foundational and general education requirements for Neeley School of Business
•      Major-specific and degree-specific course requirements.
•      Minor and certificate requirements, where applicable.
•      Required credit hours and upper-level coursework.
•      Prerequisites, corequisites, and required course sequences.
•      Minimum grades, residency requirements, and other applicable graduation rules.
•      Requirements associated with the student’s catalog year and academic program.
•      Rules governing overlapping credits, double-counting courses, and combining majors or minors, where permitted.
•      Transfer credits, completed courses, in-progress coursework, and approved substitutions, where available.
The system could distinguish between a requirement that applies to every student and at the minimum that applies only to Neeley School of Business, major, catalog year, or academic circumstance.
B. Course catalog and registration information
The system should have access to an authoritative, searchable course database that includes:
•      Course titles, subject codes, course numbers, descriptions, and credit hours.
•      Prerequisites, corequisites, restrictions, and enrollment eligibility.
•      Which degree, major, minor, or foundational requirements each course can satisfy.
•      Planned semester offerings and historical offering patterns, clearly distinguished from confirmed offerings.
•      Actual course sections, meeting days and times, locations or delivery formats, and instructors when available.
•      Section capacity, enrollment status, and registration restrictions when authorized data is available.
•      Alternative courses that may satisfy the same requirement.
•      Course conflicts and prerequisite chains that affect future semesters.
For example, the assistant should understand that recommending a required course is not enough if that course is not offered in the semester the student needs it, or if its meeting time conflicts with another required class.
C. The student’s individual academic profile
With appropriate authorization, the system should use the student’s:
•      Declared major, degree program, school, and catalog year.
•      Completed and in-progress courses.
•      Earned credits and grades relevant to prerequisites and requirements.
•      Remaining degree requirements.
•      Current schedule and registration constraints.
•      Potential majors, minors, certificates, or concentrations under consideration.
•      Preferred course formats, class times, and semester workload.
•      Intended graduation date and academic planning priorities.
Students should be able to correct their profile, explore hypothetical changes, and compare different degree paths without those scenarios automatically changing their official academic record.
D. Interests and post-graduation goals
A degree plan should reflect more than the minimum requirements for graduation. The system should ask students about their interests and intended next steps, such as:
•      Intended career fields and industries.
•      Potential graduate or professional school plans.
•      Internship, research, leadership, and study-abroad interests.
•      Skills they want to develop.
•      Minors, certificates, electives, and interdisciplinary coursework they want to explore.
•      Academic subjects they enjoy and courses they want to avoid when reasonable alternatives exist.
The assistant should connect these goals to relevant academic options and explain the trade-offs.
For example, a student interested in consulting might compare a plan that prioritizes graduating on time with one that includes an additional minor, relevant electives, or coursework that develops analytical skills. The system should explain the benefits, added requirements, scheduling implications, and any effect on the expected graduation date.
Career suggestions must be presented as possibilities to explore, not guarantees of employment or claims that a particular major is necessary for a specific career.
2. Where the important problems hide
A basic degree audit can show students what they have completed and what remains. The challenge is to anticipate how their decisions affect the path ahead. Teams should investigate the following scenarios and identify additional ones.
•      Prerequisite bottlenecks: A required course is offered infrequently or must be completed before several advanced courses. Missing it could delay graduation by a semester or more.
•      Course availability mismatches: A student needs a particular course in a specific semester, but the course is not scheduled then or the planned section conflicts with another requirement.
•      Hidden degree constraints: A student believes all requirements are satisfied but has overlooked a credit-hour minimum, upper-level requirement, foundational course, residency rule, or another applicable graduation condition.
•      Late major or minor changes: A student changes academic direction without understanding which completed credits apply to the new program and which requirements remain.
•      Overlapping requirements: A student wants two majors or a major and minor, but the proposed combination has restrictions on shared credits or creates an unrealistic sequence.
•      Career-alignment gaps: A student is completing the minimum requirements but has not explored coursework or academic experiences relevant to their intended career or further education.
•      False confidence: An AI system recommends a course, invents a requirement, uses an outdated catalog, or assumes that a course will be offered in a future semester without evidence.
•      Registration constraints: A theoretically valid plan becomes impractical because of section times, enrollment restrictions, course capacity, or the student’s maximum manageable workload.
Teams should determine which problems can be detected automatically, which require additional information, and which must be referred to a qualified academic advisor.
3. Source material
The assistant must rely on actual TCU academic information rather than model memory or assumptions about how universities generally work. Teams should identify and, where authorized, load the following materials:
•      The official TCU undergraduate catalog applicable to the student’s catalog year.
•      Official degree maps, major requirements, minor requirements, and foundational curriculum requirements.
•      Official course descriptions, course numbers, credit hours, prerequisites, and corequisites.
•      Current and planned course schedules, including section meeting times and delivery formats.
•      Official policies governing degree completion, credit transfer, substitutions, overlapping requirements, and graduation eligibility.
•      Authorized student degree audits or academic records for test cases.
•      Official advising guidance and registrar documentation.
•      Career and graduate-school prerequisite information from reliable sources when relevant to the student’s goals.
Each source should have an owner or authoritative origin, a date or version, and a clear indication of which academic year or catalog it governs.
The system must distinguish among confirmed facts, historical patterns, forecasts, and assumptions. For example, a course that was offered every fall in previous years should not automatically be represented as guaranteed to run next fall.
Where access to live registration systems or individual academic records is unavailable, teams must explicitly document that limitation and use appropriately labeled sample data or authorized alternatives.
4. Minimum expectations
Part 1: Map
Teams must deliver:
•      A requirements map: Show how university-wide requirements, major requirements, minor requirements, electives, prerequisites, and credit-hour rules interact for at least two different student profiles.
•      A course dependency analysis: Identify prerequisite chains, courses that can create bottlenecks, and scheduling constraints that may affect graduation.
•      At least five findings: Present the most important risks or opportunities in a table with one row per finding. Each finding must include:
–     Finding: One plain-English sentence describing the issue.
–     Evidence: The official source, catalog year, course number, policy, or other documentation supporting the finding.
–     Student impact: An estimate of the effect on graduation timing, credit requirements, workload, cost, or academic opportunities, with assumptions shown.
–     Affected students: Which types of students or degree paths are most likely to encounter the issue.
–     Confidence: High, medium, or low, based on the quality and completeness of the evidence.
Teams must identify their Sharpest Bottleneck: the single most consequential and least obvious academic planning issue discovered through their analysis.
Part 2: Build and Decide
Teams must build and demonstrate a working, reusable AI academic planning assistant. The minimum functionality must include:
•      A student intake process that collects relevant academic information and post-graduation interests.
•      A structured representation of applicable degree requirements and course prerequisites.
•      A remaining-requirements analysis that identifies what the student still needs to complete.
•      A semester-by-semester degree plan through the intended graduation date.
•      Course recommendations that account for requirements, prerequisites, credits, and known section times.
•      Detection of prerequisite problems, scheduling conflicts, missing information, and potential graduation delays.
•      An explanation of why each recommended course is included and which requirement it satisfies.
•      At least one alternative plan, such as adding a minor, changing a major, or prioritizing a career interest.
•      A comparison of the trade-offs between the proposed paths.
•      Source references for material academic claims.
•      Clear warnings when future offerings, policies, transfer credits, or other details are unverified.
•      An advisor-review pathway for decisions that require official approval or interpretation.
The tool must be reusable for a different student’s academic profile and should be designed so that its underlying academic data can be updated without rebuilding the entire application.
Required demonstration scenarios
Teams must test the assistant against realistic scenarios, including:
•      Scenario 1: The student who wants to graduate on time. A student provides their completed courses and current major. The assistant identifies remaining requirements and produces a feasible plan to meet the intended graduation date.
•      Scenario 2: The student considering a minor. A student wants to add a minor based on a career interest. The assistant compares the original degree plan with the proposed plan and explains the additional requirements, scheduling implications, and potential graduation impact.
•      Scenario 3: The prerequisite bottleneck. A required course is unavailable in the student’s preferred semester or conflicts with another required class. The assistant identifies the problem and proposes an evidence-supported alternative, if one exists.
•      Scenario 4: The AI gets it wrong. Teams must test a case containing incomplete, outdated, or conflicting information and demonstrate how the system detects uncertainty, avoids presenting an unsupported plan as fact, and directs the student to the appropriate advisor or official resource.
5. Validation: Prove the plan is accurate
An attractive interface and a convincing explanation are not proof that a degree plan works. Teams must validate the assistant using independently checked academic scenarios. For each test case, verify:
•      Every required course and credit-hour condition is accounted for.
•      Completed courses are applied to the correct requirements.
•      Prerequisites and corequisites are satisfied in the proper sequence.
•      Course meeting times do not conflict.
•      Required courses are scheduled in semesters when their availability is verified, or are explicitly labeled as assumptions.
•      The plan respects applicable academic policies and student constraints.
•      The proposed graduation date is supported by the requirements and available course information.
•      Any uncertainty or need for official approval is clearly communicated.
Teams must report their results, including errors, failed scenarios, and cases in which the assistant correctly declined to provide a definitive answer.
At least one independent reviewer should verify the academic correctness of the test plans. The reviewer could be a qualified academic advisor, registrar representative, or other person with access to authoritative degree requirements.
The system should never claim that a student is officially cleared to graduate solely because its own analysis indicates that all requirements appear satisfied.
6. Decide: Make the case for your solution
Take the role of a team proposing an AI academic planning solution for TCU. Recommend one implementation strategy for the next 12 months. Your proposal must explain:
•      The solution: What will the tool do, and how will students use it?
•      The data: Which authoritative sources are needed, how will they be updated, and what permissions are required?
•      The users: Which students should be served first, and how will the system support rather than replace academic advisors?
•      The implementation: What technical resources, staff, partnerships, and budget would be required?
•      The impact: How will you measure whether the tool improves planning accuracy, student understanding, and on-time graduation readiness?
•      The alternatives: Which two other approaches did you consider, and why did you reject them?
•      The risks: What could go wrong with inaccurate recommendations, changing course schedules, student privacy, or overreliance on AI?
•      The evidence: What results from a pilot would justify expanding the system, and what results would cause you to change or stop the project?
Teams should estimate the potential financial impact of preventing avoidable additional semesters. Calculations must clearly distinguish between total tuition and living expenses, marginal costs actually avoided, and any revenue or costs that would affect the university differently from the student.
The goal is not to promise that AI can eliminate every graduation delay. It is to demonstrate that a well-designed system can help students make better-informed decisions and give advisors more time to focus on complex individual situations.
7. Responsible AI and student protections
The tool must be designed around accuracy, transparency, and student trust.
•      Use student records only with appropriate authorization and access controls.
•      Minimize the personal information collected and retain it only as needed.
•      Do not use private student records to train or improve models without the required authorization.
•      Clearly identify the official source supporting each important degree requirement.
•      Distinguish official requirements from suggested electives and career-oriented recommendations.
•      Never invent courses, course numbers, section times, requirements, or approval decisions.
•      Do not guarantee future course availability or graduation eligibility without sufficient evidence.
•      Do not automatically change a student’s official major, minor, registration, or academic record.
•      Refer course substitutions, exceptions, and other decisions requiring university approval to the appropriate authority.
•      Ensure students can question, correct, or challenge the assistant’s recommendations.
•      Evaluate whether recommendations work across different majors, academic histories, and student circumstances.
The guiding principle: AI should make academic planning more understandable and accessible, not create another system students must learn to navigate or another source of misinformation.
8. Final deliverables
Each team must submit:
A. Pitch deck with appendix
The presentation must include the problem, findings, Sharpest Bottleneck, proposed solution, system demonstration, validation results, implementation recommendation, and expected impact. The appendix should include supporting academic sources, test cases, degree-plan comparisons, assumptions, calculations, and known limitations.
B. A reusable AI build
Submit a working prototype, custom AI assistant, structured academic planning tool, no-code workflow, or application that can be used with another student profile. A one-time conversation or a mockup that cannot evaluate real academic requirements does not satisfy this requirement.
C. How we built it
Provide a report documenting:
•      The tools and data sources used.
•      How TCU academic information was collected, structured, and validated.
•      How student profiles and requirements were represented.
•      The most important prompts, workflows, or technical components.
•      How recommendations were checked against authoritative requirements.
•      At least one instance in which the AI was wrong or uncertain and how the team handled it.
•      What the team would improve with another week of work.
D. Impact and implementation plan
Provide a practical 12-month roadmap, including required partnerships, estimated resources, a proposed pilot, success metrics, and criteria for expanding the system.
9. How the solution will be evaluated
The purpose of this competition is to reward a useful, evidence-based system, not simply a sophisticated AI interface. Teams should be prepared to demonstrate:
•      Academic accuracy: Are the requirements, course numbers, prerequisites, and degree plans correct?
•      Graduation feasibility: Does the plan realistically account for course sequencing, availability, meeting times, and student constraints?
•      Personalization: Does it meaningfully incorporate a student’s academic interests and post-graduation goals?
•      Evidence and transparency: Can students trace recommendations back to authoritative sources?
•      Problem-solving: Does the tool uncover bottlenecks and offer viable alternatives?
•      Technical execution: Is the build functional, reusable, and maintainable?
•      Responsible AI: Does the system protect student data and recognize its limitations?
•      Practical impact: Is there a credible path to improving student decision-making and advisor efficiency?
Teams should be ready to explain not only what their assistant can do, but also what it cannot safely or reliably do.
The ultimate question
What if every TCU student could understand their remaining degree requirements, see a realistic path to graduation, explore academic opportunities aligned with their interests, and understand the consequences of changing that path, before making a decision that costs them another semester?
The strongest solution will not simply tell a student which classes to take. It will help them understand why those classes matter, what options they have, and what each choice will cost them before they commit to it.


// Rule-based assistant used when Claude isn't reachable. It answers only from the same verified tools,
// so a live demo keeps working without network access. Replies are templated, not generated.

import type { ChatResult, ChatTurn } from "./chat";
import { runTool, type ToolContext } from "./tools";
import type { planSummary } from "./tools";
import type { comparePlans } from "../engine/compare";
import type { Recommendations } from "../careers";

type Summary = ReturnType<typeof planSummary>;

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

export function offlineReply(ctx: ToolContext, history: ChatTurn[], notice: string): ChatResult {
  const last = (history.filter((t) => t.role === "user").pop()?.content ?? "").toLowerCase();
  const toolsUsed: string[] = [];
  const tool = <T>(name: string, input: Record<string, unknown> = {}) => {
    toolsUsed.push(name);
    return runTool(ctx, name, input) as T;
  };
  const done = (reply: string, chips: string[] = []): ChatResult => {
    if (chips.length) ctx.actions.push({ type: "chips", chips });
    return { reply, actions: ctx.actions, studentPatch: ctx.studentPatch, mode: "offline", toolsUsed, notice };
  };
  const s = ctx.student;
  const undecided = ctx.programs.includes("BBA-UNDECIDED");

  // Survey answers come back as a structured message from the survey card
  if (last.startsWith("survey answers:")) {
    const rec = tool<Recommendations & { error?: string }>("career_recommendations");
    if (rec.error) return done(rec.error);
    const plan = tool<Summary>("build_plan");
    const sv = s.survey;
    const lines: string[] = [];
    if (rec.stage === "explore") {
      const m = rec.majors?.[0];
      const a = rec.areas?.[0];
      lines.push(
        `Thanks${sv?.hometown ? `, and hello from ${sv.hometown}` : ""}. Since you're early in college, I matched you to majors and career areas to explore. Your strongest fit is **${m?.name}** (${m?.score}% match), and the top career area is **${a?.name}** (${a?.score}%). The bars below show how closely each one lines up with your answers; they're possibilities, not predictions.`,
      );
    } else {
      const r = rec.roles?.[0];
      const co = rec.companies?.slice(0, 3).map((x) => x.name).join(", ");
      lines.push(
        `Thanks. As a ${rec.year}, here are specific roles to target. Your best fit is **${r?.name}** (${r?.score}% match). ${rec.internships?.[0] ? `${rec.internships[0].apply}.` : ""} Best-fit companies to research: ${co}. They're examples, not current openings.`,
      );
    }
    const changes: string[] = [];
    if (sv?.workload === "light") changes.push("semesters capped at 15 hours");
    if (sv?.studyAbroad?.plan === "yes" && sv.studyAbroad.term) changes.push(`${sv.studyAbroad.term} held for study abroad (Core and electives only)`);
    if (sv?.fridaysFree) changes.push("Fridays kept free when building your schedule");
    if (sv?.targetGradTerm) changes.push(`target graduation set to ${sv.targetGradTerm}`);
    lines.push(
      `**Your plan, updated:** ${changes.length ? changes.join("; ") + "." : "no schedule changes."} It now finishes **${plan.graduation}**${plan.onTime ? " (on target)" : ` (target ${plan.target})`} with ${plan.passedChecks} of 10 checks passing.${plan.failedChecks.length ? ` Trade-off to discuss: ${plan.failedChecks[0]}.` : ""} [Source: ${rec.source}]`,
    );
    ctx.actions.push({ type: "show_blueprint", programs: ctx.programs });
    return done(lines.join("\n\n"), undecided ? ["What if I lean toward Finance?", "What electives fit my goals?"] : ["How does FinTech fit into my timeline?", "What needs advisor sign-off?"]);
  }

  if (has(last, "career", "not sure", "unsure", "undecided", "don't know what", "dont know what")) {
    tool("offer_career_survey");
    return done("That's common, and you have time: every Neeley major starts with the same lower-division courses. The Planning Survey takes about two minutes and helps me suggest paths and shape your plan. It doesn't change anything on your official record.");
  }

  if (has(last, "fintech", "certificate")) {
    const cmp = tool<{ comparison: ReturnType<typeof comparePlans>; whatIf: { swaps: string[]; advisorItems: string[] } }>("compare_programs", { add: ["CERT-FINTECH"] });
    ctx.actions.push({ type: "show_blueprint", programs: [...ctx.programs, "CERT-FINTECH"] });
    const rows = cmp.comparison.rows.map((r) => `- ${r.label}: ${r.a} → ${r.b}`).join("\n");
    return done(
      `Here's how the FinTech Certificate fits, compared with your current plan:\n${rows}\n\n${cmp.comparison.summary} INSC 30273 and INSC 30283 count toward both FinTech and your BIS major, which needs dean approval (up to 6 shared credits per major).${cmp.whatIf.swaps.length ? `\n\nTo stay on time the plan makes one swap: ${cmp.whatIf.swaps[0]}` : ""}\n\nThis is a what-if; your official record doesn't change. [Source: TCU 2026-27 catalog: FinTech Certificate; Academic Policies]`,
      ["What needs advisor sign-off?", "Why is INSC 30263 in spring?"],
    );
  }

  if (has(last, "lean toward finance", "finance major", "what if i") && undecided) {
    const cmp = tool<{ comparison: ReturnType<typeof comparePlans> }>("compare_programs", { add: ["BBA-FINA"], remove: ["BBA-UNDECIDED"] });
    ctx.actions.push({ type: "show_blueprint", programs: ["BBA-FINA"] });
    return done(
      `If you lean toward Finance, the first three semesters stay the same. The changes start once you advance into the major:\n${cmp.comparison.rows.map((r) => `- ${r.label}: ${r.a} → ${r.b}`).join("\n")}\n\nAdded courses include ${cmp.comparison.added.slice(0, 6).join(", ")}. [Source: TCU 2026-27 catalog: Finance, BBA]`,
      ["Show my 4-year plan", "What electives fit my goals?"],
    );
  }

  if (has(last, "advisor", "sign-off", "sign off", "approval", "approve")) {
    const plan = tool<Summary>("build_plan");
    return done(
      `These items need an advisor before you register:\n${plan.advisorItems.map((a) => `- **${a.title}.** ${a.detail}`).join("\n")}\n\nWhen you send your plan for review, these go with it.`,
      ["Open my plan"],
    );
  }

  const code = /([a-z]{4})\s?(\d{5})/.exec(last);
  if (code) {
    const c = tool<Record<string, unknown>>("explain_course", { code: `${code[1]} ${code[2]}` });
    if (c.error) return done(String(c.error));
    const offer = (c.offering as { term: string; status: string; note: string }[]).map((o) => `- ${o.term}: ${o.status} (${o.note})`).join("\n");
    return done(
      `**${c.code}: ${c.title}** (${c.credits ?? "variable"} hours)\n- Prerequisites: ${(c.prerequisites as string[]).join("; ") || "none"}\n- Fills: ${(c.fillsRequirements as string[]).join(", ") || "elective credit"}\n${offer}\n[Source: ${c.source}]`,
    );
  }

  if (has(last, "elective", "fit my goals", "interested in")) {
    const q = s.survey?.interests?.[0] ?? (has(last, "data") ? "data" : "finance");
    const hits = tool<{ code: string; title: string }[]>("search_courses", { query: q, subjects: ["FINA", "INSC", "ACCT", "MARK", "MANA", "BUSI", "ENTR"] });
    return done(`Courses that match "${q}":\n${hits.map((h) => `- ${h.code}: ${h.title}`).join("\n")}\n\nAsk about any of them and I'll check prerequisites and when it's offered.`);
  }

  if (has(last, "plan", "on track", "right track", "graduate", "on time", "blueprint")) {
    const plan = tool<Summary>("build_plan");
    if (has(last, "show", "open", "blueprint", "4-year", "plan")) ctx.actions.push({ type: "show_blueprint", programs: ctx.programs });
    const next = plan.terms.find((t) => t.status === "planned");
    return done(
      `${plan.onTime ? "Yes, you're on track" : "Not quite on track yet"}: the plan finishes **${plan.graduation}** (target ${plan.target}) with ${plan.totals.hours} of ${plan.totals.required} hours. ${plan.passedChecks} of 10 checks pass.${plan.failedChecks.length ? ` Open issues: ${plan.failedChecks.join("; ")}.` : ""}\n\nNext semester (${next?.term}): ${next?.courses.map((c) => c.code ?? c.title).join(", ")}.\n\n${plan.advisorItems.length} item${plan.advisorItems.length === 1 ? "" : "s"} need an advisor. [Source: ${plan.cohort} rules, TCU 2026-27 catalog]`,
      undecided ? ["I'm not sure what career I want", "Show my 4-year plan"] : ["How does FinTech fit into my timeline?", "What needs advisor sign-off?"],
    );
  }

  const prof = tool<{ hoursEarned: number; hoursInProgress: number; programs: string[] }>("get_student_profile");
  return done(
    `Hi ${s.name.split(" ")[0]}. I've loaded your planning profile: ${prof.programs.join(" + ")}, ${prof.hoursEarned} hours earned and ${prof.hoursInProgress} in progress, target ${s.targetGradTerm}. Ask me about your plan, a course, or a what-if like adding a certificate.`,
    undecided ? ["Am I on the right track?", "I'm not sure what career I want"] : ["Am I on track to graduate?", "How does FinTech fit into my timeline?"],
  );
}

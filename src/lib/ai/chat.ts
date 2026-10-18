// Claude chat loop with tool use. Claude explains and asks; the engine decides placements.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Dataset } from "../engine/load";
import type { Student } from "../engine/types";
import { offlineReply } from "./offline";
import { TOOL_DEFS, runTool, type ToolContext, type UiAction } from "./tools";

export const MODEL = "claude-opus-5-5";

const SYSTEM = `You are Graduation Blueprint, an academic planning assistant for students in TCU's Neeley School of Business.

How you work:
- Every course number, requirement, prerequisite, offering, and graduation date you mention must come from a tool result in this conversation. If a tool didn't return it, say you don't have verified data and point the student to their advisor or the catalog. Never invent courses, section times, requirements, or approvals.
- The planning engine builds and validates plans. You explain them: why each course is there, which requirement it fills, and what changes under alternatives. Use compare_programs for any "what if I add/drop X" question.
- Say how sure you are. Availability labels mean: confirmed (on the posted schedule), historical (offered that season before, assumed to repeat, not guaranteed), assumed (no schedule evidence), advisor (needs an advisor to confirm). Mention when data is sample or provisional.
- Point out the items that need an advisor (transfer credit, permissions, shared credit between programs, data conflicts). Never say a student is cleared to graduate or registered; advisor review and my.tcu.edu registration are separate steps.
- Career suggestions are possibilities to explore, never guarantees of jobs or claims that a major is required for a career.
- When a student is unsure about direction or hasn't taken the Planning Survey, call offer_career_survey.
- When a message starts with "Survey answers:", the survey is already saved to the profile. Call career_recommendations and build_plan. The app shows the recommendations as a card with match bars right under your reply, so don't repeat every item. Write 2 short paragraphs: (1) the top one or two matches and why they fit this student's answers (for incoming, freshman and sophomore students: majors and career areas; for juniors and seniors: job titles, the internship timing, and the best-fit companies, which are examples to research, not openings); (2) what changed in the plan from their answers (semester load, study abroad term, graduation target, Fridays), including any trade-off such as a later graduation date.
- After a substantive answer, call suggest_replies with 2-3 short next questions, and call show_blueprint when the student should review the full plan.
- Only state an approval or permission requirement (dean, department, instructor, registrar) when a tool result in this conversation states it; quote it rather than paraphrase. The rules reference is background, not a source for a student's requirements.
- Never move courses between terms or build a schedule yourself. If a student asks to move a course, use the tools; if no tool can test the move, say so and send them to their advisor.
- Write plainly and briefly: short paragraphs, a few bullets when listing courses. Cite sources inline in the form [Source: ...] using the source strings tools return. No headings.`;

const COURSE_CODE = /\b[A-Z]{3,4} \d{5}\b/g;
const APPROVAL = /\b(dean|department(?:al)?|instructor|registrar)['’]?s?\s+(approval|permission|consent|sign-?off|override)\b/gi;

/**
 * Grounding check on a draft reply: every course code must appear in a tool result or the conversation,
 * and every dean/department/instructor/registrar requirement must appear in a tool result.
 */
export function ungrounded(reply: string, evidence: string, conversation: string): string[] {
  const ev = evidence.toLowerCase();
  const codes = [...new Set(reply.match(COURSE_CODE) ?? [])].filter((c) => !evidence.includes(c) && !conversation.includes(c));
  const approvals = [...new Set([...reply.matchAll(APPROVAL)].map((m) => m[0].toLowerCase()))].filter((p) => {
    const who = p.split(/[\s’']/)[0].replace(/al$/, "");
    return !ev.includes(p) && !new RegExp(`${who}[^.]{0,40}(approval|permission|consent)|(approval|permission|consent)[^.]{0,40}${who}`).test(ev);
  });
  return [...codes, ...approvals.map((p) => `"${p}"`)];
}

/** Neeley rules reference (from the planning pack), sent as a cached system block for explanations. */
function rulesReference(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "data", "neeley_rules.md"), "utf8");
  } catch {
    return "";
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  reply: string;
  actions: UiAction[];
  studentPatch: Partial<Student>;
  mode: "claude" | "offline";
  toolsUsed: string[];
  notice?: string;
}

export async function chat(ds: Dataset, student: Student, programs: string[], history: ChatTurn[]): Promise<ChatResult> {
  const ctx: ToolContext = { ds, student, programs, actions: [], studentPatch: {} };
  const toolsUsed: string[] = [];

  if (process.env.BLUEPRINT_OFFLINE === "1") return offlineReply(ctx, history, "Offline demo mode is on (BLUEPRINT_OFFLINE=1).");

  const client = new Anthropic();
  const RULES = rulesReference();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  const context = `Student context (sample data for the demo): ${student.name}, ${student.programs.join(" + ")}, current term ${student.currentTerm}, target ${student.targetGradTerm}. Program ids available: ${Object.keys(ds.programs.programs).join(", ")}.`;

  // Everything the engine returned this turn, and what was said in the conversation: the grounding check's sources
  const evidence: string[] = [];
  const conversation = history.map((t) => t.content).join("\n");
  let rechecked = false;
  // Claude often writes its answer alongside its tool calls, so text from every step of the turn is kept
  let drafts: string[] = [];

  try {
    for (let i = 0; i < 8; i++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [
          { type: "text", text: SYSTEM },
          ...(RULES
            ? [{ type: "text" as const, text: `Reference: Neeley planning rules (use for explanations only; the planning engine's tool results decide placements and win if they differ).

${RULES}`, cache_control: { type: "ephemeral" as const } }]
            : []),
          { type: "text", text: context },
        ],
        tools: TOOL_DEFS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return { reply: "I can't help with that one. Your Neeley academic advisor can.", actions: ctx.actions, studentPatch: ctx.studentPatch, mode: "claude", toolsUsed };
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      const stepText = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (stepText) drafts.push(stepText);
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const reply = drafts.join("\n\n").trim();
        // Every answer must start from engine data: a reply written without any tool call goes back once
        if (!toolsUsed.length && !rechecked) {
          rechecked = true;
          drafts = [];
          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content: "Automatic grounding check (not from the student): you answered without calling any tools. Call the planning tools first (get_student_profile, build_plan, explain_course or search_courses as needed), then rewrite the whole reply from their results.",
          });
          continue;
        }
        const unverified = ungrounded(reply, evidence.join("\n"), conversation);
        if (unverified.length && !rechecked) {
          // One automatic retry: Claude verifies with the tools or removes what it can't back up
          rechecked = true;
          drafts = [];
          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content: `Automatic grounding check (not from the student): your reply mentions ${unverified.join(", ")}, which no tool result in this conversation supports. Verify each with the tools (explain_course, search_courses, build_plan) or remove it, then rewrite the whole reply for the student.`,
          });
          continue;
        }
        return {
          reply,
          actions: ctx.actions,
          studentPatch: ctx.studentPatch,
          mode: "claude",
          toolsUsed,
          ...(unverified.length ? { notice: `Not verified against TCU data: ${unverified.join(", ")}. Check these with your advisor.` } : {}),
        };
      }
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
        toolsUsed.push(tu.name);
        try {
          const out = runTool(ctx, tu.name, (tu.input ?? {}) as Record<string, unknown>);
          const json = JSON.stringify(out);
          evidence.push(json);
          return { type: "tool_result", tool_use_id: tu.id, content: json };
        } catch (err) {
          return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Tool failed: ${(err as Error).message}` };
        }
      });
      messages.push({ role: "user", content: results });
    }
    return { reply: "That took more steps than expected. Try asking a narrower question.", actions: ctx.actions, studentPatch: ctx.studentPatch, mode: "claude", toolsUsed };
  } catch (err) {
    // No credentials or network: fall back to the rule-based assistant that uses the same verified tools
    const why =
      err instanceof Anthropic.AuthenticationError
        ? "No Claude API credentials found; set ANTHROPIC_API_KEY."
        : err instanceof Anthropic.RateLimitError
          ? "Claude is rate limited right now."
          : err instanceof Anthropic.APIError
            ? `Claude API error ${err.status ?? ""}.`
            : (err as Error).message?.includes("apiKey") || (err as Error).message?.includes("credentials")
              ? "No Claude API credentials found; set ANTHROPIC_API_KEY."
              : "Couldn't reach Claude.";
    return offlineReply({ ...ctx, actions: [], studentPatch: {} }, history, `Offline mode: ${why}`);
  }
}

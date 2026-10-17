// Reads an uploaded transcript or degree-audit screenshot with Claude and proposes profile entries.
// Nothing is applied until the student confirms the parsed list on screen.

import Anthropic from "@anthropic-ai/sdk";
import type { Dataset } from "../engine/load";
import { courseTitle } from "../engine/load";
import { MODEL } from "./chat";

export interface ParsedCourse {
  code: string;
  title: string;
  grade?: string;
  term?: string;
  transferFrom?: string;
  status: "completed" | "in-progress";
  known: boolean;
}

export interface TranscriptResult {
  courses: ParsedCourse[];
  warnings: string[];
  mode: "claude" | "offline";
}

const EXTRACT_TOOL = {
  name: "record_courses",
  description: "Record every course row found on the transcript or audit.",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      courses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Subject code, e.g. FINA" },
            number: { type: "string", description: "5-digit catalog number" },
            grade: { type: "string", description: "Letter grade, P, TR, IP (in progress), or empty" },
            term: { type: "string", description: "e.g. Fall 2025, or empty" },
            transferFrom: { type: "string", description: "Institution name if transfer credit, else empty" },
          },
          required: ["subject", "number", "grade", "term", "transferFrom"],
          additionalProperties: false,
        },
      },
      unreadable: { type: "string", description: "Anything that couldn't be read clearly, or empty" },
    },
    required: ["courses", "unreadable"],
    additionalProperties: false,
  },
};

export async function parseTranscript(ds: Dataset, file: { data: string; mediaType: string }): Promise<TranscriptResult> {
  const client = new Anthropic();
  const block: Anthropic.Beta.BetaContentBlockParam =
    file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } }
      : { type: "image", source: { type: "base64", media_type: file.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: file.data } };
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    tools: [EXTRACT_TOOL],
    messages: [
      {
        role: "user",
        content: [
          block,
          { type: "text", text: "Extract every course row from this transcript or degree audit using the record_courses tool. Copy codes and grades exactly as printed; leave a field empty rather than guessing." },
        ],
      },
    ],
  });
  const use = response.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
  if (!use) return { courses: [], warnings: ["Couldn't read any course rows. Try a clearer screenshot or enter courses manually."], mode: "claude" };
  const input = use.input as { courses: { subject: string; number: string; grade: string; term: string; transferFrom: string }[]; unreadable: string };
  const warnings: string[] = [];
  if (input.unreadable) warnings.push(`Unclear on the document: ${input.unreadable}`);
  const courses = input.courses.map((r) => {
    const code = `${r.subject.toUpperCase().trim()} ${r.number.trim()}`;
    const known = ds.courses.has(code);
    if (!known) warnings.push(`${code} isn't in the TCU course data; check it or ask the registrar.`);
    return {
      code,
      title: courseTitle(ds.courses.get(code), code),
      grade: r.grade || undefined,
      term: r.term || undefined,
      transferFrom: r.transferFrom || undefined,
      status: (r.grade === "IP" || !r.grade ? "in-progress" : "completed") as ParsedCourse["status"],
      known,
    };
  });
  return { courses, warnings, mode: "claude" };
}

import { loadData } from "@/lib/engine/load";
import { chat, type ChatTurn } from "@/lib/ai/chat";
import { bad, handle, json, resolveStudent } from "@/lib/api";
import type { Student } from "@/lib/engine/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  return handle(async () => {
    const body = ((await req.json().catch(() => null)) ?? {}) as { studentId?: string; student?: Partial<Student>; programs?: string[]; messages?: ChatTurn[] };
    if (!Array.isArray(body.messages) || body.messages.length === 0) return bad("messages are required");
    const history = body.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    // The API requires the first message to come from the user
    while (history.length && history[0].role !== "user") history.shift();
    if (!history.length) return bad("No user message");
    const ds = loadData();
    const { student } = await resolveStudent(body.studentId, body.student);
    const programs = body.programs?.length ? body.programs : student.programs;
    return json(await chat(ds, student, programs, history));
  });
}

import { loadData } from "@/lib/engine/load";
import { runTool } from "@/lib/ai/tools";
import { bad, handle, json, resolveStudent } from "@/lib/api";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) return bad("code is required");
    const ds = loadData();
    const { student } = await resolveStudent(url.searchParams.get("studentId") ?? undefined);
    return json(runTool({ ds, student, programs: student.programs, actions: [], studentPatch: {} }, "explain_course", { code }));
  });
}

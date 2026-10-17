import { loadData, courseTitle } from "@/lib/engine/load";
import { parseTranscript } from "@/lib/ai/transcript";
import { bad, json, resolveStudent } from "@/lib/api";

export const maxDuration = 120;
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const studentId = String(form?.get("studentId") ?? "");
  if (!(file instanceof File)) return bad("Upload a PDF or image file");
  if (!TYPES.includes(file.type)) return bad("Use a PDF, PNG, JPG, WEBP, or GIF file");
  if (file.size > 20 * 1024 * 1024) return bad("File is larger than 20 MB");
  const ds = loadData();
  if (process.env.BLUEPRINT_OFFLINE !== "1") {
    try {
      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      return json(await parseTranscript(ds, { data, mediaType: file.type }));
    } catch {
      // fall through to the offline sample
    }
  }
  // Offline: show the stored sample record so the confirm/correct step can still be demonstrated
  try {
    const { student: s } = await resolveStudent(studentId || undefined);
    const rows = [
      ...s.completed.map((c) => ({ code: c.code, title: courseTitle(ds.courses.get(c.code), c.code), grade: c.grade, term: c.term, transferFrom: c.transfer?.from, status: "completed" as const, known: ds.courses.has(c.code) })),
      ...s.inProgress.map((c) => ({ code: c.code, title: courseTitle(ds.courses.get(c.code), c.code), grade: "IP", term: c.term, status: "in-progress" as const, known: ds.courses.has(c.code) })),
    ];
    return json({
      courses: rows,
      warnings: ["Offline mode: showing the sample student's stored record instead of reading the file."],
      mode: "offline",
    });
  } catch (e) {
    return bad((e as Error).message, 500);
  }
}

// Who is signed in, plus everything the app needs to start: the student's record (from the database),
// program options and survey options. Advisors get the list of students instead.
import { listStudents, loadData, loadStudent } from "@/lib/engine/load";
import { handle, HttpError, json, sandboxStudent } from "@/lib/api";
import { dbEnabled, getViewer, loadStudentFromDb, supabaseServer } from "@/lib/db";
import { interestOptions, loadCareers } from "@/lib/careers";

export async function GET(req: Request) {
  return handle(async () => {
    const ds = loadData();
    const common = {
      programs: Object.values(ds.programs.programs).map((p) => ({ id: p.id, name: p.name, kind: p.kind })),
      surveyOptions: { interests: interestOptions(), locations: Object.keys(loadCareers().locations) },
      dataNotes: ds.dataNotes,
      database: dbEnabled(),
    };
    const requested = new URL(req.url).searchParams.get("id") ?? undefined;

    if (!dbEnabled()) {
      // Local mode without Supabase: sample JSON files, student picked by id
      const students = listStudents();
      const id = requested ?? students[0]?.id;
      return json({ ...common, viewer: null, students, student: id ? sandboxStudent(loadStudent(id)) : null });
    }

    const sb = await supabaseServer();
    const viewer = await getViewer(sb);
    if (!viewer) throw new HttpError(401, "Sign in first");
    if (viewer.role === "advisor") {
      const { data } = await sb.from("students").select("key, name, tag").order("name");
      const students = (data ?? []).map((s) => ({ id: s.key as string, name: s.name as string, tag: (s.tag as string) ?? "" }));
      const key = requested ?? students[0]?.id;
      const record = key ? await loadStudentFromDb(sb, key) : null;
      return json({ ...common, viewer, students, student: record ? sandboxStudent(record) : null, recordSources: record?.recordSources ?? {} });
    }
    const record = viewer.studentKey ? await loadStudentFromDb(sb, viewer.studentKey) : null;
    if (!record) throw new HttpError(404, "No student record is linked to this account");
    return json({ ...common, viewer, students: [], student: sandboxStudent(record), recordSources: record.recordSources });
  });
}

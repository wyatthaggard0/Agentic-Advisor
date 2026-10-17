"use client";

import { useCallback, useEffect, useState } from "react";
import { Header, type Tab } from "@/components/Header";
import { ChatTab } from "@/components/ChatTab";
import { BlueprintTab } from "@/components/BlueprintTab";
import { ScheduleTab } from "@/components/ScheduleTab";
import { uid, type StudentState } from "@/components/types";
import type { Student } from "@/lib/engine/types";
import type { SurveyOptions } from "@/components/SurveyForm";

function greeting(s: Student): StudentState["messages"][number] {
  const undecided = s.programs.includes("BBA-UNDECIDED");
  return {
    id: uid(),
    role: "assistant",
    content: undecided
      ? `Hi ${s.name.split(" ")[0]}. I've loaded your planning profile: first semester (${s.currentTerm}), ${s.inProgress.length} courses in progress, no major chosen yet. Ask me anything about your degree, or pick a starting point.`
      : `Hi ${s.name.split(" ")[0]}. I've loaded your planning profile from your last degree audit. To plan accurately, upload your latest unofficial transcript or a screenshot of your audit, and I'll show you what I read before using it. You can also just ask a question.`,
    chips: undecided
      ? ["Am I on the right track?", "I'm not sure what career I want"]
      : ["Am I on track to graduate?", "How does FinTech fit into my timeline?"],
  };
}

export default function Home() {
  const [students, setStudents] = useState<{ id: string; name: string; tag: string }[]>([]);
  const [sid, setSid] = useState("");
  const [tab, setTab] = useState<Tab>("chat");
  const [states, setStates] = useState<Record<string, StudentState>>({});
  const [programOptions, setProgramOptions] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [toastMsg, setToastMsg] = useState("");
  const [surveyOptions, setSurveyOptions] = useState<SurveyOptions>({ interests: [], locations: [] });
  const [viewerName, setViewerName] = useState("");

  // Loads the signed-in student's record from the database (or, for advisors and local mode, the picked student)
  const loadStudent = useCallback(async (id?: string) => {
    const res = await fetch(`/api/me${id ? `?id=${encodeURIComponent(id)}` : ""}`);
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const d = await res.json();
    if (!res.ok || !d.student) return;
    setProgramOptions(d.programs);
    if (d.surveyOptions) setSurveyOptions(d.surveyOptions);
    // Students only ever see themselves; advisors and local mode get a student picker
    setStudents(d.viewer?.role === "student" ? [] : d.students ?? []);
    if (d.viewer) setViewerName(d.viewer.displayName);
    setStates((prev) => (prev[d.student.id] ? prev : { ...prev, [d.student.id]: { student: d.student, programs: d.student.programs, messages: [greeting(d.student)] } }));
    setSid(d.student.id);
  }, []);

  useEffect(() => {
    // Deep links for demos: #plan, #schedule, #maya, #maya-plan (picking a student works for advisors / local mode)
    const h = window.location.hash.slice(1);
    const [a, b] = h.split("-");
    const t = (b ?? a) as Tab;
    if (["chat", "plan", "schedule"].includes(t)) setTab(t);
    loadStudent(a === "maya" || a === "jordan" ? a : undefined);
  }, [loadStudent]);

  const pickStudent = (id: string) => (states[id] ? setSid(id) : loadStudent(id));

  const update = useCallback(
    (fn: (s: StudentState) => StudentState) => setStates((prev) => (prev[sid] ? { ...prev, [sid]: fn(prev[sid]) } : prev)),
    [sid],
  );
  const toast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(""), 2800);
  };

  const state = states[sid];
  return (
    <>
      <Header students={students} studentId={sid} onStudent={pickStudent} tab={tab} onTab={setTab} viewerName={viewerName} />
      <main className="wrap">
        {!state ? (
          <p className="modebadge">Loading…</p>
        ) : tab === "chat" ? (
          <ChatTab
            key={sid}
            studentId={sid}
            state={state}
            update={update}
            surveyOptions={surveyOptions}
            onOpenPlan={(programs) => {
              if (programs?.length) update((s) => ({ ...s, programs }));
              setTab("plan");
              window.scrollTo({ top: 0 });
            }}
          />
        ) : tab === "plan" ? (
          <BlueprintTab
            key={sid}
            studentId={sid}
            state={state}
            programOptions={programOptions}
            setPrograms={(programs) => update((s) => ({ ...s, programs }))}
            onSchedule={() => setTab("schedule")}
            toast={toast}
          />
        ) : (
          <ScheduleTab key={sid} studentId={sid} state={state} toast={toast} onPlan={() => setTab("plan")} />
        )}
      </main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

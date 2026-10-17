"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { patchOf, uid, type Msg, type StudentState, type TranscriptRow } from "./types";
import type { CompletedCourse, Student, Survey } from "@/lib/engine/types";
import { SurveyForm, surveySummary, type SurveyOptions } from "./SurveyForm";
import { RecommendationsCard } from "./RecommendationsCard";
import type { Recommendations } from "@/lib/careers";

const OPEN_PLAN = "Open Graduation Blueprint";

export function ChatTab(props: {
  studentId: string;
  state: StudentState;
  update: (fn: (s: StudentState) => StudentState) => void;
  onOpenPlan: (programs?: string[]) => void;
  surveyOptions: SurveyOptions;
}) {
  const { state, update, studentId } = props;
  const [text, setText] = useState("");
  const [surveyOpen, setSurveyOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = state.messages.some((m) => m.kind === "typing");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages.length]);

  const push = (m: Msg) => update((s) => ({ ...s, messages: [...s.messages, m] }));

  async function send(content: string, display?: string, studentOverride?: Student) {
    if (!content.trim() || busy) return;
    // The API gets the raw text; the thread can show a friendlier label (e.g. survey answers)
    const userMsg: Msg = { id: uid(), role: "user", content: display ?? content, raw: content };
    const typing: Msg = { id: uid(), role: "assistant", content: "", kind: "typing" };
    const history = [...state.messages, userMsg]
      .filter((m) => (m.kind ?? "text") === "text" && (m.raw ?? m.content).trim())
      .map((m) => ({ role: m.role, content: m.raw ?? m.content }));
    update((s) => ({ ...s, messages: [...s.messages, userMsg, typing] }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, student: patchOf(studentOverride ?? state.student), programs: state.programs, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const actions = (data.actions ?? []) as { type: string; programs?: string[]; chips?: string[]; data?: Recommendations }[];
      const chips = actions.filter((a) => a.type === "chips").flatMap((a) => a.chips ?? []);
      const blueprint = actions.find((a) => a.type === "show_blueprint");
      const out: Msg[] = [
        {
          id: uid(),
          role: "assistant",
          content: data.reply || "Done.",
          chips: blueprint ? [OPEN_PLAN, ...chips.filter((c) => c !== OPEN_PLAN)] : chips,
          notice: data.notice,
        },
      ];
      if (actions.some((a) => a.type === "career_survey")) out.push({ id: uid(), role: "assistant", content: "", kind: "survey" });
      const recs = actions.find((a) => a.type === "recommendations")?.data;
      if (recs) out.push({ id: uid(), role: "assistant", content: "", kind: "recs", recs });
      update((s) => ({
        ...s,
        programs: blueprint?.programs?.length ? blueprint.programs : s.programs,
        student: data.studentPatch?.survey ? { ...s.student, survey: data.studentPatch.survey } : s.student,
        messages: [...s.messages.filter((m) => m.kind !== "typing"), ...out],
      }));
    } catch (e) {
      update((s) => ({
        ...s,
        messages: [...s.messages.filter((m) => m.kind !== "typing"), { id: uid(), role: "assistant", content: `Something went wrong: ${(e as Error).message}. Try again.` }],
      }));
    }
  }

  async function upload(file: File) {
    push({ id: uid(), role: "user", content: "", attach: file.name, kind: "transcript" });
    push({ id: uid(), role: "assistant", content: "", kind: "typing" });
    const form = new FormData();
    form.append("file", file);
    form.append("studentId", studentId);
    try {
      const res = await fetch("/api/transcript", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const rows = (data.courses as TranscriptRow[]).map((r) => ({ ...r, keep: r.known }));
      update((s) => ({
        ...s,
        messages: [
          ...s.messages.filter((m) => m.kind !== "typing"),
          { id: uid(), role: "assistant", content: "Here's what I read. Check it before I plan anything: fix a grade or uncheck a row that's wrong.", kind: "transcript", rows, warnings: data.warnings },
        ],
      }));
    } catch (e) {
      update((s) => ({
        ...s,
        messages: [...s.messages.filter((m) => m.kind !== "typing"), { id: uid(), role: "assistant", content: `I couldn't read that file: ${(e as Error).message}` }],
      }));
    }
  }

  async function sampleTranscript() {
    const res = await fetch("/sample-transcript.pdf");
    const blob = await res.blob();
    upload(new File([blob], "Jordan_unofficial_transcript.pdf", { type: "application/pdf" }));
  }

  function confirmTranscript(msgId: string, rows: TranscriptRow[]) {
    const keep = rows.filter((r) => r.keep);
    // Rows the student changed are saved as student-reported; untouched ones as read from the transcript
    const original = state.messages.find((m) => m.id === msgId)?.rows ?? [];
    saveProfile({
      kind: "records",
      records: keep.map((r) => ({
        code: r.code,
        grade: r.grade,
        term: r.term || state.student.currentTerm,
        status: r.status,
        transferFrom: r.transferFrom,
        edited: original.find((o) => o.code === r.code)?.grade !== r.grade,
      })),
    });
    const completed: CompletedCourse[] = keep
      .filter((r) => r.status === "completed")
      .map((r) => {
        const prior = state.student.completed.find((c) => c.code === r.code);
        return {
          code: r.code,
          grade: r.grade,
          term: r.term || prior?.term || "Spring 2026",
          ...(r.transferFrom || prior?.transfer ? { transfer: prior?.transfer ?? { from: r.transferFrom!, verified: false } } : {}),
        };
      });
    const inProgress: CompletedCourse[] = keep
      .filter((r) => r.status === "in-progress")
      .map((r) => ({ code: r.code, grade: "IP", term: state.student.currentTerm }));
    const flagged = keep.filter((r) => r.transferFrom).map((r) => r.code);
    update((s) => ({
      ...s,
      student: { ...s.student, completed, inProgress },
      messages: [
        ...s.messages.map((m) => (m.id === msgId ? { ...m, done: true, rows } : m)),
        {
          id: uid(),
          role: "assistant",
          content: `Saved ${keep.length} courses to your planning sandbox. Nothing here changes your official TCU record.${flagged.length ? `\n\n**Can't verify:** ${flagged.join(", ")} came in as transfer credit. I'll flag it for your advisor and won't treat anything that depends on it as certain.` : ""}`,
          chips: ["Am I on track to graduate?", "How does FinTech fit into my timeline?"],
        },
      ],
    }));
  }

  function submitSurvey(sv: Survey) {
    const student = { ...state.student, survey: sv };
    setSurveyOpen(false);
    update((s) => ({ ...s, student, messages: s.messages.map((m) => (m.kind === "survey" ? { ...m, done: true } : m)) }));
    const summary = surveySummary(sv, props.surveyOptions);
    // Saved to the student's record so it's there next time they sign in
    saveProfile({ kind: "survey", survey: sv });
    send(`Survey answers: ${summary}`, `My survey answers: ${summary}`, student);
  }

  async function saveProfile(body: unknown) {
    try {
      await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      // offline or no database: the answers still apply for this session
    }
  }

  const surveyDone = !!state.student.survey?.completedAt;
  const recommendBlock = surveyOpen ? (
    <SurveyForm student={state.student} options={props.surveyOptions} onSubmit={submitSurvey} onCancel={() => setSurveyOpen(false)} disabled={busy} />
  ) : surveyDone ? (
    <div className="recommend done">
      <div>
        <span className="tag">Survey complete</span>
        <b>Your plan and recommendations use your answers</b>
        <p>{surveySummary(state.student.survey!, props.surveyOptions)}</p>
      </div>
      <button className="btn small" onClick={() => setSurveyOpen(true)} disabled={busy}>Edit answers</button>
    </div>
  ) : (
    <div className="recommend">
      <div>
        <span className="tag">Recommended</span>
        <b>Take the Planning Survey</b>
        <p>About 2 minutes. Your year, interests, where you want to live, and how you like your semesters shape your plan, your schedule, and the career paths I suggest.</p>
      </div>
      <button className="btn primary" onClick={() => setSurveyOpen(true)} disabled={busy}>Take survey</button>
    </div>
  );

  const lastAssistant = [...state.messages].reverse().find((m) => m.role === "assistant" && m.kind !== "typing");
  const s = state.student;

  const renderMsg = (m: Msg) => {
    if (m.role === "user") {
      return (
        <div className="msg user" key={m.id}>
          <div className="bubble">
            {m.attach ? <div className="mono" style={{ fontSize: 12.5 }}>📎 {m.attach}</div> : null}
            {m.content}
          </div>
        </div>
      );
    }
    return (
      <div className="msg" key={m.id}>
        <div className="av">GB</div>
        <div className="body">
          {m.kind === "typing" ? (
            <div className="typing"><span /><span /><span /></div>
          ) : m.kind === "survey" ? (
            m.done || surveyOpen ? (
              <p className="modebadge">{m.done ? "Survey saved." : "The survey is open above."}</p>
            ) : (
              <SurveyForm student={state.student} options={props.surveyOptions} onSubmit={submitSurvey} disabled={busy} />
            )
          ) : m.kind === "recs" && m.recs ? (
            <RecommendationsCard recs={m.recs} />
          ) : m.kind === "transcript" ? (
            <TranscriptCard msg={m} onConfirm={(rows) => confirmTranscript(m.id, rows)} />
          ) : (
            <Markdown text={m.content} />
          )}
          {m.notice ? <p className="modebadge">{m.notice}</p> : null}
          {m === lastAssistant && m.chips?.length && !busy ? (
            <div className="chips">
              {m.chips.map((c) => (
                <button key={c} className={`btn small${c === OPEN_PLAN ? " primary" : ""}`} onClick={() => (c === OPEN_PLAN ? props.onOpenPlan(state.programs) : send(c))}>
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="chat-grid">
      <aside className="side">
        <div className="pcard">
          <b>{s.name}</b>
          <div className="row"><span>Programs</span><span>{s.programs.join(" + ")}</span></div>
          <div className="row"><span>Started</span><span>{s.startTerm}</span></div>
          <div className="row"><span>Target</span><span>{s.targetGradTerm}</span></div>
          <div className="row"><span>Courses on record</span><span>{s.completed.length} done · {s.inProgress.length} in progress</span></div>
          {s.survey?.interests?.length ? <div className="row"><span>Interests</span><span>{s.survey.interests.join(", ")}</span></div> : null}
        </div>
        <div>
          <h4>Try asking</h4>
          <div className="chips" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            {(s.programs.includes("BBA-UNDECIDED")
              ? ["Am I on the right track?", "I'm not sure what career I want", "What if I lean toward Finance?"]
              : ["Am I on track to graduate?", "How does FinTech fit into my timeline?", "What needs advisor sign-off?"]
            ).map((c) => (
              <button key={c} className="linkbtn" onClick={() => send(c)} disabled={busy}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="modebadge">Answers come from the planning engine and TCU data files; Claude explains them.</p>
      </aside>

      <section className="chatcol">
        <div className="thread" aria-live="polite">
          {state.messages.map((m, i) => (
            <Fragment key={m.id}>
              {renderMsg(m)}
              {/* The recommended survey block sits right under the greeting */}
              {i === 0 && (
                <div className="msg">
                  <div className="av" style={{ visibility: "hidden" }}>GB</div>
                  <div className="body">{recommendBlock}</div>
                </div>
              )}
            </Fragment>
          ))}
          <div ref={endRef} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
            setText("");
          }}
        >
          <button type="button" className="iconbtn" aria-label="Upload transcript or screenshot" title="Upload transcript or screenshot" onClick={() => fileRef.current?.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.5 12.6 21a5.5 5.5 0 0 1-7.8-7.8l8.9-8.9a3.7 3.7 0 0 1 5.2 5.2l-8.9 8.9a1.8 1.8 0 0 1-2.6-2.6L15.6 7.6" /></svg>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <input id="ask" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your degree, a major, or a class..." autoComplete="off" />
          <button type="submit" className="iconbtn send" aria-label="Send" disabled={busy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </form>
        <div className="disclaim">
          Plans are built from TCU catalog data and cite their sources. Official approval comes from your advisor and the registrar.{" "}
          {studentId === "jordan" && (
            <button className="linkbtn" onClick={sampleTranscript} disabled={busy}>
              Upload sample transcript
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function TranscriptCard({ msg, onConfirm }: { msg: Msg; onConfirm: (rows: TranscriptRow[]) => void }) {
  const [rows, setRows] = useState<TranscriptRow[]>(msg.rows ?? []);
  if (!msg.rows) return <Markdown text={msg.content || "Uploading..."} />;
  const set = (i: number, patch: Partial<TranscriptRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      <Markdown text={msg.content} />
      <div className="card">
        <h5>Your record (draft)</h5>
        <div className="scroll">
          <table className="tx">
            <thead>
              <tr><th>Use</th><th>Course</th><th>Grade</th><th>Term</th><th>Note</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} className={r.transferFrom || !r.known ? "flag" : ""}>
                  <td><input type="checkbox" checked={!!r.keep} disabled={msg.done} onChange={(e) => set(i, { keep: e.target.checked })} aria-label={`Use ${r.code}`} /></td>
                  <td><span className="mono">{r.code}</span><br /><small>{r.title}</small></td>
                  <td><input type="text" value={r.grade ?? ""} disabled={msg.done} onChange={(e) => set(i, { grade: e.target.value.toUpperCase() })} aria-label={`Grade for ${r.code}`} /></td>
                  <td>{r.term ?? ""}</td>
                  <td>{r.transferFrom ? `Transfer from ${r.transferFrom}: unverified` : !r.known ? "Not in TCU course data" : r.status === "in-progress" ? "In progress" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg.warnings?.map((w) => <p key={w} className="modebadge">{w}</p>)}
        {!msg.done && (
          <div className="chips">
            <button className="btn primary" onClick={() => onConfirm(rows)}>Looks right, save to my plan</button>
          </div>
        )}
      </div>
    </>
  );
}

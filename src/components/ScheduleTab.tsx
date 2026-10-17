"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleResult } from "@/lib/engine/schedule";
import type { SchedulePrefs, Section } from "@/lib/engine/types";
import { patchOf, type StudentState } from "./types";

const DAYS = ["M", "T", "W", "R", "F"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START = 8 * 60;
const END = 19 * 60;
const PX = 0.9; // pixels per minute

const toMin = (t?: string) => (t ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : 0);
const fmt = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
};
const days = (d: string) => (d.match(/M|Tu|T|W|Th|R|F/g) ?? []).map((x) => (x === "Th" ? "R" : x === "Tu" ? "T" : x));

export function ScheduleTab(props: { studentId: string; state: StudentState; toast: (m: string) => void; onPlan: () => void }) {
  const { studentId, state } = props;
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [status, setStatus] = useState("none");
  const sv = state.student.survey;
  const [prefs, setPrefs] = useState<SchedulePrefs>({
    ...(state.student.preferences ?? {}),
    ...(sv?.completedAt && sv.fridaysFree !== undefined ? { fridaysFree: sv.fridaysFree } : {}),
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, student: patchOf(state.student), programs: state.programs, prefs }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data.schedule);
      setStatus(data.reviewStatus);
    }
  }, [studentId, state.student, state.programs, prefs]);

  useEffect(() => {
    load();
  }, [load]);

  if (!result) return <p className="modebadge">Building schedule…</p>;
  const all = [...result.chosen, ...result.untimed];

  async function copy() {
    const text = all.map((c) => `${c.code} ${c.section.section}: ${c.section.classNumber}${c.lab ? ` + lab ${c.lab.classNumber}` : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      props.toast("Class numbers copied.");
    } catch {
      props.toast("Copy failed; select the numbers in the table instead.");
    }
  }

  const blocks = result.chosen.flatMap((c) => {
    const secs: [Section, boolean][] = [[c.section, false], ...(c.lab ? [[c.lab, true] as [Section, boolean]] : [])];
    return secs.flatMap(([s, lab]) =>
      days(s.days).map((d) => ({ d, s, lab, code: c.code })),
    );
  });

  return (
    <>
      <div className={`banner ${result.approved ? "ok" : ""}`}>
        <div>
          <b>{result.approved ? `Advisor-approved plan · ${result.term}` : "Not approved yet: preview only."}</b>{" "}
          {result.approved
            ? "These sections fit the plan your advisor signed off on. Register yourself on my.tcu.edu."
            : status === "submitted"
              ? "Your plan is with your advisor. Sections below are a preview of the planned courses."
              : "Send your plan for advisor review first; sections below are a preview."}{" "}
          {!result.approved && <button className="linkbtn" onClick={props.onPlan}>Go to the plan</button>}
        </div>
      </div>

      <div className="strip">
        <div>
          <h1>{result.term} schedule</h1>
          <div className="meta">{all.length} courses scheduled · searched {result.tried} combinations</div>
        </div>
        <div className="progs">
          <span className="lab">Preferences</span>
          <button className="prog" aria-pressed={!!prefs.fridaysFree} onClick={() => setPrefs({ ...prefs, fridaysFree: !prefs.fridaysFree })}>Fridays free</button>
          <button className="prog" aria-pressed={!!prefs.noEvening} onClick={() => setPrefs({ ...prefs, noEvening: !prefs.noEvening })}>Nothing after 5:30</button>
          <button className="prog" aria-pressed={prefs.earliestStart === "10:00"} onClick={() => setPrefs({ ...prefs, earliestStart: prefs.earliestStart === "10:00" ? "09:00" : "10:00" })}>Start 10am+</button>
          <button className="prog" aria-pressed={prefs.pattern === "TR"} onClick={() => setPrefs({ ...prefs, pattern: prefs.pattern === "TR" ? "any" : "TR" })}>Prefer T/Th</button>
          <button className="prog" aria-pressed={!!prefs.fewerDays} onClick={() => setPrefs({ ...prefs, fewerDays: !prefs.fewerDays })}>Fewer days</button>
        </div>
      </div>

      <div className="bp-grid">
        <div style={{ minWidth: 0 }}>
          <div className="scroll">
            <div className="week">
              <div className="hd" />
              {DAY_NAMES.map((d) => <div key={d} className="hd">{d}</div>)}
              <div className="hours" style={{ height: (END - START) * PX }}>
                {Array.from({ length: (END - START) / 60 }, (_, i) => (
                  <div key={i} className="hr" style={{ top: i * 60 * PX }}>{fmt(`${8 + i}:00`)}</div>
                ))}
              </div>
              {DAYS.map((d) => (
                <div key={d} className="col" style={{ height: (END - START) * PX }}>
                  {Array.from({ length: (END - START) / 60 }, (_, i) => <div key={i} className="hr" style={{ top: i * 60 * PX }} />)}
                  {blocks.filter((b) => b.d === d).map((b, i) => (
                    <div
                      key={i}
                      className={`blk${b.s.status !== "Open" ? " closed" : ""}${b.s.session && b.s.session !== "1" ? " half" : ""}`}
                      style={{ top: (toMin(b.s.start) - START) * PX, height: (toMin(b.s.end) - toMin(b.s.start)) * PX }}
                      title={`${b.code} ${b.s.section}`}
                    >
                      <b>{b.code}{b.lab ? " lab" : ""}</b>
                      {fmt(b.s.start)}–{fmt(b.s.end)}
                      {b.s.session && b.s.session !== "1" ? ` · ${b.s.session === "8W1" ? "1st" : "2nd"} 8 wks` : ""}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rail">
          <div className="panel">
            <h3><span>Sections</span><button className="btn small" onClick={copy}>Copy class numbers</button></h3>
            <div className="scroll">
              <table className="tx">
                <thead><tr><th>Course</th><th>Sec</th><th>Class #</th><th>When</th></tr></thead>
                <tbody>
                  {all.map((c) => (
                    <tr key={c.code}>
                      <td><span className="mono">{c.code}</span><br /><small>{c.labels.join(" · ")}</small></td>
                      <td>{c.section.section}</td>
                      <td className="mono">{c.section.classNumber}{c.lab ? ` + ${c.lab.classNumber}` : ""}</td>
                      <td>{c.section.days ? `${c.section.days} ${fmt(c.section.start)}–${fmt(c.section.end)}` : "No set time"}<br />
                        <small>Backups: {(result.backups[c.code] ?? []).map((b) => `${b.section} (${b.days} ${fmt(b.start)})`).join(", ") || "none that fit"}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {result.untimed.length ? (
            <div className="panel"><h3>No set meeting time</h3>{result.untimed.map((c) => <div key={c.code}>{c.code} {c.section.section} ({c.section.mode})</div>)}</div>
          ) : null}
          {result.unscheduled.map((u) => (
            <div key={u.code} className="flag unplaced">
              <span className="k">Couldn&rsquo;t fit</span>
              <b>{u.code}</b>
              <span>{u.reason}.{u.swapOptions.length ? ` Same-requirement options this term: ${u.swapOptions.join(", ")}.` : " Ask your advisor about a permission override or another term."}</span>
            </div>
          ))}
          <div className="panel">
            <h3>Before you register</h3>
            {result.warnings.map((w) => <div key={w} style={{ fontSize: 12.5 }}>{w}</div>)}
          </div>
        </aside>
      </div>
    </>
  );
}

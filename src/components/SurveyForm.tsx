"use client";

import { useState } from "react";
import { nextRegularTerm } from "@/lib/engine/terms";
import type { Student, StudentYear, Survey } from "@/lib/engine/types";

export interface SurveyOptions {
  interests: { id: string; label: string }[];
  locations: string[];
}

const YEARS: [StudentYear, string][] = [
  ["incoming", "Incoming Freshman"],
  ["freshman", "Freshman"],
  ["sophomore", "Sophomore"],
  ["junior", "Junior"],
  ["senior", "Senior"],
];
const LOADS: [NonNullable<Survey["workload"]>, string, string][] = [
  ["light", "Lighter", "12-15 hrs"],
  ["balanced", "Balanced", "15-16 hrs"],
  ["heavy", "Heavier", "17-18 hrs"],
];

function upcomingTerms(from: string, n: number) {
  const out: string[] = [];
  let t = from;
  for (let i = 0; i < n; i++) {
    t = nextRegularTerm(t);
    out.push(t);
  }
  return out;
}

export function SurveyForm(props: { student: Student; options: SurveyOptions; onSubmit: (s: Survey) => void; onCancel?: () => void; disabled?: boolean }) {
  const prev = props.student.survey;
  const [year, setYear] = useState<StudentYear | undefined>(prev?.year);
  const [areas, setAreas] = useState<string[]>(prev?.areas ?? []);
  const [interestText, setInterestText] = useState(prev?.interestText ?? "");
  const [hometown, setHometown] = useState(prev?.hometown ?? "");
  const [locations, setLocations] = useState<string[]>(prev?.locations ?? []);
  const [workload, setWorkload] = useState<Survey["workload"]>(prev?.workload ?? "balanced");
  const [abroad, setAbroad] = useState<"no" | "maybe" | "yes">(prev?.studyAbroad?.plan ?? "no");
  const [abroadTerm, setAbroadTerm] = useState(prev?.studyAbroad?.term ?? "");
  const [fridays, setFridays] = useState<boolean>(prev?.fridaysFree ?? props.student.preferences?.fridaysFree ?? false);
  const [grad, setGrad] = useState(prev?.targetGradTerm ?? props.student.targetGradTerm);

  const terms = upcomingTerms(props.student.currentTerm, 10);
  const toggle = (list: string[], v: string, set: (l: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ready = !!year && (areas.length > 0 || interestText.trim().length > 0) && (abroad !== "yes" || !!abroadTerm);

  function submit() {
    if (!ready) return;
    props.onSubmit({
      ...(prev ?? { interests: [] }),
      interests: prev?.interests ?? [],
      year,
      areas,
      interestText: interestText.trim(),
      hometown: hometown.trim(),
      locations,
      workload,
      studyAbroad: { plan: abroad, ...(abroad === "yes" ? { term: abroadTerm } : {}) },
      fridaysFree: fridays,
      targetGradTerm: grad,
      completedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="card survey">
      <h5>Planning Survey</h5>

      <fieldset className="sq">
        <legend>What year are you?</legend>
        <div className="opts">
          {YEARS.map(([id, label]) => (
            <button type="button" key={id} className="opt" aria-pressed={year === id} onClick={() => setYear(id)}>{label}</button>
          ))}
        </div>
        {year && <small className="hint">{year === "junior" || year === "senior" ? "You'll get specific roles, employers to research, and recruiting timing." : "You'll get a broad view of industries and areas to explore."}</small>}
      </fieldset>

      <fieldset className="sq">
        <legend>What are you interested in?</legend>
        <div className="opts">
          {props.options.interests.map((o) => (
            <button type="button" key={o.id} className="opt" aria-pressed={areas.includes(o.id)} onClick={() => toggle(areas, o.id, setAreas)}>{o.label}</button>
          ))}
        </div>
        <label className="field">
          <span>Hobbies, activities, anything else</span>
          <textarea id="survey-interests" rows={2} value={interestText} onChange={(e) => setInterestText(e.target.value)} placeholder="e.g. golf, investing club, building apps, volunteering" />
        </label>
      </fieldset>

      <fieldset className="sq">
        <legend>Where are you from, and where do you want to be?</legend>
        <label className="field">
          <span>Hometown</span>
          <input id="survey-hometown" type="text" value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="e.g. Tulsa, OK" />
        </label>
        <div className="opts">
          {props.options.locations.map((l) => (
            <button type="button" key={l} className="opt" aria-pressed={locations.includes(l)} onClick={() => toggle(locations, l, setLocations)}>{l}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className="sq">
        <legend>Your schedule</legend>
        <div className="q2">How heavy do you want your semesters?</div>
        <div className="opts">
          {LOADS.map(([id, label, hrs]) => (
            <button type="button" key={id} className="opt" aria-pressed={workload === id} onClick={() => setWorkload(id)}>{label} <small>({hrs})</small></button>
          ))}
        </div>
        <div className="q2">Study abroad?</div>
        <div className="opts">
          {(["no", "maybe", "yes"] as const).map((v) => (
            <button type="button" key={v} className="opt" aria-pressed={abroad === v} onClick={() => setAbroad(v)}>{v === "no" ? "Not planning to" : v === "maybe" ? "Maybe" : "Yes, a semester"}</button>
          ))}
          {abroad === "yes" && (
            <select id="survey-abroad-term" value={abroadTerm} onChange={(e) => setAbroadTerm(e.target.value)} aria-label="Study abroad semester">
              <option value="">Which semester?</option>
              {terms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <div className="q2">No classes on Fridays?</div>
        <div className="opts">
          <button type="button" className="opt" aria-pressed={fridays} onClick={() => setFridays(true)}>Yes, keep Fridays free</button>
          <button type="button" className="opt" aria-pressed={!fridays} onClick={() => setFridays(false)}>Fridays are fine</button>
        </div>
      </fieldset>

      <fieldset className="sq">
        <legend>When do you want to graduate?</legend>
        <select id="survey-grad" value={grad} onChange={(e) => setGrad(e.target.value)}>
          {terms.filter((t) => t !== "").map((t) => <option key={t} value={t}>{t}{t === props.student.targetGradTerm ? " (current target)" : ""}</option>)}
        </select>
      </fieldset>

      <div className="chips">
        <button type="button" className="btn primary" disabled={!ready || props.disabled} onClick={submit}>Save and get recommendations</button>
        {props.onCancel && <button type="button" className="btn" onClick={props.onCancel}>Not now</button>}
      </div>
      <small className="hint">Answers stay in your planning sandbox. They don&rsquo;t change your official TCU record.</small>
    </div>
  );
}

export function surveySummary(s: Survey, options: SurveyOptions): string {
  const label = (id: string) => options.interests.find((o) => o.id === id)?.label ?? id;
  const year = YEARS.find(([id]) => id === s.year)?.[1] ?? "";
  return [
    `${year}`,
    `Interests: ${[...(s.areas ?? []).map(label), s.interestText].filter(Boolean).join(", ")}`,
    s.hometown ? `From ${s.hometown}` : "",
    s.locations?.length ? `Wants to be in ${s.locations.join(", ")}` : "",
    `${LOADS.find(([id]) => id === s.workload)?.[1] ?? "Balanced"} semesters`,
    s.studyAbroad?.plan === "yes" ? `Study abroad ${s.studyAbroad.term}` : s.studyAbroad?.plan === "maybe" ? "Maybe study abroad" : "",
    s.fridaysFree ? "No Friday classes" : "",
    `Graduate ${s.targetGradTerm}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

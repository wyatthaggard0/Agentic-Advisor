"use client";

import { useCallback, useEffect, useState } from "react";
import type { Plan, PlanLine } from "@/lib/engine/types";
import type { PlanComparison } from "@/lib/engine/compare";
import type { Review } from "@/lib/store";
import { patchOf, type StudentState } from "./types";

const CONF_LABEL: Record<string, string> = {
  confirmed: "Confirmed section",
  historical: "Offered that season before",
  assumed: "Assumed / you choose",
  advisor: "Needs advisor check",
  "in-progress": "Enrolled now",
};

export function BlueprintTab(props: {
  studentId: string;
  state: StudentState;
  programOptions: { id: string; name: string; kind: string }[];
  setPrograms: (p: string[]) => void;
  onSchedule: () => void;
  toast: (m: string) => void;
}) {
  const { studentId, state } = props;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [comparison, setComparison] = useState<PlanComparison | null>(null);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [drawer, setDrawer] = useState<{ line: PlanLine; term: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, student: patchOf(state.student), programs: state.programs, basePrograms: state.student.programs }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Couldn't build the plan");
    setPlan(data.plan);
    setComparison(data.comparison);
  }, [studentId, state.student, state.programs]);

  const loadReview = useCallback(async () => {
    const res = await fetch(`/api/review?studentId=${studentId}`);
    const data = await res.json();
    setReview(data.reviews?.[0] ?? null);
  }, [studentId]);

  useEffect(() => {
    load();
    loadReview();
  }, [load, loadReview]);

  // Advisor decisions happen in another tab; refresh when this one regains focus
  useEffect(() => {
    const f = () => loadReview();
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [loadReview]);

  async function submit() {
    setSending(true);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", studentId, student: patchOf(state.student), programs: state.programs }),
    });
    const data = await res.json();
    setSending(false);
    setConfirm(false);
    if (!res.ok) return props.toast(data.error ?? "Couldn't send");
    setReview(data.review);
    props.toast("Sent to your advisor.");
  }

  async function download() {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, student: patchOf(state.student), programs: state.programs }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return props.toast(data.error ?? "Couldn't build the Excel file");
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "Graduation-Blueprint.xlsx";
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    props.toast("Downloaded your Graduation Blueprint.");
  }

  async function resetReview() {
    await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", studentId }) });
    setReview(null);
  }

  const toggle = (id: string) => {
    const kind = props.programOptions.find((p) => p.id === id)?.kind;
    let next = state.programs.includes(id) ? state.programs.filter((p) => p !== id) : [...state.programs, id];
    if (kind === "major" && !state.programs.includes(id)) next = next.filter((p) => p !== "BBA-UNDECIDED" || id === "BBA-UNDECIDED");
    if (id === "BBA-UNDECIDED" && !state.programs.includes(id)) next = ["BBA-UNDECIDED", ...next.filter((p) => !props.programOptions.find((o) => o.id === p && o.kind === "major"))];
    if (!next.length) return;
    props.setPrograms(next);
  };

  if (error) return <div className="banner">{error}</div>;
  if (!plan) return <p className="modebadge">Building your plan…</p>;

  const s = state.student;
  const fails = plan.checks.filter((c) => !c.pass);
  const isWhatIf = state.programs.join("|") !== s.programs.join("|");
  const sameAsReview = review && review.programs.join("|") === plan.programs.join("|");
  const termsShown = plan.terms;

  return (
    <>
      {plan.dataNotes.length ? (
        <div className="banner">
          <div>
            <b>Prototype data.</b> {plan.dataNotes.join(" ")}
          </div>
        </div>
      ) : null}

      <div className="strip">
        <div>
          <h1>{s.name}&rsquo;s Graduation Blueprint</h1>
          <div className="meta">
            {plan.programs.map((p) => props.programOptions.find((o) => o.id === p)?.name ?? p).join(" + ")} · {plan.cohort}
            {isWhatIf ? " · what-if, your record is unchanged" : ""}
          </div>
        </div>
        <div className="facts">
          <div className="fact"><span>Graduation</span><b className={plan.onTime ? "" : "risk"}>{plan.gradTerm}</b></div>
          <div className="fact"><span>Hours</span><b>{plan.totals.hours}/{plan.totals.required}</b></div>
          <div className="fact"><span>Heaviest term</span><b>{plan.totals.maxLoad} hrs</b></div>
          <div className="fact"><span>Checks</span><b className={fails.length ? "risk" : ""}>{plan.checks.length - fails.length}/{plan.checks.length}</b></div>
          <button className="btn" style={{ alignSelf: "center" }} onClick={download} disabled={plan.blocked.length > 0} title="Neeley BBA degree-plan worksheet format">
            Download Excel
          </button>
        </div>
      </div>

      <div className="controls">
        <div className="prog-groups">
          {(["major", "minor", "certificate"] as const).map((kind) => {
            const opts = props.programOptions.filter((p) => p.kind === kind);
            if (!opts.length) return null;
            return (
              <div className="progs" key={kind}>
                <span className="lab">{kind === "major" ? "Majors" : kind === "minor" ? "Minors" : "Certificates"}</span>
                {opts.map((p) => (
                  <button key={p.id} className="prog" aria-pressed={state.programs.includes(p.id)} onClick={() => toggle(p.id)}>
                    {p.name.replace(/ \(major not chosen\)$/, "")}
                  </button>
                ))}
              </div>
            );
          })}
          {isWhatIf && (
            <button className="linkbtn" onClick={() => props.setPrograms(s.programs)}>
              Back to my programs
            </button>
          )}
        </div>
        <div className="legend">
          {Object.entries(CONF_LABEL).map(([k, v]) => (
            <span key={k} className={`conf ${k}`}>{v}</span>
          ))}
        </div>
      </div>

      {plan.blocked.length ? (
        <div className="banner">
          <div>
            <b>This combination isn&rsquo;t allowed.</b> {plan.blocked.map((b) => `${b.reason} [${b.source}]`).join(" ")}
          </div>
        </div>
      ) : null}

      {comparison && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3><span>What changes</span><span>{comparison.a} → {comparison.b}</span></h3>
          <div className="scroll">
            <table className="cmp">
              <thead><tr><th></th><th>{comparison.a}</th><th>{comparison.b}</th></tr></thead>
              <tbody>
                {comparison.rows.map((r) => (
                  <tr key={r.label} className={r.changed ? "changed" : ""}><td>{r.label}</td><td>{r.a}</td><td>{r.b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 13 }}>{comparison.summary}</div>
        </div>
      )}

      <div className="bp-grid">
        <div className="terms">
          {termsShown.map((t) => (
            <div key={t.term} className={`term${t.status === "in-progress" ? " prog" : ""}${t.term.startsWith("Summer") ? " summer" : ""}`}>
              <header><b>{t.term}</b><span>{t.hours} hrs</span></header>
              {t.status === "in-progress" && <div className="st">In progress · from transcript</div>}
              {t.term.startsWith("Summer") && <div className="st" style={{ background: "var(--warn-soft)" }}>Summer · optional trade-off</div>}
              {t.hold && <div className="st">{t.hold}</div>}
              {t.lines.map((l, i) => (
                <button key={`${l.code}-${i}`} className={`cc${l.slot ? " slot" : ""}${l.added === "swap" ? " swap" : ""}${comparison?.added.includes(l.code) ? " new" : ""}`} onClick={() => setDrawer({ line: l, term: t.term })}>
                  <div className="top2">
                    <span className="code">{l.slot ? `${l.credits} hrs` : l.code}</span>
                    <span className={`conf ${l.confidence}`} title={l.confidenceNote}>{l.confidence}</span>
                  </div>
                  <div className="t">{l.title}</div>
                  <div className="req">{l.requirement}</div>
                </button>
              ))}
            </div>
          ))}
        </div>

        <aside className="rail">
          <div className="panel">
            <h3><span>Advisor review</span><span>{plan.advisorItems.length} items</span></h3>
            {!review || !sameAsReview ? (
              <>
                <button className="btn primary" disabled={fails.length > 0 || plan.blocked.length > 0} onClick={() => setConfirm(true)}>
                  Send plan for advisor review
                </button>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {fails.length ? `Fix ${fails.length} failing check${fails.length > 1 ? "s" : ""} first so your advisor reviews a plan that works.` : "Your advisor gets the plan, its sources, and every item below."}
                </span>
              </>
            ) : (
              <div className={`status ${review.status}`}>
                <b>{review.status === "submitted" ? "Sent to your Neeley advisor" : review.status === "approved" ? "Advisor-reviewed plan" : "Advisor requested changes"}</b>
                <span>
                  {review.status === "submitted"
                    ? "Waiting for review. Keep exploring what-ifs; the submitted plan stays as sent."
                    : review.advisorNote || (review.status === "approved" ? "Approved." : "")}
                </span>
                {review.status === "approved" && (
                  <>
                    <span>Next: build your Spring schedule, then register on my.tcu.edu during your window. Approval of a plan doesn&rsquo;t register you or clear you to graduate.</span>
                    <button className="btn small primary" onClick={props.onSchedule}>Build next-semester schedule</button>
                  </>
                )}
                <button className="linkbtn" style={{ justifySelf: "start", fontSize: 12 }} onClick={resetReview}>Reset demo review</button>
              </div>
            )}
            {plan.advisorItems.map((a) => (
              <div key={a.id} className={`flag ${a.kind}`}>
                <span className="k">{a.kind.replace("-", " ")}</span>
                <b>{a.title}</b>
                <span>{a.detail}</span>
                {a.source ? <small>Source: {a.source}</small> : null}
              </div>
            ))}
          </div>

          {plan.coreAssignments?.length ? (
            <div className="panel">
              <h3><span>TCU Core</span><span>{plan.coreAssignments.filter((a) => a.source !== "open").length} of {plan.coreAssignments.length} filled</span></h3>
              <div className="core-list">
                {plan.coreAssignments.map((a, i) => (
                  <div key={`${a.slot}-${i}`} className={`core-row ${a.source}`}>
                    <span className="core-code">{a.slot}</span>
                    <span>
                      {a.code ? <b className="mono">{a.code}</b> : null} {a.title ?? (a.source === "audit" ? "From your degree audit" : a.source === "open" ? "Still open: talk to your advisor" : "")}
                      <small> · {a.source === "planned" ? `planned ${a.term ?? ""}` : a.source === "in-progress" ? "in progress" : a.source}</small>
                    </span>
                  </div>
                ))}
              </div>
              <small className="hint">{plan.coreLabel}. Suggested Core courses are examples; any approved course in the category works.</small>
            </div>
          ) : null}

          <div className="panel">
            <h3><span>Plan checks</span><span>{plan.checks.length - fails.length} of {plan.checks.length} pass</span></h3>
            {plan.checks.map((c) => (
              <div key={c.id} className={`check ${c.pass ? "pass" : "fail"}`}>
                <i>{c.pass ? "✓" : "✕"}</i>
                <div>{c.name}<small>{c.detail}</small></div>
              </div>
            ))}
            {plan.swaps.map((sw) => (
              <div key={sw.from} className="flag load"><span className="k">Swap</span><span>{sw.reason}</span></div>
            ))}
          </div>
        </aside>
      </div>

      {drawer && <CourseDrawer studentId={studentId} line={drawer.line} term={drawer.term} onClose={() => setDrawer(null)} />}

      {confirm && (
        <div className="scrim modal-scrim" onClick={(e) => e.target === e.currentTarget && setConfirm(false)}>
          <div className="modal" role="dialog" aria-label="Send for advisor review">
            <h2>Send plan for advisor review</h2>
            <p style={{ margin: 0 }}>Your Neeley academic advisor gets the full plan, its sources, and these open questions:</p>
            <ul>{plan.advisorItems.map((a) => <li key={a.id}><b>{a.title}.</b> {a.detail}</li>)}</ul>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Sending doesn&rsquo;t register you for classes or change your major.</p>
            <div className="acts">
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn primary" disabled={sending} onClick={submit}>Send to advisor</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CourseDrawer({ studentId, line, term, onClose }: { studentId: string; line: PlanLine; term: string; onClose: () => void }) {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (line.slot) return;
    fetch(`/api/course?studentId=${studentId}&code=${encodeURIComponent(line.code)}`)
      .then((r) => r.json())
      .then(setInfo);
  }, [studentId, line]);
  const prereqs = (info?.prerequisites as string[] | undefined) ?? [];
  const offer = (info?.offering as { term: string; status: string; note: string }[] | undefined) ?? [];
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-label={line.title}>
        <button className="btn small" style={{ justifySelf: "end" }} onClick={onClose}>Close</button>
        <div>
          <div className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{line.slot ? "Requirement slot" : line.code} · {line.credits} hrs · {term}</div>
          <h2>{line.title}</h2>
        </div>
        <div className="dl">
          <div><span>Why it&rsquo;s here</span>{line.why}</div>
          <div><span>Requirement it fills</span>{line.requirement}</div>
          <div><span>Availability</span><span className={`conf ${line.confidence}`}>{CONF_LABEL[line.confidence] ?? line.confidence}: {line.confidenceNote}</span></div>
          {line.prereqNote ? <div><span>Note</span>{line.prereqNote}</div> : null}
          {!line.slot && (
            <>
              <div><span>Prerequisites</span>{prereqs.length ? <ul>{prereqs.map((p) => <li key={p}>{p}</li>)}</ul> : info ? "None listed" : "Loading…"}</div>
              {(info?.restrictions as string[] | undefined)?.length ? <div><span>Restrictions</span>{(info!.restrictions as string[]).join("; ")}</div> : null}
              {offer.length ? <div><span>Upcoming terms</span><ul>{offer.map((o) => <li key={o.term}>{o.term}: {o.status} ({o.note})</li>)}</ul></div> : null}
              {info?.prerequisiteText ? <div><span>Catalog text</span><em>{String(info.prerequisiteText)}</em></div> : null}
            </>
          )}
          <div><span>Source</span><span className="src">{line.source}</span>{info?.source ? <span className="src">{String(info.source)}</span> : null}</div>
        </div>
      </div>
    </div>
  );
}

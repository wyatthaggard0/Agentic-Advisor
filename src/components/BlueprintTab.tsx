"use client";

import { useCallback, useEffect, useState } from "react";
import type { Plan, PlanLine } from "@/lib/engine/types";
import { compareTerms } from "@/lib/engine/terms";
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
  /** Swap a suggested TCU Core course for another that fills the same categories; no args resets */
  onCoreSwap: (from?: string, to?: string) => void;
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
  const [editing, setEditing] = useState<string | null>(null);

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
          {plan.lateCost ? (
            <div className="fact" title={`${plan.lateCost.note}. Source: ${plan.lateCost.source}`}>
              <span>Extra semesters cost</span>
              <b className="risk">+{money(plan.lateCost.amount)}</b>
              <small>{plan.lateCost.semesters} semester{plan.lateCost.semesters === 1 ? "" : "s"} past {plan.targetGradTerm}</small>
            </div>
          ) : null}
          {plan.cost ? (
            <div className="fact" title={`Remaining planned terms: ${money(plan.cost.tuition)} tuition + ${money(plan.cost.differential)} Neeley differential + ${money(plan.cost.housing)} housing and food. ${plan.cost.notes[1]}`}>
              <span>Est. remaining cost</span>
              <b>{money(plan.cost.total)}</b>
              <small>before aid</small>
            </div>
          ) : null}
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
            // Only what the student has, with Change / Add opening the full list
            const chosen = opts.filter((p) => state.programs.includes(p.id));
            const open = editing === kind;
            return (
              <div className="progs" key={kind}>
                <span className="lab">{kind === "major" ? "Majors" : kind === "minor" ? "Minors" : "Certificates"}</span>
                {(open ? opts : chosen).map((p) => (
                  <button key={p.id} className="prog" aria-pressed={state.programs.includes(p.id)} onClick={() => toggle(p.id)}>
                    {p.name.replace(/ \(major not chosen\)$/, "")}
                  </button>
                ))}
                {!open && !chosen.length && <span className="none">None yet</span>}
                <button className="btn small prog-edit" aria-expanded={open} onClick={() => setEditing(open ? null : kind)}>
                  {open ? "Done" : chosen.length ? "Change" : "Add"}
                </button>
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
        <div className="years">
          {academicYears(termsShown).map((y) => (
            <section key={y.label} className="year">
              <h4 className="year-h">
                {y.label}
                <span>{y.hours} hrs</span>
              </h4>
              <div className="year-row">
                {[y.fall, y.spring].map((t, i) =>
                  t ? (
                    <TermCard key={t.term} t={t} onOpen={(l) => setDrawer({ line: l, term: t.term })} added={comparison?.added ?? []} />
                  ) : (
                    <div key={i} className="term empty">
                      <header><b>{i === 0 ? `Fall ${y.start}` : `Spring ${y.start + 1}`}</b></header>
                      <span className="hint">{i === 0 ? "Before this plan" : "After graduation"}</span>
                    </div>
                  ),
                )}
              </div>
              {y.summer && <TermCard t={y.summer} summer onOpen={(l) => setDrawer({ line: l, term: y.summer!.term })} added={comparison?.added ?? []} />}
            </section>
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
                    <span>Changed something since? Send the updated plan to your advisor. Approval of a plan doesn&rsquo;t register you or clear you to graduate.</span>
                    <button className="btn small primary" onClick={() => setConfirm(true)}>Send to advisor for review</button>
                  </>
                )}
                <button className="linkbtn" style={{ justifySelf: "start", fontSize: 12 }} onClick={resetReview}>Reset demo review</button>
              </div>
            )}
            {plan.advisorItems.map((a) => (
              <details key={a.id} className={`flag ${a.kind}`}>
                <summary><b>{a.title}</b></summary>
                <span className="k">{a.kind.replace("-", " ")}</span>
                <span>{a.detail}</span>
                {a.source ? <small>Source: {a.source}</small> : null}
              </details>
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
              <small className="hint">{plan.coreLabel}. Suggested Core courses are examples; open one in the plan to swap in another course that fills the same categories.</small>
              {state.student.coreChoices?.prefer.length ? (
                <button className="linkbtn" style={{ justifySelf: "start", fontSize: 12 }} onClick={() => props.onCoreSwap()}>Undo my Core swaps</button>
              ) : null}
            </div>
          ) : null}

          {plan.cost ? (
            <div className="panel">
              <h3><span>Cost estimate</span><span>{money(plan.cost.total)}</span></h3>
              <div className="scroll">
                <table className="cost-t">
                  <thead><tr><th>Term</th><th>Hrs</th><th>Tuition</th><th>Neeley</th><th>Total</th></tr></thead>
                  <tbody>
                    {plan.cost.terms.map((t) => (
                      <tr key={t.term} className={compareTerms(t.term, plan.targetGradTerm) > 0 ? "late" : ""}>
                        <td>{t.term}</td>
                        <td>{t.hours}{t.neeleyHours ? <small> ({t.neeleyHours} Neeley)</small> : null}</td>
                        <td>{money(t.tuition)}{t.overload ? <small> incl. {money(t.overload)} over 18 hrs</small> : null}</td>
                        <td>{money(t.differential)}</td>
                        <td><b>{money(t.total)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small className="hint">
                12–18 hours is one flat rate, so Core and other non-Neeley classes add nothing until a term passes 18 hours ($1,735 per extra hour). Neeley courses (ACCT, BUSI, ENTR, FINA, INSC, MANA, MARK) add $270 per credit hour. Totals include {money(plan.cost.terms.find((t) => t.housing)?.housing ?? 0)} housing and food per fall and spring term. {plan.cost.notes.filter((n) => !n.startsWith("Housing")).join(" ")}{" "}
                <a href={plan.cost.source} target="_blank" rel="noreferrer">TCU tuition rates</a>
              </small>
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

      {drawer && (
        <CourseDrawer
          studentId={studentId}
          line={drawer.line}
          term={drawer.term}
          onClose={() => setDrawer(null)}
          onSwap={(to) => {
            props.onCoreSwap(drawer.line.code, to);
            setDrawer(null);
            props.toast(`Swapped ${drawer.line.code} for ${to}. Your plan is rebuilding.`);
          }}
        />
      )}

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

function CourseDrawer({ studentId, line, term, onClose, onSwap }: { studentId: string; line: PlanLine; term: string; onClose: () => void; onSwap: (to: string) => void }) {
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
          {line.core?.alternatives.length ? (
            <div>
              <span>Other courses that fill this slot</span>
              <ul className="alts">
                {line.core.alternatives.map((a) => (
                  <li key={a.code}>
                    <div>
                      <b><span className="mono">{a.code}</span> {a.title}</b>
                      <small>{a.categories.join(", ")} · {a.offered ? "Sections posted" : "No sections posted yet"}</small>
                    </div>
                    <button className="btn small" onClick={() => onSwap(a.code)}>Use this</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div><span>Source</span><span className="src">{line.source}</span>{info?.source ? <span className="src">{String(info.source)}</span> : null}</div>
        </div>
      </div>
    </div>
  );
}

type PlanTermT = Plan["terms"][number];

/** Groups terms into academic years: Fall Y and Spring Y+1 side by side, with that year's summer below. */
function academicYears(terms: PlanTermT[]) {
  const years = new Map<number, { start: number; fall?: PlanTermT; spring?: PlanTermT; summer?: PlanTermT }>();
  for (const t of terms) {
    const [season, yr] = t.term.split(" ");
    const start = season === "Fall" ? Number(yr) : Number(yr) - 1;
    if (!years.has(start)) years.set(start, { start });
    const y = years.get(start)!;
    if (season === "Fall") y.fall = t;
    else if (season === "Spring") y.spring = t;
    else y.summer = t;
  }
  return [...years.values()]
    .sort((a, b) => a.start - b.start)
    .map((y) => ({
      ...y,
      label: `${y.start}–${String(y.start + 1).slice(2)} academic year`,
      hours: [y.fall, y.spring, y.summer].reduce((n, t) => n + (t?.hours ?? 0), 0),
    }));
}

function TermCard({ t, onOpen, added, summer }: { t: PlanTermT; onOpen: (l: PlanLine) => void; added: string[]; summer?: boolean }) {
  return (
    <div className={`term${t.status === "in-progress" ? " prog" : ""}${summer ? " summer" : ""}`}>
      <header>
        <b>{t.term}</b>
        <span>{t.hours} hrs</span>
      </header>
      {t.status === "in-progress" && <div className="st">In progress · from transcript</div>}
      {summer && <div className="st summer-st">Summer · optional trade-off</div>}
      {t.hold && <div className="st">{t.hold}</div>}
      <div className="cl-list">
        {t.lines.map((l, i) => (
          <button key={`${l.code}-${i}`} className={`cl${l.slot ? " slot" : ""}${l.added === "swap" ? " swap" : ""}${added.includes(l.code) ? " new" : ""}`} onClick={() => onOpen(l)}>
            <span className="cl-code">{l.slot ? "Choose" : l.code}</span>
            <span className="cl-main">
              <span className="cl-title">{l.title}</span>
              {l.requirement !== l.title && <span className="cl-req">{l.requirement}</span>}
            </span>
            <span className="cl-hrs">{l.credits}</span>
            <span className={`conf ${l.confidence}`} title={`${CONF_LABEL[l.confidence] ?? l.confidence}: ${l.confidenceNote}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

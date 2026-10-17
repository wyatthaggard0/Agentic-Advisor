"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import type { Review } from "@/lib/store";

export default function AdvisorPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [viewerName, setViewerName] = useState("");
  const [resetting, setResetting] = useState(false);
  const [db, setDb] = useState(false);

  const load = useCallback(async () => {
    const me = await fetch("/api/me");
    if (me.status === 401) {
      window.location.href = "/login";
      return;
    }
    const who = await me.json();
    // The queue is advisor-only; students go back to their own plan
    if (who.viewer && who.viewer.role !== "advisor") {
      window.location.href = "/";
      return;
    }
    setDb(!!who.database);
    if (who.viewer) setViewerName(who.viewer.displayName);
    const res = await fetch("/api/review");
    const data = await res.json();
    setReviews(data.reviews ?? []);
  }, []);

  async function resetDemo() {
    setResetting(true);
    const res = await fetch("/api/admin/reset", { method: "POST" });
    setResetting(false);
    if (res.ok) load();
  }
  useEffect(() => {
    load();
    const f = () => load();
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [load]);

  async function decide(r: Review, action: "approve" | "request-changes") {
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewId: r.id, note: notes[r.id] ?? "" }),
    });
    load();
  }

  return (
    <>
      <Header advisor viewerName={viewerName} />
      <main className="wrap">
        <div className="strip">
          <div>
            <h1>Review queue</h1>
            <div className="meta">Plans students sent for sign-off. Each one arrives with the engine&rsquo;s checks and the questions only an advisor can answer.</div>
          </div>
          {db && (
            <button className="btn" onClick={resetDemo} disabled={resetting} title="Restore Jordan and Maya to their starting records and clear reviews, surveys and uploads">
              {resetting ? "Resetting…" : "Reset demo data"}
            </button>
          )}
        </div>
        {reviews.length === 0 && <div className="banner info"><div>No plans waiting. Send one from the Graduation Blueprint tab.</div></div>}
        <div style={{ display: "grid", gap: 18 }}>
          {reviews.map((r) => {
            const fails = r.plan.checks.filter((c) => !c.pass).length;
            return (
              <div key={r.id} className="panel">
                <h3>
                  <span>{r.studentName} · {r.programs.join(" + ")}</span>
                  <span>{r.status.replace("-", " ")} · sent {new Date(r.submittedAt).toLocaleString()}</span>
                </h3>
                <div className="facts">
                  <div className="fact"><span>Graduation</span><b>{r.plan.gradTerm}</b></div>
                  <div className="fact"><span>Hours</span><b>{r.plan.totals.hours}/{r.plan.totals.required}</b></div>
                  <div className="fact"><span>Checks</span><b className={fails ? "risk" : ""}>{r.plan.checks.length - fails}/{r.plan.checks.length}</b></div>
                  <div className="fact"><span>Questions</span><b>{r.questions.length}</b></div>
                </div>
                <div className="scroll">
                  <table className="tx">
                    <thead><tr><th>Term</th><th>Courses</th></tr></thead>
                    <tbody>
                      {r.plan.terms.map((t) => (
                        <tr key={t.term}>
                          <td>{t.term}<br /><small>{t.hours} hrs</small></td>
                          <td>{t.lines.map((l) => (l.slot ? `[${l.title}]` : `${l.code} (${l.confidence})`)).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <b style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em" }}>Needs your decision</b>
                  <ul>{r.questions.map((q) => <li key={q} style={{ fontSize: 13 }}>{q}</li>)}</ul>
                </div>
                {r.status === "submitted" ? (
                  <>
                    <textarea className="note" placeholder="Note to the student (e.g. transfer credit confirmed with the registrar)" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                    <div className="acts">
                      <button className="btn" onClick={() => decide(r, "request-changes")}>Request changes</button>
                      <button className="btn primary" onClick={() => decide(r, "approve")}>Approve plan</button>
                    </div>
                  </>
                ) : (
                  <div className={`status ${r.status}`}><b>{r.status === "approved" ? "Approved" : "Changes requested"}</b><span>{r.advisorNote}</span></div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

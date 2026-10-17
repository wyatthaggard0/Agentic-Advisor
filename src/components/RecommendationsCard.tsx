"use client";

import type { MatchItem, PathwayItem, Recommendations } from "@/lib/careers";

export type BuildKind = "major" | "double-major" | "minor" | "certificate";
type OnBuild = (programIds: string[], kind: BuildKind, label: string) => void;

function MatchRow({ item, extra, onPick }: { item: MatchItem; extra?: React.ReactNode; onPick?: () => void }) {
  const pick = onPick && item.programIds?.length ? onPick : undefined;
  return (
    <li
      className={`match${pick ? " pickable" : ""}`}
      {...(pick
        ? {
            role: "button",
            tabIndex: 0,
            onClick: pick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick();
              }
            },
            "aria-label": `${item.name}: build my Graduation Blueprint with this`,
          }
        : {})}
    >
      <div className="match-top">
        <b>{item.name}</b>
        <span className="pct">{item.score}% match</span>
      </div>
      {item.detail ? <div className="match-detail">{item.detail}</div> : null}
      {extra}
      <div className="mbar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.score} aria-label={`${item.name}: ${item.score}% match to your survey answers`}>
        <i style={{ width: `${item.score}%` }} />
      </div>
      {item.reasons.length ? <div className="why">Why: {item.reasons.join(" · ")}</div> : null}
      {pick ? <span className="build-cta">Build my plan with this →</span> : null}
    </li>
  );
}

function Section({ title, hint, items, render, onPick }: { title: string; hint?: string; items?: MatchItem[]; render?: (i: MatchItem) => React.ReactNode; onPick?: (i: MatchItem) => void }) {
  if (!items?.length) return null;
  return (
    <div className="rec-sec">
      <h6>{title}</h6>
      {hint ? <p className="hint" style={{ margin: "-4px 0 8px" }}>{hint}</p> : null}
      <ul>{items.map((i) => <MatchRow key={i.name} item={i} extra={render?.(i)} onPick={onPick ? () => onPick(i) : undefined} />)}</ul>
    </div>
  );
}

const pathwayExtra = (i: MatchItem) => {
  const p = i as PathwayItem;
  return (
    <>
      {p.impact ? <div className="impact">{p.impact}</div> : null}
      <div className="src-line">Source: {p.source}</div>
    </>
  );
};

export function RecommendationsCard({ recs, onBuild }: { recs: Recommendations; onBuild?: OnBuild }) {
  const explore = recs.stage === "explore";
  // Incoming, freshman and sophomore students can open a plan built around any recommended option in one click
  const pick = (kind: BuildKind) => (explore && onBuild ? (i: MatchItem) => onBuild(i.programIds ?? [], kind, i.name) : undefined);
  const hasPathways = !!(recs.doubleMajors?.length || recs.minors?.length || recs.certificates?.length || recs.neeleyPrograms?.length);
  return (
    <div className="card recs">
      <h5>{recs.headline}</h5>
      {explore ? (
        <div className="rec-grid">
          <Section title="Recommended majors" hint={explore && onBuild ? "Click one to see your four-year plan with it." : undefined} items={recs.majors} onPick={pick("major")} />
          <Section title="Career areas to explore" items={recs.areas} />
        </div>
      ) : (
        <>
          <div className="rec-grid">
            <Section title="Job titles to target" items={recs.roles} />
            <Section title="Companies to research" items={recs.companies} />
          </div>
          <Section
            title="Internship opportunities"
            items={recs.internships}
            render={(i) => {
              const it = recs.internships!.find((x) => x.name === i.name)!;
              return (
                <div className="match-detail">
                  {it.apply}
                  {it.companies.length ? <> · Try: {it.companies.join(", ")}</> : null}
                </div>
              );
            }}
          />
        </>
      )}

      {hasPathways && (
        <>
          <h5 className="rec-h2">Programs &amp; pathways at Neeley</h5>
          <div className="rec-grid">
            <Section
              title="Popular double majors"
              hint="Pairings chosen for overlapping requirements and career fit, not enrollment data."
              items={recs.doubleMajors}
              render={pathwayExtra}
              onPick={pick("double-major")}
            />
            <Section title="Minors" items={recs.minors} render={pathwayExtra} onPick={pick("minor")} />
            <Section title="Certificates" items={recs.certificates} render={pathwayExtra} onPick={pick("certificate")} />
            <Section title="Neeley programs" hint="TIP Board, Fellows, the Neeley Leadership Program and more, shown when they fit your year." items={recs.neeleyPrograms} render={pathwayExtra} />
          </div>
        </>
      )}

      {recs.doubleMajoring?.text ? (
        <div className="dm-box">
          <b>{recs.doubleMajoring.already ? "You're already double majoring" : "Thinking about a double major?"}</b>
          <span>{recs.doubleMajoring.text}</span>
          <span className="src-line">Source: {recs.doubleMajoring.source}</span>
        </div>
      ) : null}

      <p className="rec-foot"><b>Timing:</b> {recs.timing}</p>
      <p className="hint">{recs.scoring} {recs.note}</p>
    </div>
  );
}

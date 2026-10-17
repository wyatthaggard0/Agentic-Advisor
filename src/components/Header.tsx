"use client";

import Link from "next/link";

export type Tab = "chat" | "plan" | "schedule";

export function Header(props: {
  students?: { id: string; name: string; tag: string }[];
  studentId?: string;
  onStudent?: (id: string) => void;
  tab?: Tab;
  onTab?: (t: Tab) => void;
  advisor?: boolean;
  viewerName?: string;
}) {
  async function signOut() {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.href = "/login";
  }
  return (
    <div className="top">
      <div className="bar">
        <div className="bar-in">
          <Link className="brand" href="/">
            <span className="mark">GB</span>
            <div>
              <b>Graduation Blueprint</b>
              <small>Neeley School of Business · planning assistant prototype</small>
            </div>
          </Link>
          {props.students && (
            <div className="seg" role="group" aria-label="Demo student">
              {props.students.map((s) => (
                <button key={s.id} aria-pressed={s.id === props.studentId} onClick={() => props.onStudent?.(s.id)}>
                  {s.name.split(" ")[0]} · {s.tag.split("·")[0].trim()}
                </button>
              ))}
            </div>
          )}
          <span className="pill teal">Sample students</span>
          {props.viewerName && (
            <span className="who">
              {props.viewerName}
              <button className="pill ghost" onClick={signOut}>Sign out</button>
            </span>
          )}
        </div>
      </div>
      <div className="band">
        <div className="band-in">
          <div className="tabs" role="tablist">
            {props.advisor ? (
              <>
                <Link href="/">Student view</Link>
                <a aria-selected="true">Advisor review queue</a>
              </>
            ) : (
              <>
                {(["chat", "plan", "schedule"] as Tab[]).map((t) => (
                  <button key={t} role="tab" aria-selected={props.tab === t} onClick={() => props.onTab?.(t)}>
                    {t === "chat" ? "Advisor Chat" : t === "plan" ? "Graduation Blueprint" : "Next Semester"}
                  </button>
                ))}
                <Link href="/advisor" target="_blank">
                  Advisor view
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

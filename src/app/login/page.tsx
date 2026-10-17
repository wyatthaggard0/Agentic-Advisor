"use client";

import { useState } from "react";

const DEMOS = [
  { who: "jordan", label: "Jordan Kim", sub: "Junior · Finance + BIS" },
  { who: "maya", label: "Maya Ortiz", sub: "First-year · undecided" },
  { who: "advisor", label: "Advisor", sub: "Review queue" },
];

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(body: Record<string, string>) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Sign-in failed");
    }
    window.location.href = data.role === "advisor" ? "/advisor" : "/";
  }

  return (
    <main className="login-bg">
      <div className="login-card" role="form" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="mark">GB</span>
          <b>Graduation Blueprint</b>
        </div>
        <h1 id="login-title">Sign In</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn({ action: "login", email: user, password: pass });
          }}
        >
          <label className="login-field">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4.5" /><path d="M3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z" /></svg>
            <input id="login-user" type="text" autoComplete="username" placeholder="Username" aria-label="Username" value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label className="login-field">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
            <input id="login-pass" type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <button className="login-submit" type="submit" disabled={busy}>Sign In</button>
        </form>
        {error && <p className="login-error" role="alert">{error}</p>}

        <div className="login-demo">
          <span>Demo accounts</span>
          {DEMOS.map((d) => (
            <button key={d.who} type="button" disabled={busy} onClick={() => signIn({ action: "demo", who: d.who })}>
              <b>Continue as {d.label}</b>
              <small>{d.sub}</small>
            </button>
          ))}
        </div>
        <p className="login-note">Demo environment for the Neeley AI Forward competition. Sample students only. Never enter your TCU password here.</p>
      </div>
    </main>
  );
}

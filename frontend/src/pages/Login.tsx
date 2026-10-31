import { FormEvent, useState } from "react";
import { Flower2, LockKeyhole } from "lucide-react";
import { api } from "../lib/api";
import type { LoginUser } from "../types";

interface Props {
  onLogin: (user: LoginUser) => Promise<void>;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ user: LoginUser }>("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      await onLogin(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark"><Flower2 size={25} /></span><span>DayBloom</span></div>
        <p className="eyebrow">Productive raho bahen!!</p>
        <h1>Welcome back</h1>
        <p className="login-intro">A little progress, cared for every day.</p>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="username">Username</label>
          <input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" disabled={submitting}>
            <LockKeyhole size={17} /> {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="privacy-note">Your check-ins are private and only visible to your account.(ikr!!)</p>
      </section>
    </main>
  );
}

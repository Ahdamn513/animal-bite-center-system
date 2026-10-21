"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else if (data.session) router.push("/book");
      else setInfo("Account created. Check your email to confirm it, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      else router.push("/book");
    }
    setBusy(false);
  }

  return (
    <div className="stack" style={{ maxWidth: "26rem" }}>
      <h1>{mode === "login" ? "Log in" : "Create an account"}</h1>

      {!supabaseConfigured && (
        <div className="notice notice-error">
          Supabase keys are missing. Add them to .env.local and restart the
          dev server.
        </div>
      )}

      <form onSubmit={submit} className="card stack">
        {mode === "signup" && (
          <label className="field">
            Full name
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
        )}
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <div className="notice notice-error">{error}</div>}
        {info && <div className="notice notice-success">{info}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Please wait" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="muted">
        {mode === "login" ? "New patient? " : "Already have an account? "}
        <button
          className="btn btn-small"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Create an account" : "Log in instead"}
        </button>
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Msg = { from: "user" | "bot"; text: string };

const SUGGESTIONS = [
  "I was just bitten. What do I do first?",
  "Why do I need several visits?",
  "What should I bring?",
  "How does booking work?",
];

export default function FaqPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "bot",
      text: "Hello. Ask me about first aid after a bite, the visit schedule or how booking works. You can write in English or Filipino.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setMessages((m) => [...m, { from: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { from: "bot", text: data.reply ?? data.error ?? "Something went wrong." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "I could not reach the server. Please try again, or ask the front desk." },
      ]);
    }
    setBusy(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <>
      <div className="stack">
        <h1>Ask a question</h1>
        <p className="lead">
          General answers in English or Filipino. For decisions about your own
          treatment, talk to the center&apos;s staff.
        </p>
      </div>

      <section className="card stack">
        <div className="chat-log" aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`bubble ${m.from === "user" ? "bubble-user" : "bubble-bot"}`}
            >
              {m.text}
            </div>
          ))}
          {busy && <div className="bubble bubble-bot">Thinking</div>}
        </div>

        <div className="row">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="row">
          <label className="field" style={{ flex: 1 }}>
            <span className="muted">Your question</span>
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Nakagat ako ng aso, ano po ang una kong gagawin?"
            />
          </label>
          <button className="btn btn-primary" disabled={busy || !input.trim()}>
            Send question
          </button>
        </form>
      </section>

      <div className="notice notice-warn">
        This assistant gives general information only. It cannot diagnose or
        decide your treatment. Bites to the face or head, heavy bleeding or a
        sick animal need the center now.
      </div>
    </>
  );
}

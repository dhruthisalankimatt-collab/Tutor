"use client";

import { useState } from "react";

export default function ClientTutor() {
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: string; text: string }>>([]);
  const [inputAnswer, setInputAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);

  async function handleSend(action: "ask" | "hint" | "answer" | "giveup" | "chat", text?: string) {
    setLoading(true);
    setError(null);
    const content = text ?? (action === "ask" ? question : inputAnswer);

    if (action === "ask") {
      setMessages([{ sender: "student", text: content }]);
    } else if (content) {
      setMessages((prev) => [...prev, { sender: "student", text: content }]);
    }

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          action,
          text: content,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (data.sessionId) setSessionId(data.sessionId);
      if (data.status) setStatus(data.status);
      if (data.reply) {
        setMessages((prev) => [...prev, { sender: "tutor", text: data.reply }]);
      }
      setInputAnswer("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Tutor Session ({status})</h2>
        {sessionId && <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>ID: {sessionId.slice(0, 8)}...</span>}
      </div>

      {error && (
        <div style={{ backgroundColor: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: "0.875rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Messages */}
      <div style={{ minHeight: 180, maxHeight: 350, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 6, padding: 12, marginBottom: 16 }}>
        {messages.length === 0 ? (
          <p style={{ color: "#94a3b8", fontStyle: "italic", textAlign: "center", marginTop: 60 }}>
            Enter a question below to start learning with the Socratic tutor!
          </p>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 10,
                textAlign: m.sender === "student" ? "right" : "left",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 12,
                  maxWidth: "80%",
                  textAlign: "left",
                  backgroundColor: m.sender === "student" ? "#2563eb" : "#f1f5f9",
                  color: m.sender === "student" ? "#ffffff" : "#0f172a",
                  fontSize: "0.925rem",
                  lineHeight: 1.5,
                }}
              >
                <strong>{m.sender === "student" ? "You" : "Tutor"}: </strong>
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Question setup or answer controls */}
      {!sessionId || status !== "In Progress" ? (
        <div>
          <textarea
            placeholder="Type your question here (e.g. 'Solve 3x + 5 = 20' or 'Why do leaves change color?')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "0.95rem" }}
          />
          <button
            onClick={() => handleSend("ask")}
            disabled={loading || !question.trim()}
            style={{ marginTop: 10, padding: "10px 18px", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >
            {loading ? "Starting..." : "Start Question"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Your answer or thoughts..."
              value={inputAnswer}
              onChange={(e) => setInputAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend("answer")}
              style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
            />
            <button
              onClick={() => handleSend("answer")}
              disabled={loading || !inputAnswer.trim()}
              style={{ padding: "10px 18px", backgroundColor: "#16a34a", color: "#ffffff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
            >
              Submit Answer
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleSend("hint")}
              disabled={loading}
              style={{ padding: "8px 14px", backgroundColor: "#f59e0b", color: "#ffffff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
            >
              💡 Give me a hint
            </button>
            <button
              onClick={() => handleSend("giveup")}
              disabled={loading}
              style={{ padding: "8px 14px", backgroundColor: "#ef4444", color: "#ffffff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
            >
              🏳️ I give up (Show Solution)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

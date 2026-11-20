"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export default function EditKeysPage() {
  const [configs, setConfigs] = useState<any>({
    agent1: { model_name: "qwen/qwen3.8-27b", system_prompt: "", api_key: "" },
    agent2: { model_name: "qwen/qwen3.8-27b", system_prompt: "", api_key: "" },
    agent3: { model_name: "qwen/qwen3.8-27b", system_prompt: "", api_key: "" },
    vision: { model_name: "meta-llama/llama-4-scout-17b-16e-instruct", system_prompt: "", api_key: "" },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  // Reset database state
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/keys")
      .then((res) => res.json())
      .then((data) => {
        if (data.configs) {
          setConfigs((prev: any) => ({
            ...prev,
            ...data.configs,
          }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(null);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaveSuccess("All configurations and API keys saved successfully!");
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(agentName: string) {
    const item = configs[agentName];
    setTesting((prev) => ({ ...prev, [agentName]: true }));
    setTestStatus((prev) => ({ ...prev, [agentName]: "" }));

    try {
      const res = await fetch("/api/admin/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: item.api_key || item.masked_key,
          modelName: item.model_name,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, [agentName]: "✓ " + data.message }));
      } else {
        setTestStatus((prev) => ({ ...prev, [agentName]: "⚠️ " + data.error }));
      }
    } catch (e: any) {
      setTestStatus((prev) => ({ ...prev, [agentName]: "⚠️ Error testing connection" }));
    } finally {
      setTesting((prev) => ({ ...prev, [agentName]: false }));
    }
  }

  async function handleResetDatabase() {
    if (confirmPhrase !== "CONFIRM RESET") return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmPhrase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetMsg("Success: Student database learning records have been cleared.");
      setShowResetModal(false);
    } catch (e: any) {
      alert("Reset error: " + e.message);
    } finally {
      setResetting(false);
    }
  }

  const agents = [
    { id: "agent1", title: "Agent 1: Student Chatbot (Tutor)", desc: "Socratic guide for Smruthi (progressive hints)" },
    { id: "agent2", title: "Agent 2: Performance Analyst", desc: "Analyzes completed questions and mistake trends" },
    { id: "agent3", title: "Agent 3: Prompt Configuration Manager", desc: "Dynamically manages academic instructions" },
    { id: "vision", title: "Groq Vision API (OCR)", desc: "Transcribes math problems and diagrams from photos" },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-xl font-bold text-slate-900">AI Keys & Agent Settings</h1>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* 4 Agent Configuration Cards */}
      <div className="space-y-4">
        {agents.map((ag) => {
          const cfg = configs[ag.id] || {};
          return (
            <div key={ag.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{ag.title}</h3>
                  <p className="text-xs text-slate-500">{ag.desc}</p>
                </div>
                {cfg.has_key && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    Key Configured
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Groq API Key {cfg.masked_key && `(Saved: ${cfg.masked_key})`}
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new gsk_... key or leave blank to keep"
                    value={cfg.api_key || ""}
                    onChange={(e) =>
                      setConfigs({
                        ...configs,
                        [ag.id]: { ...cfg, api_key: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={cfg.model_name || ""}
                    onChange={(e) =>
                      setConfigs({
                        ...configs,
                        [ag.id]: { ...cfg, model_name: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  System Prompt
                </label>
                <textarea
                  rows={2}
                  value={cfg.system_prompt || ""}
                  onChange={(e) =>
                    setConfigs({
                      ...configs,
                      [ag.id]: { ...cfg, system_prompt: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleTest(ag.id)}
                  disabled={testing[ag.id]}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  {testing[ag.id] ? "Testing..." : "Test Connectivity"}
                </button>
                {testStatus[ag.id] && (
                  <span className="text-xs font-medium text-slate-600">{testStatus[ag.id]}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 text-sm"
        >
          {saving ? "Saving Changes..." : "Save All Configurations"}
        </button>
      </div>

      {/* Danger Zone: Reset Database */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <h3 className="font-bold text-red-900 text-sm">Danger Zone: Reset Student Database</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              This will permanently erase all student learning history (question sessions, chat messages,
              hints, attempts, and analytics). Login credentials, password hashes, Groq keys, and
              academic profile will be safely preserved.
            </p>
          </div>
        </div>

        {resetMsg && (
          <div className="p-3 bg-white border border-red-300 text-red-800 rounded-xl text-xs font-semibold">
            {resetMsg}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow"
          >
            Reset Database...
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-red-600 text-base">Confirm Database Reset</h3>
            <p className="text-xs text-slate-600">
              Type <strong className="text-slate-900 font-mono">CONFIRM RESET</strong> below to
              permanently erase student learning sessions.
            </p>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="CONFIRM RESET"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDatabase}
                disabled={confirmPhrase !== "CONFIRM RESET" || resetting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs"
              >
                {resetting ? "Resetting..." : "Erase Student History"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

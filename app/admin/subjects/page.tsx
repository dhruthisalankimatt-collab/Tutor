"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function EditSubjectsPage() {
  const [profile, setProfile] = useState({
    name: "Smruthi",
    grade: "10",
    board: "CBSE",
    school: "Narayana",
  });

  const [subjects, setSubjects] = useState<Array<{ id?: string; name: string; is_active: boolean }>>([]);
  const [newSubject, setNewSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [agent3Summary, setAgent3Summary] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
        if (data.subjects) setSubjects(data.subjects);
      });
  }, []);

  function handleAddSubject() {
    if (!newSubject.trim()) return;
    setSubjects((prev) => [...prev, { name: newSubject.trim(), is_active: true }]);
    setNewSubject("");
  }

  function handleRemoveSubject(idx: number) {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveChanges() {
    setSaving(true);
    setSuccessMsg(null);
    setAgent3Summary(null);

    try {
      // 1. Save profile and subjects
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, subjects }),
      });
      if (!res.ok) throw new Error("Failed to save profile");

      // 2. Trigger Agent 3 to update system prompts!
      const a3Res = await fetch("/api/agent3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newProfile: profile,
          subjects,
        }),
      });
      const a3Data = await a3Res.json();

      setSuccessMsg("Academic profile and subjects saved successfully!");
      if (a3Data.change_summary) {
        setAgent3Summary(a3Data.change_summary);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Edit Student Profile & Subjects</h1>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {agent3Summary && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-indigo-700">
            <Sparkles className="w-4 h-4" />
            <span>Agent 3 Prompt Synchronization:</span>
          </div>
          <p className="text-indigo-800">{agent3Summary}</p>
        </div>
      )}

      {/* Student Profile Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Student Academic Profile</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Student Name</label>
            <input
              type="text"
              value={profile.name || "Smruthi"}
              disabled
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Grade / Class</label>
            <input
              type="text"
              value={profile.grade}
              onChange={(e) => setProfile({ ...profile, grade: e.target.value })}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Education Board</label>
            <input
              type="text"
              value={profile.board}
              onChange={(e) => setProfile({ ...profile, board: e.target.value })}
              placeholder="e.g. CBSE"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">School Name</label>
            <input
              type="text"
              value={profile.school}
              onChange={(e) => setProfile({ ...profile, school: e.target.value })}
              placeholder="e.g. Narayana"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Subjects Management */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Active Subjects</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
            placeholder="Add new subject (e.g. Physics, Chemistry)..."
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
          />
          <button
            onClick={handleAddSubject}
            className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {subjects.map((subj, idx) => (
            <div key={idx} className="p-3 bg-slate-50 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">{subj.name}</span>
              <button
                onClick={() => handleRemoveSubject(idx)}
                className="text-slate-400 hover:text-red-500 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 text-sm"
        >
          {saving ? "Saving & Syncing Prompts..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

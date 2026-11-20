"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  KeyRound,
  BookOpen,
  LogOut,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  TrendingUp,
  BrainCircuit,
  Search,
  Filter,
  Eye,
  Award,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Flag,
} from "lucide-react";
import FormattedMessage from "@/components/formatted-message";

interface AdminClientProps {
  user: { name: string; username: string };
  profile: { name: string; grade: string; board: string; school: string };
  sessions: any[];
  analytics: any[];
  subjects: any[];
}

export default function AdminDashboardClient({
  user,
  profile: initialProfile,
  sessions: initialSessions,
  analytics: initialAnalytics,
  subjects: initialSubjects,
}: AdminClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [sessions, setSessions] = useState(initialSessions);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [inspectSession, setInspectSession] = useState<any | null>(null);

  // Live Refresh
  async function refreshData() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) setSessions(data.sessions);
        if (data.analytics) setAnalytics(data.analytics);
        if (data.profile) setProfile(data.profile);
        if (data.subjects) setSubjects(data.subjects);
      }
    } catch (err) {
      console.warn("Failed to refresh admin analytics:", err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); // Poll every 5s for live updates
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Aggregate Calculations
  const totalAttempted = sessions.length;
  const totalSolved = sessions.filter((s) => s.status === "Solved").length;
  const totalGivenUp = sessions.filter((s) => s.status === "Given Up").length;

  const totalHints = sessions.reduce((acc, curr) => acc + (curr.hints_count || 0), 0);
  const avgHints = totalAttempted > 0 ? (totalHints / totalAttempted).toFixed(1) : "0.0";
  const totalTimeSeconds = sessions.reduce((acc, curr) => acc + (curr.total_time_seconds || 0), 0);
  const avgTimeMinutes =
    totalAttempted > 0 ? (totalTimeSeconds / totalAttempted / 60).toFixed(1) : "0.0";

  // Overall Score Calculation
  const conceptualScores = analytics.map((a) => a.conceptual_score).filter(Boolean);
  const overallScore =
    conceptualScores.length > 0
      ? Math.round(conceptualScores.reduce((a, b) => a + b, 0) / conceptualScores.length)
      : totalAttempted > 0
      ? Math.round((totalSolved / totalAttempted) * 100)
      : 80;

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    const matchSearch =
      !search ||
      (s.question_text || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.subject || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.topic || "").toLowerCase().includes(search.toLowerCase());
    const matchSubject = selectedSubject === "all" || s.subject === selectedSubject;
    const matchStatus = selectedStatus === "all" || s.status === selectedStatus;
    return matchSearch && matchSubject && matchStatus;
  });

  const latestAnalysis = analytics.length > 0 ? analytics[0] : null;

  return (
    <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
      {/* Top Admin Header */}
      <header className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Admin Analytics Dashboard</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                Admin: {user.name}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Student Monitored: <strong className="text-slate-800">{profile.name}</strong> • Grade{" "}
              {profile.grade} ({profile.board}) • {profile.school} School
            </p>
          </div>
        </div>

        {/* Top-Right Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-sm transition"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
            <span>{refreshing ? "Syncing..." : "Refresh"}</span>
          </button>

          <Link
            href="/admin/keys"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
          >
            <KeyRound className="w-4 h-4 text-slate-600" />
            <span>Edit Keys</span>
          </Link>

          <Link
            href="/admin/subjects"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4 text-slate-600" />
            <span>Edit Subjects</span>
          </Link>

          <button
            onClick={handleLogout}
            className="px-3.5 py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Attempted</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalAttempted}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Total questions</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Solved</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalSolved}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {totalAttempted > 0 ? Math.round((totalSolved / totalAttempted) * 100) : 0}% success rate
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-500">Given Up</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{totalGivenUp}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Solution revealed</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Hints Taken</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{totalHints}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{avgHints} avg / question</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Avg Time</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{avgTimeMinutes}m</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Per problem</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Overall Score</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{overallScore}/100</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Observed accuracy</p>
        </div>
      </div>

      {/* Agent 2 Insights Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Lightbulb className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Agent 2: Real-Time Performance Analytics & Insights
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full uppercase tracking-wider">
                Live Evaluator
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {latestAnalysis?.analytical_summary ||
                "Smruthi is actively practicing academic concepts. As she solves problems or requests hints, Agent 2 updates her conceptual understanding, formula accuracy, and specific recommendations here on every prompt."}
            </p>
            {latestAnalysis?.recommendations && latestAnalysis.recommendations.length > 0 && (
              <div className="pt-2 text-xs text-indigo-950 flex flex-wrap gap-1.5 items-center">
                <span className="font-bold text-indigo-800">Recommendations: </span>
                {latestAnalysis.recommendations.map((rec: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-block bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-md font-medium"
                  >
                    {rec}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Question History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Detailed Question History</h2>
            <p className="text-xs text-slate-500">
              Live records of every question attempted by Smruthi (including Solved & Given Up)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search question..."
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
            >
              <option value="all">All Statuses ({sessions.length})</option>
              <option value="Solved">Solved ({totalSolved})</option>
              <option value="Given Up">Given Up ({totalGivenUp})</option>
              <option value="In Progress">In Progress ({sessions.length - totalSolved - totalGivenUp})</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Question</th>
                <th className="py-3 px-4">Subject & Topic</th>
                <th className="py-3 px-4">Hints Taken</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                    No questions match the current filter.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((sess) => {
                  const dateStr = new Date(sess.started_at || Date.now()).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isGivenUp = sess.status === "Given Up";
                  const isSolved = sess.status === "Solved";

                  return (
                    <tr
                      key={sess.id}
                      className={`hover:bg-slate-50 transition ${
                        isGivenUp ? "bg-red-50/20" : isSolved ? "bg-green-50/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{dateStr}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                        {sess.question_text || "Photo question"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                          {sess.subject || "General"} {sess.topic ? `• ${sess.topic}` : ""}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {sess.hints_count || 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold px-2.5 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 ${
                            isSolved
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : isGivenUp
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isGivenUp && <Flag className="w-3 h-3 text-red-600" />}
                          {sess.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {sess.total_time_seconds ? `${sess.total_time_seconds}s` : "--"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setInspectSession(sess)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Question Details Modal */}
      {inspectSession && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Session Inspection</h3>
                <p className="text-xs text-slate-500">Session ID: #{inspectSession.id}</p>
              </div>
              <button
                onClick={() => setInspectSession(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Question</p>
                <p className="text-slate-900 font-medium">{inspectSession.question_text}</p>
                {inspectSession.image_url && (
                  <div className="mt-2 max-w-xs rounded-lg overflow-hidden border">
                    <img src={inspectSession.image_url} alt="Attached question" className="w-full" />
                  </div>
                )}
              </div>

              {inspectSession.correct_answer && (
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">
                    Secret Correct Answer (Server Truth)
                  </p>
                  <p className="text-emerald-950 font-semibold">{inspectSession.correct_answer}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <span className="text-slate-500">Subject:</span>{" "}
                  <strong className="text-slate-800">{inspectSession.subject || "N/A"}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <span className="text-slate-500">Status:</span>{" "}
                  <strong
                    className={
                      inspectSession.status === "Given Up"
                        ? "text-red-700 font-bold"
                        : inspectSession.status === "Solved"
                        ? "text-green-700 font-bold"
                        : "text-amber-700 font-bold"
                    }
                  >
                    {inspectSession.status}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <span className="text-slate-500">Hints Taken:</span>{" "}
                  <strong className="text-slate-800">{inspectSession.hints_count || 1}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <span className="text-slate-500">Incorrect Attempts:</span>{" "}
                  <strong className="text-slate-800">{inspectSession.incorrect_attempts || 0}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button
                onClick={() => setInspectSession(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

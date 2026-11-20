"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  Sparkles,
  Send,
  HelpCircle,
  Flag,
  RotateCcw,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  X,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import FormattedMessage from "@/components/formatted-message";

interface StudentChatProps {
  user: { name: string; username: string; role: string };
  profile: { grade: string; board: string; school: string };
}

interface Message {
  id: string;
  sender: "student" | "tutor";
  text: string;
  image?: string;
  type?: "ask" | "hint" | "answer" | "giveup" | "chat";
  isCorrect?: boolean;
  mistake?: string;
}

export default function StudentChat({ user, profile }: StudentChatProps) {
  const router = useRouter();

  // Active question context state (persists until "New Question" is clicked)
  const [activeQuestion, setActiveQuestion] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("Ready");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image & Camera state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Memory Reset: Only clears conversational context when the student explicitly starts a new question!
  function handleNewQuestion() {
    setSessionId(null);
    setActiveQuestion("");
    setSessionStatus("Ready");
    setMessages([]);
    setInputVal("");
    setImagePreview(null);
    setOcrText(null);
    setError(null);
  }

  // Camera handling
  async function openCamera() {
    setShowCamera(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setError("Camera access denied or unavailable: " + err.message);
      setShowCamera(false);
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setImagePreview(dataUrl);
      setShowImageEditor(true);
    }
    closeCamera();
  }

  // File upload handling
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setShowImageEditor(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Rotate image by 90 degrees
  function rotateImage(direction: "cw" | "ccw") {
    if (!imagePreview) return;
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.src = imagePreview;
    img.onload = () => {
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((direction === "cw" ? 90 : -90) * (Math.PI / 180));
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        setImagePreview(canvas.toDataURL("image/jpeg", 0.9));
      }
    };
  }

  // OCR using Groq Vision API
  async function runOCR() {
    if (!imagePreview) return;
    setOcrLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imagePreview }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "OCR failed");
      }
      setOcrText(data.text);
      setInputVal(data.text);
      setShowImageEditor(false);
    } catch (err: any) {
      setError("Groq Vision OCR notice: " + err.message + ". You can review or edit your question directly.");
      setShowImageEditor(false);
    } finally {
      setOcrLoading(false);
    }
  }

  // Main interaction loop with Agent 1
  async function handleSend(
    action: "ask" | "hint" | "answer" | "giveup" | "chat",
    overrideText?: string
  ) {
    const rawContent = (overrideText ?? inputVal).trim();
    const currentAttachedImage = imagePreview;

    // Determine problem context
    let targetAction = action;
    let questionContext = activeQuestion;

    // If session is already closed (Solved or Given Up), starting a new question creates a brand new session!
    const isSessionClosed = sessionStatus === "Solved" || sessionStatus === "Given Up";

    if (!sessionId || targetAction === "ask" || isSessionClosed) {
      targetAction = "ask";
      questionContext = rawContent || ocrText || "Question from attached image";
      setActiveQuestion(questionContext);
    }

    if (!rawContent && !currentAttachedImage && targetAction !== "hint" && targetAction !== "giveup") {
      return;
    }

    setLoading(true);
    setError(null);

    // Build student display message with attached image included in chat!
    let displayMessage = rawContent;
    if (targetAction === "hint") displayMessage = "Can you give me another progressive hint?";
    if (targetAction === "giveup") displayMessage = "I give up. Please show me the complete solution.";

    const studentMessageObj: Message = {
      id: crypto.randomUUID(),
      sender: "student",
      text: displayMessage,
      image: currentAttachedImage || undefined,
      type: targetAction,
    };

    // If starting a brand new question, reset messages for visual clarity
    const baseHistory = isSessionClosed ? [] : messages;
    const updatedHistory = [...baseHistory, studentMessageObj];
    setMessages(updatedHistory);

    // Clear current inputs
    setInputVal("");
    setImagePreview(null);
    setOcrText(null);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: isSessionClosed ? undefined : (sessionId || undefined),
          action: targetAction,
          text: displayMessage,
          activeQuestion: questionContext,
          imageUrl: currentAttachedImage || undefined,
          history: updatedHistory.map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "The tutor could not respond");
      }

      if (data.sessionId) setSessionId(data.sessionId);
      if (data.status) setSessionStatus(data.status);

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: "tutor",
            text: data.reply,
            type: targetAction,
            isCorrect: data.is_correct,
            mistake: data.mistake,
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto w-full p-2 sm:p-4">
      {/* Top Navbar */}
      <header className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-3.5 mb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base leading-tight">
                Smruthi's Socratic Tutor
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                Grade {profile.grade} • {profile.board}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Personalized 1-on-1 AI Tutoring • {profile.school} School
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleNewQuestion}
            className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5"
            title="Start fresh with a new question (resets tutor active memory)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Question</span>
          </button>

          <button
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Chat Box */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Welcome Greeting */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-100 rounded-2xl p-4 sm:p-5 text-slate-800 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                  Hi Smruthi! Welcome back! 😊
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  What problem are we solving today? You can type your question or upload a photo of
                  it. I'll help you figure it out step by step!
                </p>
              </div>
            </div>
          </div>

          {/* Active Question Context Banner */}
          {activeQuestion && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    Active Question (Context Locked)
                  </span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                      sessionStatus === "Solved"
                        ? "bg-green-100 text-green-700"
                        : sessionStatus === "Given Up"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {sessionStatus}
                  </span>
                </div>
                <p className="text-slate-900 font-medium mt-0.5 line-clamp-2">
                  {activeQuestion}
                </p>
              </div>
            </div>
          )}

          {/* Messages Feed */}
          {messages.map((m) => {
            const isStudent = m.sender === "student";
            const isGiveUp = m.type === "giveup" && !isStudent;

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isStudent ? "justify-end" : "justify-start"}`}
              >
                {!isStudent && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-5 py-4 shadow-sm ${
                    isStudent
                      ? "bg-blue-600 text-white rounded-br-none"
                      : isGiveUp
                      ? "bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 text-slate-900 rounded-bl-none shadow-md"
                      : "bg-slate-100 border border-slate-200/80 text-slate-900 rounded-bl-none"
                  }`}
                >
                  {/* Student attached photo rendered inside the message */}
                  {isStudent && m.image && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/20 max-w-xs shadow">
                      <img
                        src={m.image}
                        alt="Question Photo"
                        className="w-full object-cover max-h-52"
                      />
                    </div>
                  )}

                  {/* Badge indicator for Tutor messages */}
                  {!isStudent && (
                    <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wider">
                      {isGiveUp ? (
                        <span className="text-amber-800 flex items-center gap-1.5 bg-amber-100/90 px-2.5 py-1 rounded-md border border-amber-300/80">
                          <Flag className="w-3.5 h-3.5 text-amber-600" /> Complete Solution & Concept Breakdown
                        </span>
                      ) : m.type === "hint" ? (
                        <span className="text-amber-700 flex items-center gap-1 bg-amber-100/80 px-2 py-0.5 rounded-md">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600" /> Socratic Progressive Hint
                        </span>
                      ) : (
                        <span className="text-indigo-700 flex items-center gap-1 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Tutor Guidance
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content: Formatted with Markdown & Math Rendering */}
                  {isStudent ? (
                    <p className="text-sm sm:text-[15px] whitespace-pre-wrap leading-relaxed">
                      {m.text}
                    </p>
                  ) : (
                    <div className="text-sm sm:text-[15px] leading-relaxed text-slate-900">
                      <FormattedMessage content={m.text} isGiveUp={isGiveUp} />
                    </div>
                  )}
                </div>

                {isStudent && (
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-1 text-xs font-bold">
                    S
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Thinking Indicator */}
          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl px-4 py-2.5 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                <span>Agent 1 is reviewing the full problem context and preparing your clue...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Action Buttons (Always available when solving) */}
        {activeQuestion && sessionStatus === "In Progress" && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 font-semibold">Quick Options:</span>
            <button
              onClick={() => handleSend("hint", "Can you give me another progressive hint?")}
              disabled={loading}
              className="text-xs font-semibold px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>Give me another hint</span>
            </button>

            <button
              onClick={() =>
                handleSend("giveup", "I give up. Please show me the complete formatted solution.")
              }
              disabled={loading}
              className="text-xs font-semibold px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Flag className="w-4 h-4 text-red-600" />
              <span>I give up (Show solution)</span>
            </button>
          </div>
        )}

        {/* Bottom Input Area */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
          {/* Image preview before sending */}
          {imagePreview && (
            <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Question Attachment"
                  className="w-12 h-12 object-cover rounded-lg border border-slate-300"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-800">Photo Attached</p>
                  <p className="text-slate-500">
                    {ocrText ? "OCR Transcribed ✓" : "Will be displayed in your chat message"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowImageEditor(true)}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium"
                >
                  Rotate / OCR
                </button>
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setOcrText(null);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Camera and Photo Attachment Buttons */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
              title="Attach Question Photo"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={openCamera}
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
              title="Take Camera Photo"
            >
              <Camera className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(activeQuestion && sessionStatus === "In Progress" ? "answer" : "ask");
                }
              }}
              placeholder={
                activeQuestion && sessionStatus === "In Progress"
                  ? "Type your answer or intermediate step..."
                  : "Type your academic question here (e.g. Find x in 2x + 5 = 15)..."
              }
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />

            <button
              onClick={() =>
                handleSend(activeQuestion && sessionStatus === "In Progress" ? "answer" : "ask")
              }
              disabled={loading || (!inputVal.trim() && !imagePreview)}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl shadow-md shadow-blue-500/20 transition shrink-0"
              title="Send"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden max-w-lg w-full flex flex-col">
            <div className="p-4 flex items-center justify-between text-white border-b border-slate-800">
              <h3 className="font-semibold text-sm">Capture Question Photo</h3>
              <button onClick={closeCamera} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex justify-center gap-4 bg-slate-900">
              <button
                onClick={capturePhoto}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg"
              >
                <Camera className="w-5 h-5" />
                <span>Take Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop, Rotate & OCR Modal */}
      {showImageEditor && imagePreview && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Crop, Rotate & Transcribe</h3>
              <button
                onClick={() => setShowImageEditor(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden max-h-72 p-2">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-64 object-contain rounded"
              />
            </div>

            {/* Editing Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex gap-2">
                <button
                  onClick={() => rotateImage("ccw")}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" /> Rotate -90°
                </button>
                <button
                  onClick={() => rotateImage("cw")}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-1.5"
                >
                  <RotateCw className="w-4 h-4" /> Rotate +90°
                </button>
              </div>

              <button
                onClick={runOCR}
                disabled={ocrLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow"
              >
                <Sparkles className="w-4 h-4" />
                {ocrLoading ? "Groq Vision Transcribing..." : "Transcribe Question (OCR)"}
              </button>
            </div>

            <div className="pt-2 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowImageEditor(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs"
              >
                Attach to Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { db } from "@/lib/db";
import { groqJSON } from "@/lib/groq";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const AnalysisSchema = z.object({
  subject: z.string().default("Unclassified"),
  topic: z.string().default("General"),
  question_type: z.enum([
    "Concept-based",
    "Formula-based",
    "Numerical",
    "Tricky/Application-based",
    "Mixed",
  ]).default("Concept-based"),
  difficulty: z.enum(["Easy", "Medium", "Hard", "Advanced"]).default("Medium"),
  conceptual_score: z.number().min(0).max(100).default(75),
  problem_solving_score: z.number().min(0).max(100).default(75),
  formula_application_score: z.number().min(0).max(100).default(70),
  numerical_accuracy_score: z.number().min(0).max(100).default(80),
  mistake_categories: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  analytical_summary: z.string().default("Completed session evaluated."),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // 1. Fetch complete question session data
    const [{ data: sess }, { data: chat }, { data: attempts }, { data: hintsList }, { data: subjects }] =
      await Promise.all([
        db.from("question_sessions").select("*").eq("id", sessionId).maybeSingle(),
        db.from("chat_messages").select("sender,message,message_type,created_at").eq("session_id", sessionId).order("created_at"),
        db.from("student_attempts").select("*").eq("session_id", sessionId).order("created_at"),
        db.from("hints").select("*").eq("session_id", sessionId).order("created_at"),
        db.from("subjects").select("name").eq("is_active", true),
      ]);

    if (!sess) {
      return NextResponse.json({ error: "Question session not found" }, { status: 404 });
    }

    const activeSubjects = (subjects ?? []).map((s: any) => s.name).join(", ") || "Mathematics, Science, English";

    const defaultAgent2Prompt = `You are an academic performance analyst evaluating student Smruthi's performance on a recorded question.
Grade: {{GRADE}}, Board: {{BOARD}}.
Configured Subjects: ${activeSubjects}.
If the subject cannot be identified with confidence from the configured list, use "Unclassified".
Scores must be between 0 and 100 representing observed performance on this recorded question only.
Return ONLY valid JSON matching the schema.`;

    let agent2Prompt = defaultAgent2Prompt
      .replace("{{GRADE}}", sess.grade_snapshot || "10")
      .replace("{{BOARD}}", sess.board_snapshot || "CBSE");

    try {
      const { data: cfg } = await db
        .from("ai_configurations")
        .select("system_prompt")
        .eq("agent_name", "agent2")
        .maybeSingle();
      if (cfg?.system_prompt) {
        agent2Prompt = cfg.system_prompt
          .replace("{{GRADE}}", sess.grade_snapshot || "10")
          .replace("{{BOARD}}", sess.board_snapshot || "CBSE")
          .replace("{{SUBJECTS}}", activeSubjects);
      }
    } catch {
      // Use fallback
    }

    const payloadContext = {
      question: sess.question_text,
      ocr_text: sess.ocr_text,
      correct_answer: sess.correct_answer,
      final_status: sess.status,
      time_spent_seconds: sess.total_time_seconds,
      hints_count: hintsList?.length ?? 0,
      hints_provided: hintsList?.map((h: any) => h.hint_content) ?? [],
      student_attempts: attempts?.map((a: any) => ({
        answer: a.submitted_answer,
        is_correct: a.is_correct,
        detected_mistake: a.detected_mistake,
        feedback: a.feedback,
      })) ?? [],
      conversation_snippet: chat?.slice(-10).map((c: any) => `${c.sender}: ${c.message}`) ?? [],
    };

    const promptUser = `Evaluate this student's recorded interaction:
${JSON.stringify(payloadContext, null, 2)}

Provide structured JSON with:
- subject (from configured list: ${activeSubjects}, or "Unclassified")
- topic (e.g. Linear Equations, Kinematics)
- question_type ("Concept-based" | "Formula-based" | "Numerical" | "Tricky/Application-based" | "Mixed")
- difficulty ("Easy" | "Medium" | "Hard" | "Advanced")
- conceptual_score (0-100)
- problem_solving_score (0-100)
- formula_application_score (0-100)
- numerical_accuracy_score (0-100)
- mistake_categories (array of strings, e.g. ["Sign error", "Misunderstood question"])
- strengths (array of strings)
- weaknesses (array of strings)
- recommendations (array of actionable study recommendations)
- analytical_summary (1-2 sentences summarizing her performance)`;

    const rawAnalysis = await groqJSON("agent2", agent2Prompt, [
      { role: "user", content: promptUser },
    ]);

    const validated = AnalysisSchema.parse(rawAnalysis);

    // Save analytics to Supabase
    try {
      await db.from("question_analytics").upsert(
        {
          session_id: sessionId,
          subject: validated.subject,
          topic: validated.topic,
          question_type: validated.question_type,
          difficulty: validated.difficulty,
          hints_used: hintsList?.length ?? 0,
          incorrect_attempts: attempts?.filter((a: any) => !a.is_correct).length ?? 0,
          time_spent: sess.total_time_seconds ?? 0,
          final_status: sess.status,
          conceptual_score: validated.conceptual_score,
          problem_solving_score: validated.problem_solving_score,
          formula_application_score: validated.formula_application_score,
          numerical_accuracy_score: validated.numerical_accuracy_score,
          mistake_categories: validated.mistake_categories,
          strengths: validated.strengths,
          weaknesses: validated.weaknesses,
          recommendations: validated.recommendations,
          analytical_summary: validated.analytical_summary,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );

      // Also update session topic and subject if unassigned
      await db.from("question_sessions").update({
        subject: validated.subject,
        topic: validated.topic,
        question_type: validated.question_type,
        difficulty: validated.difficulty,
      }).eq("id", sessionId);
    } catch (saveErr) {
      console.warn("Could not save question_analytics to DB:", saveErr);
    }

    return NextResponse.json({ success: true, analysis: validated });
  } catch (err: any) {
    console.error("Agent 2 Analysis Error:", err);
    return NextResponse.json(
      { error: `Agent 2 error: ${err.message}` },
      { status: 500 }
    );
  }
}

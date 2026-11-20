import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { groqJSON } from "@/lib/groq";
import { Store } from "@/lib/store";

const Body = z.object({
  sessionId: z.string().optional(),
  action: z.enum(["ask", "answer", "hint", "giveup", "chat"]),
  text: z.string().max(4000).default(""),
  activeQuestion: z.string().optional(),
  imageUrl: z.string().optional(),
  history: z
    .array(
      z.object({
        sender: z.enum(["student", "tutor"]),
        text: z.string(),
      })
    )
    .optional(),
});

// Robust schema accepting null or undefined for optional AI outputs
const Out = z.object({
  reply: z.string().default(""),
  correct_answer: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  is_correct: z.boolean().nullable().optional(),
  mistake: z.string().nullable().optional(),
});

const GIVE_UP = /\b(i give up|give up|tell me the answer|show me the (answer|solution)|i giveup|cant solve|can't solve|solution please)\b/i;

async function fillAcademicContext(p: string) {
  const profile = Store.getProfile();
  const subjects = Store.getSubjects();
  return {
    prompt: p
      .replace("{{GRADE}}", profile.grade || "10")
      .replace("{{BOARD}}", profile.board || "CBSE")
      .replace("{{SUBJECTS}}", subjects.map((s) => s.name).join(", ") || "Mathematics, Science"),
    profile,
  };
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "student") {
    return Response.json({ error: "Forbidden: Student access only" }, { status: 403 });
  }

  const b = Body.safeParse(await req.json());
  if (!b.success) {
    return Response.json({ error: "Invalid request payload" }, { status: 400 });
  }

  let { sessionId, action, text, activeQuestion, imageUrl, history } = b.data;

  // Detect natural language surrender
  if (action !== "ask" && GIVE_UP.test(text)) {
    action = "giveup";
  }

  try {
    let systemPrompt =
      "You are a warm, encouraging Socratic tutor for Smruthi, Grade {{GRADE}}, {{BOARD}}. Subjects: {{SUBJECTS}}. Never reveal the final answer unless she explicitly gives up. Give one small progressive hint at a time. Guide her to solve the problem independently.";

    try {
      const { data: cfg } = await db
        .from("ai_configurations")
        .select("system_prompt")
        .eq("agent_name", "agent1")
        .maybeSingle();
      if (cfg?.system_prompt) systemPrompt = cfg.system_prompt;
    } catch {
      // Use fallback
    }

    const { prompt } = await fillAcademicContext(systemPrompt);

    // Retrieve session record
    let sess = sessionId ? Store.getSession(sessionId) : undefined;

    // CRITICAL: If the previous session is already Solved or Given Up, DO NOT OVERWRITE IT!
    // Start a fresh new session for this new inquiry!
    if (sess && (sess.status === "Solved" || sess.status === "Given Up")) {
      sess = undefined;
      sessionId = undefined;
      action = "ask";
    }

    // Resolve question text
    let resolvedQuestion = activeQuestion || sess?.question_text || text;
    if (!resolvedQuestion && action === "ask") resolvedQuestion = text;

    if (!sess || action === "ask") {
      const newSid = sessionId || crypto.randomUUID();
      sess = {
        id: newSid,
        student_id: s.uid,
        question_text: resolvedQuestion,
        image_url: imageUrl,
        subject: "Science",
        topic: "Physics",
        status: "In Progress",
        started_at: new Date().toISOString(),
        total_time_seconds: 0,
        hints_count: 0,
        incorrect_attempts: 0,
      };
      sessionId = newSid;
      action = "ask";
    }

    const sid = sess.id;
    const now = Date.now();
    const elapsedSeconds = Math.round((now - new Date(sess.started_at).getTime()) / 1000);

    // Build complete conversational context so Agent 1 NEVER loses context
    let msgs: Array<{ role: string; content: string }> = [];

    if (history && history.length > 0) {
      msgs = history.map((h) => ({
        role: h.sender === "student" ? "user" : "assistant",
        content: h.text,
      }));
    } else {
      const storedChat = Store.getChatMessages(sid);
      msgs = storedChat.map((m) => ({
        role: m.sender === "student" ? "user" : "assistant",
        content: m.message,
      }));
    }

    // Always strongly reinforce the active problem context in the instruction
    const problemHeader = `
=== CURRENT PROBLEM CONTEXT ===
QUESTION BEING SOLVED: "${sess.question_text}"
${sess.correct_answer ? `SECRET CORRECT ANSWER WORKED OUT PRIVATELY: "${sess.correct_answer}"` : ""}
SUBJECT/TOPIC: ${sess.subject} - ${sess.topic || "General"}
==============================`;

    const instructions: Record<string, string> = {
      ask: `${problemHeader}
The student just asked this new problem.
Work out the final correct answer privately for yourself.
Do NOT reveal the answer to the student!
Return JSON with:
{
  "reply": "Warm opening greeting and exactly ONE small, progressive first clue to get her started.",
  "correct_answer": "The exact correct final answer worked out privately.",
  "subject": "The academic subject (e.g. Mathematics, Science, English, etc.)",
  "topic": "The specific chapter/topic (e.g. Gravitational Potential Energy, Linear Equations)"
}`,

      hint: `${problemHeader}
The student is asking for another progressive hint.
Review the previous clues already given in the conversation above.
Provide the NEXT, slightly more specific hint that helps her take the immediate next step without revealing the final answer.
Return JSON with:
{
  "reply": "Next progressive hint guiding her toward the solution."
}`,

      answer: `${problemHeader}
The student submitted: "${text}".
Evaluate this submission in the context of the active question.
If she answered an intermediate question or conversationally replied, acknowledge it warmly and give the next step.
If she submitted a final answer attempt, compare it to the secret correct answer "${sess.correct_answer || ""}".
Return JSON with:
{
  "reply": "Supportive feedback. If correct, enthusiastically congratulate her and explain why it is correct. If incorrect, explain the mistake (conceptual, computational, formula, misread) and give another clue without giving away the final answer.",
  "is_correct": true_or_false_if_this_was_a_final_answer_attempt_or_null,
  "mistake": "Type of mistake if incorrect, e.g. 'Conceptual - inverted sign' or null if correct or intermediate reply"
}`,

      chat: `${problemHeader}
The student said: "${text}".
Encourage her, stay in character as her patient Socratic tutor, and guide her with another small clue. Never reveal the final answer.
Return JSON with:
{
  "reply": "Warm, encouraging tutor response that relates directly back to solving: ${sess.question_text}."
}`,

      giveup: `${problemHeader}
The student explicitly gave up.
Reveal the complete, beautifully formatted solution so she can learn from it.
The reply MUST include:
1. ### 🎯 Final Correct Answer
2. ### 📝 Step-by-Step Solution (clear algebraic/numerical progression)
3. ### 💡 Underlying Concept
4. ### 📐 Key Formulas Used
5. ### ⚠️ Common Mistakes to Avoid
Return JSON with:
{
  "reply": "The complete, detailed step-by-step solution formatted with Markdown headers and bullet points."
}`,
    };

    const groqResponse = await groqJSON("agent1", prompt, [
      ...msgs,
      { role: "user", content: instructions[action] || instructions.chat },
    ]);

    const out = Out.parse(groqResponse);

    // Save turn to chat history
    Store.addChatMessage({
      session_id: sid,
      sender: "student",
      message: text || `[${action}]`,
      image_url: imageUrl,
      message_type: action,
      created_at: new Date().toISOString(),
    });

    Store.addChatMessage({
      session_id: sid,
      sender: "tutor",
      message: out.reply,
      message_type: action,
      created_at: new Date().toISOString(),
    });

    // Update Session State
    if (action === "ask") {
      sess.correct_answer = out.correct_answer || sess.correct_answer;
      sess.subject = out.subject || sess.subject;
      sess.topic = out.topic || sess.topic;
      sess.hints_count = 1;
    } else if (action === "hint") {
      sess.hints_count += 1;
    } else if (action === "answer") {
      if (out.is_correct === true) {
        sess.status = "Solved";
        sess.completed_at = new Date().toISOString();
      } else if (out.is_correct === false) {
        sess.incorrect_attempts += 1;
      }
    } else if (action === "giveup") {
      sess.status = "Given Up";
      sess.completed_at = new Date().toISOString();
    }

    sess.total_time_seconds = elapsedSeconds;
    Store.saveSession(sess);

    // REAL-TIME AGENT 2 ANALYTICS UPDATE:
    const baseScore =
      sess.status === "Solved"
        ? Math.max(70, 100 - sess.hints_count * 5 - sess.incorrect_attempts * 10)
        : sess.status === "Given Up"
        ? Math.max(40, 60 - sess.hints_count * 5)
        : Math.max(50, 85 - sess.hints_count * 5 - sess.incorrect_attempts * 5);

    const analyticsUpdate = {
      session_id: sid,
      subject: sess.subject || "Science",
      topic: sess.topic || "Core Academic Concepts",
      question_type: "Concept-based",
      difficulty: "Medium",
      hints_used: sess.hints_count,
      incorrect_attempts: sess.incorrect_attempts,
      time_spent: sess.total_time_seconds,
      final_status: sess.status,
      conceptual_score: baseScore,
      problem_solving_score: Math.max(50, baseScore - 5),
      formula_application_score: baseScore,
      numerical_accuracy_score: Math.max(60, 100 - sess.incorrect_attempts * 15),
      mistake_categories: out.mistake ? [out.mistake] : ["Formula application"],
      strengths: ["Engages with progressive hints", "Understands problem setup"],
      weaknesses:
        sess.incorrect_attempts > 0 ? ["Needs attention to intermediate calculation"] : ["None noted"],
      recommendations: [
        `Practice additional questions in ${sess.subject} (${sess.topic || "General"}).`,
      ],
      analytical_summary: `Smruthi is actively working on ${sess.subject} - ${sess.topic}. Status: ${sess.status}. Hints taken: ${sess.hints_count}.`,
      analyzed_at: new Date().toISOString(),
    };

    Store.saveAnalytics(analyticsUpdate);

    return Response.json({
      sessionId: sid,
      reply: out.reply,
      status: sess.status,
      subject: sess.subject,
      topic: sess.topic,
      is_correct: out.is_correct,
      mistake: out.mistake,
    });
  } catch (e: any) {
    console.error("Tutor route error:", e);
    return Response.json(
      {
        error: String(e.message).startsWith("CONFIG_REQUIRED")
          ? "The tutor isn't set up yet. Please ensure your Groq key is configured in Edit Keys."
          : `The tutor couldn't respond: ${e.message}`,
      },
      { status: 502 }
    );
  }
}

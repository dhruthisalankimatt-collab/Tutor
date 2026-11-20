import { db } from "@/lib/db";
import { groqJSON } from "@/lib/groq";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const Agent3Schema = z.object({
  agent1_prompt: z.string(),
  agent2_prompt: z.string(),
  change_summary: z.string(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { previousProfile, newProfile, subjects } = await req.json();

    // 1. Fetch current Agent 1 and Agent 2 prompts
    const { data: configs } = await db.from("ai_configurations").select("*");
    const a1Row = configs?.find((c: any) => c.agent_name === "agent1");
    const a2Row = configs?.find((c: any) => c.agent_name === "agent2");

    const activeSubjectsStr = (subjects ?? []).map((s: any) => s.name).join(", ");

    const agent3SystemPrompt =
      "You are Agent 3, the AI Prompt Configuration Manager. Your job is to update ONLY the academic context (grade-level expectations, education board, school, and active subjects) inside Agent 1 and Agent 2 system prompts. Do NOT rewrite unrelated custom instructions or core Socratic behavioral rules. Return valid JSON only.";

    const userInstructions = `
Academic Configuration Changed:
Previous: Grade ${previousProfile?.grade || "N/A"}, Board ${previousProfile?.board || "N/A"}, School ${previousProfile?.school || "N/A"}.
New: Grade ${newProfile.grade}, Board ${newProfile.board}, School ${newProfile.school}.
Active Subjects: ${activeSubjectsStr}.

Existing Agent 1 System Prompt:
"""${a1Row?.system_prompt || "You are a Socratic tutor for Smruthi. Give one small progressive hint at a time."}"""

Existing Agent 2 System Prompt:
"""${a2Row?.system_prompt || "You analyse a student's recorded performance on one question. Return JSON only."}"""

Provide JSON output with:
- "agent1_prompt": updated system prompt for Agent 1 reflecting new grade & subjects while preserving Socratic rules.
- "agent2_prompt": updated system prompt for Agent 2 reflecting new grade standards.
- "change_summary": 1 sentence explaining the update.`;

    const rawResponse = await groqJSON("agent3", agent3SystemPrompt, [
      { role: "user", content: userInstructions },
    ]);

    const parsed = Agent3Schema.parse(rawResponse);

    // Save transactional updates
    await Promise.all([
      db.from("ai_configurations").update({ system_prompt: parsed.agent1_prompt }).eq("agent_name", "agent1"),
      db.from("ai_configurations").update({ system_prompt: parsed.agent2_prompt }).eq("agent_name", "agent2"),
      db.from("prompt_versions").insert([
        {
          agent_name: "agent1",
          prompt_content: parsed.agent1_prompt,
          academic_configuration_snapshot: newProfile,
          created_by: session.username,
        },
        {
          agent_name: "agent2",
          prompt_content: parsed.agent2_prompt,
          academic_configuration_snapshot: newProfile,
          created_by: session.username,
        },
      ]),
      db.from("configuration_history").insert({
        previous_configuration: previousProfile,
        new_configuration: newProfile,
        changed_by: session.username,
      }),
    ]);

    return NextResponse.json({ success: true, ...parsed });
  } catch (err: any) {
    console.error("Agent 3 Error:", err);
    return NextResponse.json({ error: `Agent 3 error: ${err.message}` }, { status: 500 });
  }
}

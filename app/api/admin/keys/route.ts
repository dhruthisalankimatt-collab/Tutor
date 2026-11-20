import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data: rows } = await db.from("ai_configurations").select("*");
    const configs: Record<string, any> = {};

    const agentList = ["agent1", "agent2", "agent3", "vision"];
    for (const name of agentList) {
      const match = (rows || []).find((r: any) => r.agent_name === name);
      let maskedKey = "";
      if (match?.encrypted_api_key) {
        const decrypted = decrypt(match.encrypted_api_key);
        if (decrypted && decrypted.startsWith("gsk_")) {
          maskedKey = decrypted.slice(0, 7) + "..." + decrypted.slice(-4);
        }
      } else {
        // Check env var
        const envKey =
          process.env[`GROQ_API_KEY_${name.toUpperCase()}`] || process.env.GROQ_API_KEY;
        if (envKey && envKey.startsWith("gsk_")) {
          maskedKey = envKey.slice(0, 7) + "..." + envKey.slice(-4);
        }
      }

      configs[name] = {
        model_name: match?.model_name || "qwen/qwen3.8-27b",
        system_prompt: match?.system_prompt || "",
        temperature: match?.temperature ?? 0.4,
        max_tokens: match?.max_tokens ?? 1024,
        has_key: Boolean(maskedKey),
        masked_key: maskedKey,
      };
    }

    return NextResponse.json({ configs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { configs } = await req.json();
    if (!configs) {
      return NextResponse.json({ error: "Configurations required" }, { status: 400 });
    }

    for (const agentName of ["agent1", "agent2", "agent3", "vision"]) {
      const item = configs[agentName];
      if (!item) continue;

      const updatePayload: any = {
        agent_name: agentName,
        model_name: item.model_name,
        system_prompt: item.system_prompt,
        temperature: parseFloat(item.temperature) || 0.4,
        max_tokens: parseInt(item.max_tokens) || 1024,
        updated_at: new Date().toISOString(),
      };

      // If user typed a new full Groq API key, encrypt and save
      if (item.api_key && item.api_key.trim().startsWith("gsk_")) {
        updatePayload.encrypted_api_key = encrypt(item.api_key.trim());
      }

      await db.from("ai_configurations").upsert(updatePayload, { onConflict: "agent_name" });
    }

    return NextResponse.json({ success: true, message: "Configurations saved successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

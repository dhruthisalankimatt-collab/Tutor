import Groq from "groq-sdk";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { apiKey, modelName } = await req.json();

    if (!apiKey || !apiKey.startsWith("gsk_")) {
      return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
    }

    const groq = new Groq({ apiKey });
    const modelsList = await groq.models.list();
    const available = modelsList.data.map((m) => m.id);

    const isAvailable = available.includes(modelName);

    return NextResponse.json({
      success: true,
      modelFound: isAvailable,
      availableModels: available,
      message: isAvailable
        ? `Connectivity verified! Model '${modelName}' is active.`
        : `Key is valid, but model '${modelName}' not found. Available models: ${available.join(", ")}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to connect to Groq" },
      { status: 400 }
    );
  }
}

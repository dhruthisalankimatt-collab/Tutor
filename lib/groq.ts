import Groq from "groq-sdk";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

// Cache available model IDs per API key
const modelCache = new Map<string, string[]>();

export async function getGroqConfig(agentName: string): Promise<{
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}> {
  let apiKey = "";
  let modelName = "";
  let systemPrompt = "";
  let temperature = 0.4;
  let maxTokens = 1024;

  // 1. Try fetching from database
  try {
    const { data } = await db
      .from("ai_configurations")
      .select("*")
      .eq("agent_name", agentName)
      .maybeSingle();

    if (data) {
      if (data.encrypted_api_key) {
        const decrypted = decrypt(data.encrypted_api_key);
        if (decrypted && decrypted.trim().startsWith("gsk_")) {
          apiKey = decrypted.trim();
        }
      }
      if (data.model_name) modelName = data.model_name;
      if (data.system_prompt) systemPrompt = data.system_prompt;
      if (data.temperature !== null && data.temperature !== undefined) temperature = data.temperature;
      if (data.max_tokens) maxTokens = data.max_tokens;
    }
  } catch (e) {
    console.warn(`[getGroqConfig] DB fetch failed for ${agentName}:`, e);
  }

  // 2. Fallback to environment variables for API key
  if (!apiKey) {
    const envMap: Record<string, string | undefined> = {
      agent1: process.env.GROQ_API_KEY_AGENT1,
      agent2: process.env.GROQ_API_KEY_AGENT2,
      agent3: process.env.GROQ_API_KEY_AGENT3,
      vision: process.env.GROQ_API_KEY_VISION,
    };
    apiKey = envMap[agentName] || process.env.GROQ_API_KEY || "";
  }

  if (!apiKey || !apiKey.startsWith("gsk_")) {
    throw new Error(
      `CONFIG_REQUIRED: No valid Groq API key found for ${agentName}. Please configure it in Edit Keys or .env.local.`
    );
  }

  // Default models: default to qwen/qwen3.8-27b which is verified accessible and vision-capable
  if (!modelName || modelName.includes("llama-4-scout")) {
    modelName = "qwen/qwen3.8-27b";
  }

  return { apiKey, modelName, systemPrompt, temperature, maxTokens };
}

/**
 * Ensures the chosen model is available on this Groq account.
 * If model is unavailable (e.g. 404 model_not_found), falls back to a verified working model.
 */
async function getWorkingModel(groq: Groq, requestedModel: string): Promise<string> {
  const cacheKey = groq.apiKey;
  let availableModels = modelCache.get(cacheKey);

  if (!availableModels) {
    try {
      const list = await groq.models.list();
      availableModels = list.data.map((m) => m.id);
      modelCache.set(cacheKey, availableModels);
    } catch {
      availableModels = [];
    }
  }

  if (availableModels.length > 0) {
    // If requested model is in available models, use it!
    if (availableModels.includes(requestedModel)) {
      return requestedModel;
    }

    // Try common top picks among available models
    const preferredFallbacks = [
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ];

    for (const fb of preferredFallbacks) {
      if (availableModels.includes(fb)) {
        console.warn(`[Groq] Model '${requestedModel}' not accessible. Falling back to '${fb}'.`);
        return fb;
      }
    }

    // Use first available chat model
    const chatModel = availableModels.find((m) => !m.includes("whisper") && !m.includes("guard"));
    if (chatModel) return chatModel;
  }

  return requestedModel;
}

export async function groqJSON(
  agentName: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<any> {
  const cfg = await getGroqConfig(agentName);
  const groq = new Groq({ apiKey: cfg.apiKey });
  const model = await getWorkingModel(groq, cfg.modelName);

  try {
    const completion = await groq.chat.completions.create({
      model,
      temperature: cfg.temperature ?? 0.4,
      max_tokens: cfg.maxTokens ?? 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nIMPORTANT: You must output ONLY a valid JSON object matching the requested schema. No conversational preamble or postscript outside JSON.`,
        },
        ...(messages as any[]),
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(raw);
  } catch (err: any) {
    // If JSON parsing or model request failed, retry with fallback if not already done
    if (err.status === 404 && model !== "qwen/qwen3.8-27b") {
      const fallbackCompletion = await groq.chat.completions.create({
        model: "qwen/qwen3.8-27b",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only.` },
          ...(messages as any[]),
        ],
      });
      return JSON.parse(fallbackCompletion.choices[0]?.message?.content || "{}");
    }
    throw err;
  }
}

export async function groqChat(
  agentName: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const cfg = await getGroqConfig(agentName);
  const groq = new Groq({ apiKey: cfg.apiKey });
  const model = await getWorkingModel(groq, cfg.modelName);

  const completion = await groq.chat.completions.create({
    model,
    temperature: cfg.temperature ?? 0.4,
    max_tokens: cfg.maxTokens ?? 1024,
    messages: [
      { role: "system", content: systemPrompt },
      ...(messages as any[]),
    ],
  });

  return completion.choices[0]?.message?.content || "";
}

/**
 * OCR / Vision call
 * Extracts readable question text, mathematical equations, and diagram descriptions.
 */
export async function groqVisionOCR(imageBase64: string, customPrompt?: string): Promise<{
  text: string;
  hasDiagram: boolean;
  diagramDescription?: string;
}> {
  const cfg = await getGroqConfig("vision");
  const groq = new Groq({ apiKey: cfg.apiKey });

  const defaultPrompt =
    "Transcribe this academic question image completely and accurately. Preserve mathematical notation (e.g. fractions, exponents, square roots, formulas), units, and symbols. If there is a diagram, graph, or geometrical figure essential to solving the problem, describe it in detail.";

  const prompt = customPrompt || cfg.systemPrompt || defaultPrompt;

  // Ensure base64 prefix
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  // Candidate multimodal vision models on Groq
  const candidateModels = [
    "qwen/qwen3.8-27b",
    cfg.modelName,
    "meta-models/muse-spark-open",
    "llama-3.2-11b-vision-preview",
  ].filter(Boolean);

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      });

      const extracted = response.choices[0]?.message?.content || "";
      const hasDiagram = /diagram|figure|graph|triangle|circle|shown below|in the image/i.test(extracted);
      return {
        text: extracted,
        hasDiagram,
        diagramDescription: hasDiagram ? extracted : undefined,
      };
    } catch (err: any) {
      lastError = err;
      // If 404 or unsupported model, try next candidate
      continue;
    }
  }

  // If vision API is not supported on the key, return clear guidance for manual review
  throw new Error(
    `Groq Vision model error: ${lastError?.message || "Model not accessible"}. Please check your Vision API Key or Model name in Edit Keys.`
  );
}

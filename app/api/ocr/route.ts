import { groqVisionOCR } from "@/lib/groq";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageBase64, customPrompt } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    const ocrResult = await groqVisionOCR(imageBase64, customPrompt);
    return NextResponse.json(ocrResult);
  } catch (err: any) {
    console.error("OCR Route Error:", err);
    return NextResponse.json(
      {
        error: err.message || "Failed to process image with Groq Vision",
        fallback: true,
      },
      { status: 500 }
    );
  }
}

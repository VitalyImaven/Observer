import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { getSettings } from "@/lib/store";
import { toFile } from "openai";

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio") as File;

  if (!audio) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }

  if (audio.size < 1000) {
    return NextResponse.json({ error: "Audio too short" }, { status: 400 });
  }

  const client = getOpenAIClient();
  const settings = getSettings();
  const model = settings.transcriptionModel || "gpt-4o-transcribe";

  try {
    // Convert to a proper file object the OpenAI SDK can handle
    const buffer = Buffer.from(await audio.arrayBuffer());
    const ext = audio.name?.split(".").pop() || "webm";
    const file = await toFile(buffer, `audio.${ext}`, {
      type: audio.type || "audio/webm",
    });

    // Build params based on model
    const isWhisper = model === "whisper-1";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      file,
      model,
    };

    if (isWhisper) {
      params.language = settings.language || "en";
      params.response_format = "verbose_json";
    }

    const transcription = await client.audio.transcriptions.create(params);

    const text =
      typeof transcription === "string"
        ? transcription
        : transcription.text || "";

    // Skip empty or meaningless transcriptions
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) {
      return NextResponse.json({ text: "" });
    }

    // Filter out common hallucination patterns from silence/noise
    const noisePatterns = [
      /^\.{1,5}$/,                        // Just dots "..."
      /^(thanks?|thank you|okay|oh|ah|um|uh|hmm|wow|yes|no|yeah|yep|nope|right|sure|hello|hi|hey|bye|goodbye|see you|cheers)\.?$/i,
      /^sorry[,.]?\s*(no)?\.?$/i,
      /^you\.?$/i,
      /^[\u4e00-\u9fff]{1,5}[。？]?$/,   // Chinese characters (noise hallucination)
      /^[\u0400-\u04ff\s]{1,20}\.?$/,    // Short Cyrillic (noise hallucination)
      /^[\u3040-\u30ff]{1,5}[。？]?$/,   // Japanese (noise hallucination)
      /^[\uac00-\ud7af]{1,5}[.?]?$/,     // Korean (noise hallucination)
      /^.{1,10}$/,                        // Anything 10 chars or less is likely noise
      /^(the|a|an|is|it|this|that|and|or|but|so|for|not|i|we|he|she|they)\b.{0,10}$/i, // Very short filler sentences
      /^[A-Z][a-z]{2,15}\.?$/,           // Single capitalized word "Aberdeen." "Legendary."
    ];

    const isNoise = noisePatterns.some((p) => p.test(trimmed));
    if (isNoise) {
      return NextResponse.json({ text: "" });
    }

    // Also filter if the transcription has fewer than 3 words
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3) {
      return NextResponse.json({ text: "" });
    }

    return NextResponse.json({ text: trimmed });
  } catch (error) {
    console.error("Transcription error:", error);
    const msg =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Transcription failed: ${msg}` },
      { status: 500 }
    );
  }
}

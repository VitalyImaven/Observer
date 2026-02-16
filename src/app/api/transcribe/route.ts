import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { getSettings } from "@/lib/store";
import { toFile } from "openai";

// Common English words — real speech almost always contains at least one
const COMMON_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see",
  "other", "than", "then", "now", "look", "only", "come", "its", "over",
  "think", "also", "back", "after", "use", "two", "how", "our", "work",
  "first", "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been", "has",
  "had", "did", "does", "doing", "very", "much", "more", "many", "said",
  "each", "tell", "set", "three", "yes", "okay", "ok",
  "thank", "thanks", "please", "really", "right", "why", "where", "here",
  "should", "must", "need", "let", "thing", "help", "still",
  "question", "answer", "ask", "meet", "money", "market", "company",
  "business", "product", "team", "customer", "revenue", "growth", "invest",
  "investment", "investor", "fund", "funding", "raise", "round", "startup",
  "data", "platform", "technology", "plan", "model", "cost", "price",
  "million", "billion", "percent", "user", "users", "client", "clients",
  "service", "system", "process", "number", "point", "value", "part",
  "case", "week", "month", "world", "going", "long", "great", "little",
  "own", "old", "big", "high", "different", "small", "large", "next",
  "early", "young", "important", "few", "public", "bad", "same", "able",
  "last", "every", "never", "best", "better", "sure", "those",
  "however", "already", "before", "always", "actually", "start", "show",
  "talk", "turn", "might", "against", "area", "keep", "put", "end",
  "while", "play", "home", "read", "hand", "again", "away", "run",
  "being", "once", "enough", "both", "across", "own", "during", "today",
  "got", "made", "find", "may", "kind", "head", "quite", "too", "left",
  "open", "seem", "together", "group", "side", "water", "been", "call",
  "shall", "per", "problem", "become", "between", "done", "real", "something",
  "anything", "nothing", "everything", "someone", "everyone", "through",
  "change", "line", "city", "name", "under", "such", "state", "school",
]);

// Well-known Whisper hallucination phrases
const HALLUCINATION_PHRASES = [
  /thanks?\s+for\s+watch/i,
  /subscribe\s+to/i,
  /like\s+and\s+subscribe/i,
  /please\s+subscribe/i,
  /subtitles?\s+by/i,
  /translated\s+by/i,
  /captioned\s+by/i,
  /amara\.org/i,
  /subs?\s+by/i,
  /^you$/i,
  /^\.\.\.\s*\.\.\.$/,
  /^♪/,
  /^🎵/,
  /^music$/i,
  /^silence$/i,
  /^applause$/i,
  /^laughter$/i,
];

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
    const buffer = Buffer.from(await audio.arrayBuffer());
    const ext = audio.name?.split(".").pop() || "webm";
    const file = await toFile(buffer, `audio.${ext}`, {
      type: audio.type || "audio/webm",
    });

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

    console.log(`[TRANSCRIBE] Raw result (${audio.size} bytes): "${text}"`);

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) {
      console.log("[TRANSCRIBE] Filtered: too short");
      return NextResponse.json({ text: "" });
    }

    // ── Filter 1: Known hallucination phrases ──
    if (HALLUCINATION_PHRASES.some((p) => p.test(trimmed))) {
      console.log(`[TRANSCRIBE] Filtered (known hallucination): "${trimmed}"`);
      return NextResponse.json({ text: "" });
    }

    // ── Filter 2: Basic noise patterns ──
    const noisePatterns = [
      /^\.{1,5}$/,
      /^(thanks?|thank you|okay|oh|ah|um|uh|hmm|wow|yes|no|yeah|yep|nope|right|sure|hello|hi|hey|bye|goodbye|see you|cheers)\.?$/i,
      /^sorry[,.]?\s*(no)?\.?$/i,
      /^you\.?$/i,
      /^[\u4e00-\u9fff]{1,5}[。？]?$/,
      /^[\u0400-\u04ff\s]{1,20}\.?$/,
      /^[\u3040-\u30ff]{1,5}[。？]?$/,
      /^[\uac00-\ud7af]{1,5}[.?]?$/,
      /^.{1,10}$/,
      /^(the|a|an|is|it|this|that|and|or|but|so|for|not|i|we|he|she|they)\b.{0,10}$/i,
      /^[A-Z][a-z]{2,15}\.?$/,
    ];

    if (noisePatterns.some((p) => p.test(trimmed))) {
      console.log(`[TRANSCRIBE] Filtered (noise pattern): "${trimmed}"`);
      return NextResponse.json({ text: "" });
    }

    // ── Filter 3: Too few words ──
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3) {
      console.log(`[TRANSCRIBE] Filtered: only ${wordCount} words: "${trimmed}"`);
      return NextResponse.json({ text: "" });
    }

    // ── Filter 4: Latin-script gibberish detection ──
    // If text is entirely Latin script, check if it contains at least one
    // common English word. Real English speech always does.
    // Whisper hallucinations produce phonetic nonsense like "Dha anaaf shubbooteen pooree"
    const isAllLatin = /^[a-zA-Z\s.,!?'"()\-:;]+$/.test(trimmed);
    if (isAllLatin) {
      const words = trimmed
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 0);

      const recognizedCount = words.filter((w) => COMMON_WORDS.has(w)).length;
      const ratio = words.length > 0 ? recognizedCount / words.length : 0;

      // If zero common words found, or less than 20% recognized — it's gibberish
      if (recognizedCount === 0 || (words.length >= 4 && ratio < 0.2)) {
        console.log(
          `[TRANSCRIBE] Filtered (Latin gibberish, ${recognizedCount}/${words.length} common): "${trimmed}"`
        );
        return NextResponse.json({ text: "" });
      }
    }

    // ── Filter 5: Repetitive text (another hallucination pattern) ──
    // e.g., "na na na na na" or "la la la la"
    const uniqueWords = new Set(
      trimmed.toLowerCase().replace(/[^a-z\u0590-\u05ff\u0600-\u06ff\s]/g, "").split(/\s+/)
    );
    if (wordCount >= 3 && uniqueWords.size === 1) {
      console.log(`[TRANSCRIBE] Filtered (repetitive): "${trimmed}"`);
      return NextResponse.json({ text: "" });
    }

    console.log(`[TRANSCRIBE] ACCEPTED (${wordCount} words): "${trimmed}"`);
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

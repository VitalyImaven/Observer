import OpenAI from "openai";
import { getSettings } from "./store";

export function getOpenAIClient(): OpenAI {
  const settings = getSettings();
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY || "";
  return new OpenAI({ apiKey });
}

export function getChatModel(): string {
  const settings = getSettings();
  return settings.chatModel || process.env.OPENAI_CHAT_MODEL || "gpt-5.2";
}

export function getEmbeddingModel(): string {
  const settings = getSettings();
  return (
    settings.embeddingModel ||
    process.env.OPENAI_EMBEDDING_MODEL ||
    "text-embedding-3-large"
  );
}

export function getTranscriptionModel(): string {
  const settings = getSettings();
  return (
    settings.transcriptionModel ||
    process.env.OPENAI_TRANSCRIPTION_MODEL ||
    "gpt-4o-transcribe"
  );
}

export interface KnowledgeBase {
  id: string;
  name: string;
  createdAt: string;
}

export interface Directive {
  id: string;
  name: string;
  content: string;
  knowledgeBaseId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  embedding?: number[];
  knowledgeBaseId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  type: string;
  chunksCount: number;
  processedAt: string;
  createdAt: string;
  knowledgeBaseId?: string | null;
}

export interface KnowledgeChunk {
  id: string;
  fileId: string;
  content: string;
  embedding?: number[];
  index: number;
  knowledgeBaseId?: string | null;
}

export interface AppSettings {
  openaiApiKey: string;
  chatModel: string;
  embeddingModel: string;
  transcriptionModel: string;
  activeDirectiveId: string | null;
  mode: "live" | "qa-match";
  audioInputDeviceId: string | null;
  language: string;
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  isQuestion: boolean;
}

export interface MatchedQA {
  pair: QAPair;
  similarity: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: "",
  chatModel: "gpt-5.2",
  embeddingModel: "text-embedding-3-large",
  transcriptionModel: "gpt-4o-transcribe",
  activeDirectiveId: null,
  mode: "live",
  audioInputDeviceId: null,
  language: "en",
};

import fs from "fs";
import path from "path";
import type {
  Directive,
  QAPair,
  KnowledgeFile,
  KnowledgeChunk,
  KnowledgeBase,
  AppSettings,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DIRECTIVES_FILE = path.join(DATA_DIR, "directives.json");
const QA_FILE = path.join(DATA_DIR, "qa-pairs.json");
const KNOWLEDGE_FILES_FILE = path.join(DATA_DIR, "knowledge-files.json");
const KNOWLEDGE_CHUNKS_FILE = path.join(DATA_DIR, "knowledge-chunks.json");
const KNOWLEDGE_BASES_FILE = path.join(DATA_DIR, "knowledge-bases.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const UPLOADS_DIR = path.join(DATA_DIR, "knowledge", "uploads");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR))
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readJson<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return defaultValue;
  }
}

function writeJson<T>(filePath: string, data: T) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Knowledge Bases
export function getKnowledgeBases(): KnowledgeBase[] {
  return readJson(KNOWLEDGE_BASES_FILE, []);
}

export function saveKnowledgeBases(bases: KnowledgeBase[]) {
  writeJson(KNOWLEDGE_BASES_FILE, bases);
}

// Directives
export function getDirectives(): Directive[] {
  return readJson(DIRECTIVES_FILE, []);
}

export function saveDirectives(directives: Directive[]) {
  writeJson(DIRECTIVES_FILE, directives);
}

// Q&A Pairs
export function getQAPairs(): QAPair[] {
  return readJson(QA_FILE, []);
}

export function saveQAPairs(pairs: QAPair[]) {
  writeJson(QA_FILE, pairs);
}

// Knowledge Files
export function getKnowledgeFiles(): KnowledgeFile[] {
  return readJson(KNOWLEDGE_FILES_FILE, []);
}

export function saveKnowledgeFiles(files: KnowledgeFile[]) {
  writeJson(KNOWLEDGE_FILES_FILE, files);
}

export function getKnowledgeChunks(): KnowledgeChunk[] {
  return readJson(KNOWLEDGE_CHUNKS_FILE, []);
}

export function saveKnowledgeChunks(chunks: KnowledgeChunk[]) {
  writeJson(KNOWLEDGE_CHUNKS_FILE, chunks);
}

export function getUploadsDir(): string {
  ensureDataDir();
  return UPLOADS_DIR;
}

// Settings
export function getSettings(): AppSettings {
  const saved = readJson<Partial<AppSettings>>(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(settings: AppSettings) {
  writeJson(SETTINGS_FILE, settings);
}

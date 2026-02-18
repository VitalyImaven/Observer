import { NextResponse } from "next/server";
import {
  getKnowledgeFiles,
  saveKnowledgeFiles,
  getKnowledgeChunks,
  saveKnowledgeChunks,
  getUploadsDir,
} from "@/lib/store";
import { createEmbeddings } from "@/lib/embeddings";
import type { KnowledgeFile, KnowledgeChunk } from "@/types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().length > 50);
}

async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".txt" || ext === ".md") {
    return buffer.toString("utf-8");
  }

  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kbId = searchParams.get("knowledgeBaseId");

  let files = getKnowledgeFiles();
  if (kbId) {
    files = files.filter((f) => f.knowledgeBaseId === kbId);
  }
  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const knowledgeBaseId = formData.get("knowledgeBaseId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = uuidv4();
  const ext = path.extname(file.name);
  const savedName = `${fileId}${ext}`;
  const uploadsDir = getUploadsDir();

  fs.writeFileSync(path.join(uploadsDir, savedName), buffer);

  let text: string;
  try {
    text = await extractText(buffer, file.name);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to extract text: ${error}` },
      { status: 500 }
    );
  }

  const textChunks = chunkText(text);

  let embeddings: number[][] = [];
  try {
    embeddings = await createEmbeddings(textChunks);
  } catch {
    // Embeddings will be empty if API key not configured
  }

  const chunks: KnowledgeChunk[] = textChunks.map((content, index) => ({
    id: uuidv4(),
    fileId,
    content,
    embedding: embeddings[index] || undefined,
    index,
    knowledgeBaseId: knowledgeBaseId || undefined,
  }));

  const existingChunks = getKnowledgeChunks();
  saveKnowledgeChunks([...existingChunks, ...chunks]);

  const knowledgeFile: KnowledgeFile = {
    id: fileId,
    name: savedName,
    originalName: file.name,
    size: file.size,
    type: ext.replace(".", ""),
    chunksCount: chunks.length,
    processedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    knowledgeBaseId: knowledgeBaseId || undefined,
  };

  const files = getKnowledgeFiles();
  files.push(knowledgeFile);
  saveKnowledgeFiles(files);

  return NextResponse.json(knowledgeFile);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  let files = getKnowledgeFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, file.name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  files = files.filter((f) => f.id !== id);
  saveKnowledgeFiles(files);

  let chunks = getKnowledgeChunks();
  chunks = chunks.filter((c) => c.fileId !== id);
  saveKnowledgeChunks(chunks);

  return NextResponse.json({ success: true });
}

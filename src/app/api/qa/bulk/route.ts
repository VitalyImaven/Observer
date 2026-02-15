import { NextResponse } from "next/server";
import { getQAPairs, saveQAPairs } from "@/lib/store";
import { createEmbeddings } from "@/lib/embeddings";
import type { QAPair } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { pairs } = (await request.json()) as {
    pairs: { question: string; answer: string; tags?: string[] }[];
  };

  if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
    return NextResponse.json(
      { error: "No pairs provided" },
      { status: 400 }
    );
  }

  const existing = getQAPairs();
  const now = new Date().toISOString();

  // Create embeddings for all questions in batch
  let embeddings: number[][] = [];
  try {
    embeddings = await createEmbeddings(pairs.map((p) => p.question));
  } catch {
    // Embeddings will be empty
  }

  const newPairs: QAPair[] = pairs.map((p, i) => ({
    id: uuidv4(),
    question: p.question,
    answer: p.answer,
    tags: p.tags || [],
    embedding: embeddings[i] || undefined,
    createdAt: now,
    updatedAt: now,
  }));

  saveQAPairs([...existing, ...newPairs]);

  return NextResponse.json({
    saved: newPairs.length,
    total: existing.length + newPairs.length,
  });
}

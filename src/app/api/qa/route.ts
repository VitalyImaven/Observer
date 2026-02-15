import { NextResponse } from "next/server";
import { getQAPairs, saveQAPairs } from "@/lib/store";
import { createEmbedding } from "@/lib/embeddings";
import type { QAPair } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const pairs = getQAPairs();
  return NextResponse.json(pairs);
}

export async function POST(request: Request) {
  const body = await request.json();
  const pairs = getQAPairs();
  const now = new Date().toISOString();

  let embedding: number[] | undefined;
  try {
    embedding = await createEmbedding(body.question);
  } catch {
    // Embedding will be created later if API key not set
  }

  const newPair: QAPair = {
    id: uuidv4(),
    question: body.question || "",
    answer: body.answer || "",
    tags: body.tags || [],
    embedding,
    createdAt: now,
    updatedAt: now,
  };
  pairs.push(newPair);
  saveQAPairs(pairs);
  return NextResponse.json(newPair);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const pairs = getQAPairs();
  const index = pairs.findIndex((p) => p.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const questionChanged = body.question && body.question !== pairs[index].question;
  let embedding = pairs[index].embedding;
  if (questionChanged) {
    try {
      embedding = await createEmbedding(body.question);
    } catch {
      // keep old embedding
    }
  }

  pairs[index] = {
    ...pairs[index],
    question: body.question ?? pairs[index].question,
    answer: body.answer ?? pairs[index].answer,
    tags: body.tags ?? pairs[index].tags,
    embedding,
    updatedAt: new Date().toISOString(),
  };
  saveQAPairs(pairs);
  return NextResponse.json(pairs[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }
  let pairs = getQAPairs();
  pairs = pairs.filter((p) => p.id !== id);
  saveQAPairs(pairs);
  return NextResponse.json({ success: true });
}

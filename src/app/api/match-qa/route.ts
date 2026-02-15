import { NextResponse } from "next/server";
import { getQAPairs } from "@/lib/store";
import { createEmbedding, findTopMatches } from "@/lib/embeddings";

export async function POST(request: Request) {
  const { question } = await request.json();

  const pairs = getQAPairs();
  if (pairs.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const pairsWithEmbeddings = pairs.filter(
    (p) => p.embedding && p.embedding.length > 0
  );
  if (pairsWithEmbeddings.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  try {
    const queryEmbedding = await createEmbedding(question);
    const matches = findTopMatches(queryEmbedding, pairsWithEmbeddings, 3);

    return NextResponse.json({
      matches: matches.map((m) => ({
        id: m.item.id,
        question: m.item.question,
        answer: m.item.answer,
        similarity: Math.round(m.similarity * 100),
        tags: m.item.tags,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Matching failed: ${error}` },
      { status: 500 }
    );
  }
}

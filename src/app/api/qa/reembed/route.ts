import { NextResponse } from "next/server";
import { getQAPairs, saveQAPairs } from "@/lib/store";
import { createEmbeddings } from "@/lib/embeddings";

export async function POST() {
  const pairs = getQAPairs();
  if (pairs.length === 0) {
    return NextResponse.json({ message: "No Q&A pairs to re-embed", count: 0 });
  }

  try {
    const questions = pairs.map((p) => p.question);
    console.log(`[REEMBED] Re-embedding ${questions.length} Q&A pairs...`);

    const embeddings = await createEmbeddings(questions);

    for (let i = 0; i < pairs.length; i++) {
      pairs[i].embedding = embeddings[i];
      pairs[i].updatedAt = new Date().toISOString();
    }

    saveQAPairs(pairs);
    console.log(`[REEMBED] Done — ${pairs.length} pairs updated`);

    return NextResponse.json({
      message: `Re-embedded ${pairs.length} Q&A pairs`,
      count: pairs.length,
    });
  } catch (error) {
    console.error("[REEMBED] Error:", error);
    return NextResponse.json(
      { error: `Re-embedding failed: ${error}` },
      { status: 500 }
    );
  }
}

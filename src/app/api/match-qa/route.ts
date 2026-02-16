import { NextResponse } from "next/server";
import { getQAPairs } from "@/lib/store";
import { createEmbedding, findTopMatches } from "@/lib/embeddings";
import { getOpenAIClient, getChatModel } from "@/lib/openai";

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
    // Step 1: Embedding search — get top 5 candidates fast
    const queryEmbedding = await createEmbedding(question);
    const embeddingMatches = findTopMatches(queryEmbedding, pairsWithEmbeddings, 5);

    console.log(`\n[MATCH-QA] ========================================`);
    console.log(`[MATCH-QA] Input: "${question}"`);
    console.log(`[MATCH-QA] Embedding results:`);
    embeddingMatches.forEach((m, i) => {
      const pct = Math.round(m.similarity * 100);
      console.log(`[MATCH-QA]   #${i + 1}: ${pct}% — "${m.item.question}"`);
    });

    // Step 2: AI re-ranking — ask the model to evaluate semantic match
    // Only re-rank if top embedding match is between 40-85%
    // (above 85% is clearly a match, below 40% is clearly not)
    const topScore = Math.round(embeddingMatches[0]?.similarity * 100) || 0;

    if (topScore >= 85) {
      // High confidence — use embedding result directly
      console.log(`[MATCH-QA] Top score ${topScore}% >= 85% — using directly`);
      console.log(`[MATCH-QA] ========================================\n`);
      return NextResponse.json({
        matches: embeddingMatches.map((m) => ({
          id: m.item.id,
          question: m.item.question,
          answer: m.item.answer,
          similarity: Math.round(m.similarity * 100),
          tags: m.item.tags,
        })),
      });
    }

    if (topScore < 40) {
      // Too low — no match
      console.log(`[MATCH-QA] Top score ${topScore}% < 40% — no match`);
      console.log(`[MATCH-QA] ========================================\n`);
      return NextResponse.json({ matches: [] });
    }

    // Middle range — use AI to re-rank
    console.log(`[MATCH-QA] Top score ${topScore}% — using AI re-ranking...`);

    const candidateList = embeddingMatches
      .slice(0, 3)
      .map((m, i) => `${i + 1}. "${m.item.question}"`)
      .join("\n");

    const client = getOpenAIClient();
    const model = getChatModel();

    const reranking = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "developer",
          content: `You are a question-matching expert. Given a spoken question and a list of candidate questions from a database, determine which candidate (if any) is asking the SAME thing — even if worded very differently or in a different language style.

Respond with ONLY a JSON object: {"match": <number or null>, "confidence": <0-100>}
- "match": the number (1, 2, or 3) of the best matching candidate, or null if none match
- "confidence": how confident you are (0-100) that the questions ask the same thing

Be generous with matching — if the core intent is the same, it's a match even if the exact words differ significantly.`,
        },
        {
          role: "user",
          content: `Spoken question: "${question}"

Candidates:
${candidateList}

Which candidate, if any, is asking the same thing?`,
        },
      ],
      temperature: 0,
      max_completion_tokens: 100,
    });

    const responseText = reranking.choices[0]?.message?.content?.trim() || "";
    console.log(`[MATCH-QA] AI re-rank response: ${responseText}`);

    try {
      // Parse the JSON — handle cases where model wraps in markdown
      const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const result = JSON.parse(jsonStr);

      if (result.match && result.confidence >= 60) {
        const matchIndex = result.match - 1;
        if (matchIndex >= 0 && matchIndex < embeddingMatches.length) {
          const matched = embeddingMatches[matchIndex];
          // Use AI confidence as the similarity score
          console.log(`[MATCH-QA] AI matched candidate #${result.match} with ${result.confidence}% confidence`);
          console.log(`[MATCH-QA] ========================================\n`);
          return NextResponse.json({
            matches: [{
              id: matched.item.id,
              question: matched.item.question,
              answer: matched.item.answer,
              similarity: result.confidence,
              tags: matched.item.tags,
            }],
          });
        }
      }

      console.log(`[MATCH-QA] AI says no match (match: ${result.match}, confidence: ${result.confidence})`);
    } catch {
      console.log(`[MATCH-QA] Failed to parse AI response: "${responseText}"`);
    }

    console.log(`[MATCH-QA] ========================================\n`);
    // Fallback: return embedding matches with original scores
    return NextResponse.json({
      matches: embeddingMatches.map((m) => ({
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

import { getOpenAIClient, getChatModel } from "@/lib/openai";
import { getDirectives, getSettings, getKnowledgeChunks } from "@/lib/store";
import { createEmbedding, findTopMatches } from "@/lib/embeddings";

export async function POST(request: Request) {
  const { question, context } = await request.json();

  const client = getOpenAIClient();
  const model = getChatModel();
  const settings = getSettings();
  const directives = getDirectives();

  const activeDirective = settings.activeDirectiveId
    ? directives.find((d) => d.id === settings.activeDirectiveId)
    : null;

  // Gather relevant knowledge
  let knowledgeContext = "";
  try {
    const chunks = getKnowledgeChunks();
    if (chunks.length > 0 && chunks.some((c) => c.embedding)) {
      const queryEmb = await createEmbedding(question);
      const matches = findTopMatches(queryEmb, chunks, 5);
      if (matches.length > 0) {
        knowledgeContext =
          "\n\nRelevant knowledge from uploaded documents:\n" +
          matches.map((m) => m.item.content).join("\n---\n");
      }
    }
  } catch {
    // Knowledge context will be empty
  }

  const developerPrompt = [
    "You are a real-time meeting assistant for a startup founder in a venture capital meeting.",
    "",
    "HOW THIS WORKS:",
    "You receive the full conversation transcript so far. The latest speech is what was just said.",
    "Your job: analyze the latest speech and decide — is there a QUESTION that needs an answer?",
    "- If YES (someone asked a question — investor OR founder): provide a great answer.",
    "- If NO (it was just a statement, small talk, or not something that needs a response): respond with exactly: [NO_ANSWER_NEEDED]",
    "",
    "LANGUAGE: Detect the language being spoken and ALWAYS respond in the SAME language.",
    "",
    "ANSWER STYLE:",
    "- Natural, conversational tone — the founder will READ this aloud. It must sound like a real person talking, NOT a document.",
    "- Medium length: 2-4 sentences. Not too short, not too long.",
    "- Casual-professional. No bullet points, no headers, no markdown formatting. Just flowing speech.",
    "- Sound confident and human.",
    "",
    "DATA & NUMBERS:",
    "- ALWAYS use real data from the uploaded documents below. Numbers, metrics, percentages — take them from the knowledge base.",
    "- Do NOT invent or hallucinate numbers. If the knowledge base has the data, use it exactly.",
    "- Only if the knowledge base has NO relevant data for a specific question, you may use general knowledge — but prefer saying 'we are still finalizing those numbers' over making things up.",
    activeDirective
      ? `\nActive Directive: "${activeDirective.name}"\n${activeDirective.content}`
      : "",
    knowledgeContext,
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = context
    ? `FULL CONVERSATION SO FAR:\n${context}\n\nLATEST SPEECH (just now):\n"${question}"\n\nIf the latest speech contains a question, provide the answer. If not, respond with [NO_ANSWER_NEEDED].`
    : `LATEST SPEECH:\n"${question}"\n\nIf this contains a question, provide the answer. If not, respond with [NO_ANSWER_NEEDED].`;

  console.log(`\n[GENERATE] ========================================`);
  console.log(`[GENERATE] Latest speech: "${question}"`);
  console.log(`[GENERATE] Speech length: ${question.length} chars`);
  console.log(`[GENERATE] Model: ${model}`);
  console.log(`[GENERATE] Directive: ${activeDirective ? activeDirective.name : "none"}`);
  console.log(`[GENERATE] Knowledge: ${knowledgeContext ? "yes" : "no"}`);
  console.log(`[GENERATE] Conversation context: ${context ? "yes (" + context.length + " chars)" : "none"}`);
  console.log(`[GENERATE] ========================================\n`);

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "developer", content: developerPrompt },
      { role: "user", content: userContent },
    ],
    stream: true,
    temperature: 0.7,
    max_completion_tokens: 1000,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let flushed = false;

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (!text) continue;

        buffer += text;

        // Buffer the first 25 chars to check for [NO_ANSWER_NEEDED]
        if (!flushed) {
          if (buffer.includes("[NO_ANSWER_NEEDED]")) {
            console.log("[GENERATE] Model decided: no answer needed");
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          // Once we have enough chars and it's not the marker, flush buffer
          if (buffer.length >= 25) {
            flushed = true;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`)
            );
          }
          continue;
        }

        // After flush, stream normally
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
        );
      }

      // Handle short responses that never reached 25 chars
      if (!flushed) {
        if (buffer.includes("[NO_ANSWER_NEEDED]")) {
          console.log("[GENERATE] Model decided: no answer needed");
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        if (buffer) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`)
          );
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

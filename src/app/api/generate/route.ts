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

  // Gather relevant knowledge — filtered by directive's KB if set
  let knowledgeContext = "";
  try {
    let chunks = getKnowledgeChunks();
    const kbId = activeDirective?.knowledgeBaseId;
    if (kbId) {
      chunks = chunks.filter((c) => c.knowledgeBaseId === kbId);
    }
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
    "You are a real-time meeting assistant.",
    "You receive speech from a live conversation. If the latest speech contains a question that needs an answer, provide the answer. If not, respond with exactly: [NO_ANSWER_NEEDED]",
    "Detect the spoken language and ALWAYS respond in the SAME language.",
    activeDirective ? `\n${activeDirective.content}` : "",
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

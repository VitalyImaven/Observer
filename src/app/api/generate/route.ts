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
    "You are an expert meeting assistant helping a startup founder answer venture capital investor questions.",
    "IMPORTANT: Detect the language of the investor's question and ALWAYS respond in the SAME language. If the question is in Hebrew, respond in Hebrew. If in English, respond in English. Match the language exactly.",
    "TONE & STYLE: Write answers in a natural, conversational tone — as if the founder is speaking out loud in a real meeting. The other side should feel like they are having a natural conversation, NOT reading a document.",
    "Keep answers medium length — not too short (don't sound dismissive) and not too long (don't bore the investor). Aim for 2-4 natural sentences.",
    "Use casual-professional language. Avoid bullet points, headers, or overly structured formatting. Write flowing sentences that are easy to read aloud.",
    "Sound confident and human — use phrases like 'Look, ...', 'The way we see it...', 'What's interesting is...', 'So basically...' to make it feel like real speech.",
    activeDirective
      ? `\nActive Directive: "${activeDirective.name}"\n${activeDirective.content}`
      : "",
    knowledgeContext,
    context ? `\nConversation context so far:\n${context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // GPT-5.2 uses 'developer' role instead of 'system'
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "developer", content: developerPrompt },
      {
        role: "user",
        content: `The investor asked: "${question}"\n\nProvide the best answer:`,
      },
    ],
    stream: true,
    temperature: 0.7,
    max_completion_tokens: 1000,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
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

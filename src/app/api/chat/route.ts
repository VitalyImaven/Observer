import { getOpenAIClient, getChatModel } from "@/lib/openai";
import { getDirectives, getSettings, getKnowledgeChunks } from "@/lib/store";
import { createEmbedding, findTopMatches } from "@/lib/embeddings";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const { messages, useKnowledge } = (await request.json()) as {
    messages: ChatMessage[];
    useKnowledge?: boolean;
  };

  const client = getOpenAIClient();
  const model = getChatModel();
  const settings = getSettings();
  const directives = getDirectives();

  const activeDirective = settings.activeDirectiveId
    ? directives.find((d) => d.id === settings.activeDirectiveId)
    : null;

  // Optionally gather relevant knowledge based on the last user message
  let knowledgeContext = "";
  if (useKnowledge !== false) {
    try {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        const chunks = getKnowledgeChunks();
        if (chunks.length > 0 && chunks.some((c) => c.embedding)) {
          const queryEmb = await createEmbedding(lastUserMsg.content);
          const matches = findTopMatches(queryEmb, chunks, 5);
          if (matches.length > 0) {
            knowledgeContext =
              "\n\nRelevant knowledge from uploaded documents:\n" +
              matches.map((m) => m.item.content).join("\n---\n");
          }
        }
      }
    } catch {
      // Knowledge context will be empty
    }
  }

  const developerPrompt = [
    "You are Observer, an AI assistant for a startup founder preparing for venture capital meetings.",
    "You have deep knowledge about the founder's business from uploaded documents.",
    "Be helpful, clear, and insightful. Help the founder prepare for tough investor questions.",
    "You can help brainstorm answers, refine pitches, discuss strategy, and practice Q&A.",
    "IMPORTANT: Detect the language the user is writing in and ALWAYS respond in the SAME language. If the user writes in Hebrew, respond in Hebrew. If in English, respond in English. Match the language exactly.",
    "TONE & STYLE: Write in a natural, conversational tone — as if the founder is speaking in a real meeting. Answers should sound like natural speech, easy to read aloud. Medium length (2-4 sentences). Avoid bullet points or overly structured formatting in meeting answers.",
    activeDirective
      ? `\nActive Directive: "${activeDirective.name}"\n${activeDirective.content}`
      : "",
    knowledgeContext,
  ]
    .filter(Boolean)
    .join("\n");

  // GPT-5.2 uses 'developer' role
  const apiMessages = [
    { role: "developer" as const, content: developerPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const stream = await client.chat.completions.create({
    model,
    messages: apiMessages,
    stream: true,
    temperature: 0.7,
    max_completion_tokens: 2000,
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

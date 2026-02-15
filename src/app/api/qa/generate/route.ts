import { getOpenAIClient, getChatModel } from "@/lib/openai";
import { getDirectives, getSettings, getKnowledgeChunks } from "@/lib/store";

export async function POST(request: Request) {
  const { prompt, count } = await request.json();

  const client = getOpenAIClient();
  const model = getChatModel();
  const settings = getSettings();
  const directives = getDirectives();

  const activeDirective = settings.activeDirectiveId
    ? directives.find((d) => d.id === settings.activeDirectiveId)
    : null;

  // Gather all knowledge for context
  let knowledgeContext = "";
  try {
    const chunks = getKnowledgeChunks();
    if (chunks.length > 0) {
      const allText = chunks
        .slice(0, 30)
        .map((c) => c.content)
        .join("\n---\n");
      knowledgeContext = `\n\nKnowledge from uploaded documents (use this to create accurate, specific answers):\n${allText}`;
    }
  } catch {
    // No knowledge available
  }

  const developerPrompt = [
    "You are an expert at preparing startup founders for venture capital meetings.",
    "Your task is to generate realistic investor questions and craft the BEST possible answers.",
    "The answers should be confident, data-driven when possible, concise, and impressive to investors.",
    "",
    "You MUST respond ONLY with a valid JSON array. No markdown, no code fences, no explanation outside the JSON.",
    "Each item must have exactly these fields: \"question\" (string) and \"answer\" (string).",
    "",
    "Example format:",
    '[{"question":"What is your total addressable market?","answer":"Our TAM is $50B globally..."}]',
    activeDirective
      ? `\nDirective to follow for answer style: "${activeDirective.name}"\n${activeDirective.content}`
      : "",
    knowledgeContext,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt =
    prompt ||
    `Generate ${count || 20} realistic venture capital investor questions with excellent answers. Cover topics like: market size, business model, revenue, traction, team, competition, moat, unit economics, fundraising, exit strategy, risks, and growth plans.`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "developer", content: developerPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nRespond with a JSON array of {question, answer} objects. Generate exactly ${count || 20} pairs. ONLY output valid JSON, nothing else.`,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 8000,
    });

    const content = response.choices[0]?.message?.content || "[]";

    // Parse JSON - handle cases where model wraps in markdown code fences
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }

    let pairs;
    try {
      pairs = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON array from the response
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        pairs = JSON.parse(match[0]);
      } else {
        return Response.json(
          { error: "Failed to parse AI response as Q&A pairs" },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(pairs)) {
      return Response.json(
        { error: "AI response is not an array" },
        { status: 500 }
      );
    }

    // Validate and clean
    const validPairs = pairs
      .filter(
        (p: { question?: string; answer?: string }) =>
          p.question &&
          p.answer &&
          typeof p.question === "string" &&
          typeof p.answer === "string"
      )
      .map((p: { question: string; answer: string }) => ({
        question: p.question.trim(),
        answer: p.answer.trim(),
      }));

    return Response.json({ pairs: validPairs });
  } catch (error) {
    return Response.json(
      { error: `Generation failed: ${error}` },
      { status: 500 }
    );
  }
}

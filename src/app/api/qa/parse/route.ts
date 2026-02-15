import { getOpenAIClient, getChatModel } from "@/lib/openai";

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text) {
    return Response.json({ error: "No text provided" }, { status: 400 });
  }

  const client = getOpenAIClient();
  const model = getChatModel();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "developer",
          content: [
            "Extract question-and-answer pairs from the given text.",
            "Return ONLY a valid JSON array where each item has \"question\" and \"answer\" fields.",
            "If the text contains numbered Q&A pairs, extract them all.",
            "If the text is a single answer to a question, create one pair.",
            "If no Q&A pairs can be extracted, return an empty array [].",
            "No markdown, no code fences, ONLY the JSON array.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Extract all Q&A pairs from this text:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }

    let pairs;
    try {
      pairs = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        pairs = JSON.parse(match[0]);
      } else {
        return Response.json({ pairs: [] });
      }
    }

    const validPairs = (Array.isArray(pairs) ? pairs : [])
      .filter(
        (p: { question?: string; answer?: string }) =>
          p.question && p.answer
      )
      .map((p: { question: string; answer: string }) => ({
        question: p.question.trim(),
        answer: p.answer.trim(),
      }));

    return Response.json({ pairs: validPairs });
  } catch (error) {
    return Response.json(
      { error: `Parse failed: ${error}` },
      { status: 500 }
    );
  }
}

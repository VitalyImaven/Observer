import { getOpenAIClient, getEmbeddingModel } from "./openai";

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const model = getEmbeddingModel();
  const response = await client.embeddings.create({
    model,
    input: text,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAIClient();
  const model = getEmbeddingModel();
  const response = await client.embeddings.create({
    model,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function findTopMatches<T extends { embedding?: number[] }>(
  queryEmbedding: number[],
  items: T[],
  topK: number = 3
): { item: T; similarity: number }[] {
  const results = items
    .filter((item) => item.embedding && item.embedding.length > 0)
    .map((item) => ({
      item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding!),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  return results;
}

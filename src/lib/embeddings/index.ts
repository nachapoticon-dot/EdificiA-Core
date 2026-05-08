/**
 * Generates a vector embedding for the given text using NVIDIA NIM (baai/bge-m3, 1024 dims).
 * Returns null when NVIDIA_API_KEY is not set — callers fall back to PostgreSQL text search.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "baai/bge-m3",
        input: text.slice(0, 8000),
        encoding_format: "float",
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

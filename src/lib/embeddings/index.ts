import { z } from "zod";

const nvidiaEmbeddingsResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })).min(1),
});

/**
 * Generates a vector embedding for the given text using NVIDIA NIM (baai/bge-m3, 1024 dims).
 * Returns null when NVIDIA_API_KEY is not set or the provider response is unexpected
 * — callers fall back to PostgreSQL text search.
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
      // Sin esto, un stream HTTP/2 colgado bloquea la ingesta hasta 5 min (UND_ERR_INFO)
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn("[embeddings] non-ok response", { status: response.status });
      return null;
    }

    const parsed = nvidiaEmbeddingsResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      // Detectar cambios de shape del provider antes de que se conviertan en
      // búsquedas degradadas silenciosas.
      console.warn("[embeddings] unexpected response shape", {
        issues: parsed.error.flatten(),
      });
      return null;
    }
    return parsed.data.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[embeddings] fetch failed", { err });
    return null;
  }
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION_NAME = "edificia_documents";

/** Vector dimension for baai/bge-m3 via NVIDIA NIM */
export const EMBEDDING_DIM = 1024;

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    const url = process.env.QDRANT_URL;
    if (!url) throw new Error("QDRANT_URL is not configured");
    _client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
  }
  return _client;
}

/** Creates the collection if it doesn't exist. Call once at startup / before first ingest. */
export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient();
  const { exists } = await client.collectionExists(COLLECTION_NAME);
  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
  }
}

export function isQdrantConfigured(): boolean {
  return Boolean(process.env.QDRANT_URL);
}

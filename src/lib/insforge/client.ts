import { createClient, type InsForgeClient } from "@insforge/sdk";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;

let _client: InsForgeClient | null = null;

/**
 * Returns the singleton browser InsForge client.
 * Session is managed via httpOnly cookies set by the InsForge backend.
 * Only call from Client Components or browser-side code.
 */
export function getInsForgeClient(): InsForgeClient {
  if (!_client) {
    _client = createClient({ baseUrl: BASE_URL });
  }
  return _client;
}

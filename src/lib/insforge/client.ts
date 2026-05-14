import { createClient, type InsForgeClient } from "@insforge/sdk";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const TOKEN_KEY = "edificia:access_token";

let _client: InsForgeClient | null = null;

/**
 * Returns the singleton browser InsForge client.
 * Token is persisted in sessionStorage so it survives hot reloads and page refreshes.
 * Only call from Client Components or browser-side code.
 */
export function getInsForgeClient(): InsForgeClient {
  if (!_client) {
    _client = createClient({ baseUrl: BASE_URL });
    // Restore token from sessionStorage (survives hot reload + page refresh)
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(TOKEN_KEY);
      if (saved) _client.getHttpClient().setAuthToken(saved);
    }
  }
  return _client;
}

/** Call after successful sign-in to persist the token across reloads. */
export function persistAuthToken(rawToken: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, rawToken);
  }
}

/** Call on sign-out to remove the persisted token. */
export function clearPersistedToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
  }
  _client = null;
}

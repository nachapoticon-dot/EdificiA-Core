import { createClient, type InsForgeClient } from "@insforge/sdk";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const TOKEN_KEY = "edificia:access_token";
const SESSION_COOKIE = "edificia_session";

let _client: InsForgeClient | null = null;

/**
 * Returns the singleton browser InsForge client.
 * Token is persisted in localStorage so it survives tab closes and browser restarts.
 * Only call from Client Components or browser-side code.
 */
export function getInsForgeClient(): InsForgeClient {
  if (!_client) {
    _client = createClient({ baseUrl: BASE_URL });
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) _client.getHttpClient().setAuthToken(saved);
    }
  }
  return _client;
}

/** Call after successful sign-in to persist the token across reloads and tabs. */
export function persistAuthToken(rawToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, rawToken);
  // Set a cookie so Next.js middleware can detect the session server-side.
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${rawToken}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/** Call on sign-out to remove the persisted token and session cookie. */
export function clearPersistedToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
  _client = null;
}

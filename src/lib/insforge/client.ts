import { createClient, type InsForgeClient } from "@insforge/sdk";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const TOKEN_KEY = "edificia:access_token";
const REFRESH_KEY = "edificia:refresh_token";
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
      const savedRefresh = localStorage.getItem(REFRESH_KEY);
      if (savedRefresh) _client.getHttpClient().setRefreshToken(savedRefresh);
    }
  }
  return _client;
}

/** Call after successful sign-in to persist the token across reloads and tabs. */
export function persistAuthToken(rawToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, rawToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  // Set a cookie so Next.js middleware can detect the session server-side.
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${rawToken}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Returns a valid access token, refreshing it if expired or near expiry (< 2 min left).
 * Falls back to the stored token if refresh fails.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const client = getInsForgeClient();
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]!)) as { exp?: number };
      if ((payload.exp ?? 0) * 1000 > Date.now() + 120_000) {
        return token; // still valid
      }
    } catch {
      return token; // can't decode — return as-is, server will validate
    }
  }

  // Token expired or near expiry — attempt refresh
  const savedRefresh = localStorage.getItem(REFRESH_KEY);
  if (savedRefresh) {
    try {
      const { data } = await client.auth.refreshSession({ refreshToken: savedRefresh });
      if (data?.accessToken) {
        const newRefresh = data.refreshToken ?? undefined;
        persistAuthToken(data.accessToken, newRefresh);
        client.getHttpClient().setAuthToken(data.accessToken);
        if (newRefresh) client.getHttpClient().setRefreshToken(newRefresh);
        return data.accessToken;
      }
    } catch {
      // Refresh failed — return whatever token we have
    }
  }

  return token;
}

/** Call on sign-out to remove the persisted token and session cookie. */
export function clearPersistedToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
  _client = null;
}

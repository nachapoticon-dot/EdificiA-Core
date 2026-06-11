/**
 * Cliente de sesión del browser — sin SDK de InsForge.
 *
 * La sesión vive en localStorage (access + refresh token) y en la cookie
 * httpOnly `edificia_session` (seteada server-side por /api/auth/login).
 * El refresh se hace contra /api/auth/refresh (rotación server-side).
 *
 * `getInsForgeClient()` se mantiene por compatibilidad con los call-sites
 * existentes (signOut best-effort, setAuthToken, getHeaders) pero ya no
 * habla con ningún servicio externo.
 */

const TOKEN_KEY = "edificia:access_token";
const REFRESH_KEY = "edificia:refresh_token";

interface BrowserSessionClient {
  auth: { signOut(): Promise<void> };
  getHttpClient(): {
    setAuthToken(token: string): void;
    setRefreshToken(token: string): void;
    getHeaders(): Record<string, string>;
  };
}

const browserClient: BrowserSessionClient = {
  auth: {
    // El logout real es POST /api/auth/logout (borra la cookie) + clearPersistedToken()
    signOut: async () => {},
  },
  getHttpClient: () => ({
    setAuthToken: (token: string) => {
      if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
    },
    setRefreshToken: (token: string) => {
      if (typeof window !== "undefined") localStorage.setItem(REFRESH_KEY, token);
    },
    getHeaders: (): Record<string, string> => {
      if (typeof window === "undefined") return {};
      const token = localStorage.getItem(TOKEN_KEY);
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  }),
};

export function getInsForgeClient(): BrowserSessionClient {
  return browserClient;
}

/** Call after successful sign-in to persist the token in localStorage. */
export function persistAuthToken(rawToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, rawToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  // The httpOnly session cookie is set server-side by POST /api/auth/login.
}

/**
 * Returns Authorization headers with a valid token, refreshing it if needed.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Returns a valid access token, refreshing it if expired or near expiry (< 2 min left).
 * Falls back to the stored token if refresh fails.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
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

  // Token expirado o por expirar — refresh con rotación vía API propia
  const savedRefresh = localStorage.getItem(REFRESH_KEY);
  if (savedRefresh) {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: savedRefresh }),
      });
      if (res.ok) {
        const data = (await res.json()) as { accessToken?: string; refreshToken?: string | null };
        if (data.accessToken) {
          persistAuthToken(data.accessToken, data.refreshToken ?? undefined);
          return data.accessToken;
        }
      }
    } catch {
      // Refresh failed — return whatever token we have
    }
  }

  return token;
}

/** Call on sign-out to clear localStorage. The httpOnly cookie is cleared by POST /api/auth/logout. */
export function clearPersistedToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

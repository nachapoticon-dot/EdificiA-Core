import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "edificia_session";
const REQUEST_ID_HEADER = "x-request-id";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,x-org-id,x-project-id,x-project-name,x-request-id",
  "Access-Control-Expose-Headers": "x-request-id",
  "Access-Control-Max-Age": "86400",
};

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin") ?? "";

  // Respetar el ID inyectado por el cliente (útil para correlación cross-system) o generar uno nuevo.
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  // ── CORS preflight ───────────────────────────────────────────────────────
  if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const res = new NextResponse(null, { status: 204 });
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Vary", "Origin");
    }
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  // ── Dashboard auth gate ──────────────────────────────────────────────────
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = isValidToken(token);

  if (pathname.startsWith("/dashboard")) {
    if (!isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const res = nextWithRequestId(req, requestId);
    setCorsHeader(res, origin);
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  if (pathname === "/login" || pathname === "/register") {
    if (isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/chat";
      return NextResponse.redirect(url);
    }
  }

  const res = nextWithRequestId(req, requestId);
  if (pathname.startsWith("/api/")) setCorsHeader(res, origin);
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

function nextWithRequestId(req: NextRequest, requestId: string): NextResponse {
  const headers = new Headers(req.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return NextResponse.next({ request: { headers } });
}

function setCorsHeader(res: NextResponse, origin: string) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return false;

    // base64url → base64 with padding
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    // Edge-runtime compatible UTF-8 decode
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
      sub?: string;
      exp?: number;
    };

    if (!claims.sub || claims.sub.length < 10) return false;
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register", "/api/:path*"],
};

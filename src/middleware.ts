import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "edificia_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = isValidToken(token);

  if (pathname.startsWith("/dashboard")) {
    if (!isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/register") {
    if (isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/chat";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
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
  matcher: ["/dashboard/:path*", "/login", "/register"],
};

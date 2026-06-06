import { NextResponse, type NextRequest } from "next/server";

// Edge-compatible: decode without verifying signature.
// HMAC verification happens in API route handlers (server-side Node.js).
// Middleware only guards routing — prevents navigating to the wrong tenant slug.
function extractTenantFromSession(token: string): string | null {
  try {
    const encodedPayload = token.split(".")[0];
    if (!encodedPayload) return null;
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      tenantId?: unknown;
      exp?: number;
    };
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return typeof payload.tenantId === "string" ? payload.tenantId : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isTenantPath = pathname.startsWith("/t/");
  const isAdminPath = pathname.startsWith("/admin");
  if (!isTenantPath && !isAdminPath) {
    return NextResponse.next();
  }
  const sessionToken = req.cookies.get("portal_session")?.value;
  if (!sessionToken) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "authentication_required");
    return NextResponse.redirect(url);
  }

  if (!isTenantPath) {
    return NextResponse.next();
  }
  const parts = pathname.split("/").filter(Boolean);
  const tenantSlug = parts[1];
  if (!tenantSlug) return NextResponse.redirect(new URL("/login", req.url));

  // Decode tenant from session token (no HMAC verify — Edge runtime limitation).
  // Full signature verification happens in every API route handler.
  const sessionTenantId = extractTenantFromSession(sessionToken);
  if (!sessionTenantId) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "authentication_required");
    return NextResponse.redirect(url);
  }
  if (sessionTenantId !== tenantSlug) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "tenant_mismatch");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/t/:path*", "/admin/:path*"],
};

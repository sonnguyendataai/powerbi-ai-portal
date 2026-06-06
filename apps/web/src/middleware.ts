import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

function extractTenantFromSession(token: string, secret: string): string | null {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;
    const expected = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
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

  // Validate the tenant slug against the signed session token, not just the cookie
  const secret = process.env["SESSION_SIGNING_SECRET"];
  if (secret) {
    const sessionTenantId = extractTenantFromSession(sessionToken, secret);
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

  // Fallback (dev without secret): check portal_tenant cookie
  const tenantFromCookie = req.cookies.get("portal_tenant")?.value;
  if (!tenantFromCookie) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "tenant_required");
    return NextResponse.redirect(url);
  }
  if (tenantFromCookie !== tenantSlug) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "tenant_mismatch");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/t/:path*", "/admin/:path*"],
};

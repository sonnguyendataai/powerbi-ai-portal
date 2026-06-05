import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isTenantPath = pathname.startsWith("/t/");
  const isAdminPath = pathname.startsWith("/admin");
  if (!isTenantPath && !isAdminPath) {
    return NextResponse.next();
  }
  const hasSession = Boolean(req.cookies.get("portal_session")?.value);
  if (!hasSession) {
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
  const tenantFromCookie = req.cookies.get("portal_tenant")?.value;
  const tenant = tenantFromCookie;
  if (!tenant) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "tenant_required");
    return NextResponse.redirect(url);
  }

  if (tenant !== tenantSlug) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "tenant_mismatch");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/t/:path*", "/admin/:path*"],
};

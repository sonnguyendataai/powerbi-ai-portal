import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/t/")) {
    return NextResponse.next();
  }

  const parts = pathname.split("/").filter(Boolean);
  const tenantSlug = parts[1];
  if (!tenantSlug) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const tenantFromHeader = req.headers.get("x-tenant-id");
  const tenantFromCookie = req.cookies.get("portal_tenant")?.value;
  const tenant = tenantFromHeader ?? tenantFromCookie;
  if (!tenant) {
    const url = new URL("/", req.url);
    url.searchParams.set("error", "tenant_required");
    return NextResponse.redirect(url);
  }

  if (tenant !== tenantSlug) {
    const url = new URL("/", req.url);
    url.searchParams.set("error", "tenant_mismatch");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/t/:path*"],
};

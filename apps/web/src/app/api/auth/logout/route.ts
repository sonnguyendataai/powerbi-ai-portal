import { NextResponse } from "next/server";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("portal_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("portal_tenant", "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
  });
  return res;
}

import { NextResponse } from "next/server";
import { resolveSessionUser } from "@/app/api/_lib/session";

export async function GET(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

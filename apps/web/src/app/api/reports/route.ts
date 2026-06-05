import { NextResponse } from "next/server";
import { z } from "zod";
import { getBiOperationsService } from "@/bi-ops";
import { resolveSessionUser } from "@/app/api/_lib/session";

const toggleSchema = z.object({
  reportId: z.string().min(1),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    const svc = await getBiOperationsService();
    return NextResponse.json({
      reports: svc.listReportsForUser(user.userId),
      favorites: svc.listFavorites(user.userId),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    const json = await req.json().catch(() => null);
    const parsed = toggleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
    }
    const svc = await getBiOperationsService();
    const favorite = svc.toggleFavorite(user.userId, parsed.data.reportId);
    return NextResponse.json({ favorite });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 });
  }
}

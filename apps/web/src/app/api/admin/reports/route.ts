import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

const reportSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  embedUrl: z.string().url().or(z.string().startsWith("https://")),
  pageIds: z.array(z.string().min(1)),
  isDeleted: z.boolean().default(false),
});

const favoriteSchema = z.object({
  userId: z.string().min(1),
  reportId: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const payload = await req.json().catch(() => null);
  if (payload && typeof payload === "object" && "favorite" in payload) {
    const favParsed = favoriteSchema.safeParse(payload.favorite);
    if (!favParsed.success) {
      return NextResponse.json({ error: "invalid_favorite_request", issues: favParsed.error.issues }, { status: 400 });
    }
    const svc = await getBiOperationsService();
    return NextResponse.json({ favorite: svc.toggleFavorite(favParsed.data.userId, favParsed.data.reportId) });
  }
  const parsed = reportSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const svc = await getBiOperationsService();
  const report = svc.upsertReport({
    ...parsed.data,
    isDeleted: parsed.data.isDeleted ?? false,
  });
  return NextResponse.json({ report }, { status: 200 });
}

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const svc = await getBiOperationsService();
  if (userId) {
    return NextResponse.json({
      reports: svc.listReportsForUser(userId),
      favorites: svc.listFavorites(userId),
    });
  }
  return NextResponse.json({ reports: svc.listReports() });
}

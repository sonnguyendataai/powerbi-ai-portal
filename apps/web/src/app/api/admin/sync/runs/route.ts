import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["running", "succeeded", "failed"]).optional(),
  mode: z.enum(["full", "workspace"]).optional(),
  workspaceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const parsedQuery = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
    workspaceId: url.searchParams.get("workspaceId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "invalid_query", issues: parsedQuery.error.issues }, { status: 400 });
  }

  const service = await getBiOperationsService();
  const runs = service.listSyncRuns().filter((run) => {
    if (parsedQuery.data.status && run.status !== parsedQuery.data.status) return false;
    if (parsedQuery.data.mode && run.mode !== parsedQuery.data.mode) return false;
    if (parsedQuery.data.workspaceId && run.workspaceId !== parsedQuery.data.workspaceId) return false;
    return true;
  }).slice(parsedQuery.data.offset, parsedQuery.data.offset + parsedQuery.data.limit);

  return NextResponse.json(
    { runs },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

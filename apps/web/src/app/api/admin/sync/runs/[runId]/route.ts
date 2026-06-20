import { NextResponse } from "next/server";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService, reloadBiOperationsService } from "@/bi-ops";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const { runId } = await ctx.params;
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? "200")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  let service = await getBiOperationsService();
  let run = service.getSyncRun(runId);
  if (!run) {
    // Cache miss may mean this warm instance never saw a write made by another
    // instance. Reload the snapshot from the DB once before giving up.
    service = await reloadBiOperationsService();
    run = service.getSyncRun(runId);
  }
  if (!run) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }

  const delta = service.listSyncDeltaItems(runId).slice(offset, offset + limit);
  return NextResponse.json(
    { run, delta, paging: { limit, offset } },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

import { NextResponse } from "next/server";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const { runId } = await ctx.params;
  const service = await getBiOperationsService();
  const run = service.getSyncRun(runId);
  if (!run) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }

  const delta = service.listSyncDeltaItems(runId);
  return NextResponse.json({ run, delta }, { status: 200 });
}

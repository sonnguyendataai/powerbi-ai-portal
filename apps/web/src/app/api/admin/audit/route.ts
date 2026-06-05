import { NextResponse } from "next/server";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const svc = await getBiOperationsService();
  const runs = svc.listSyncRuns().slice(0, 50);
  const events = runs.map((run) => ({
    id: run.id,
    actor: run.triggeredBy,
    action: `sync:${run.mode}`,
    status: run.status,
    at: run.startedAt,
    summary: run.summaryCounts,
  }));
  return NextResponse.json({ events }, { status: 200 });
}

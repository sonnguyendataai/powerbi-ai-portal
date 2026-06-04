import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";
import { runPowerBiContentSync } from "@/sync-engine";

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("full"),
    dryRun: z.boolean().optional(),
    triggeredBy: z.string().min(1).default("admin"),
  }),
  z.object({
    mode: z.literal("workspace"),
    workspaceId: z.string().min(1),
    dryRun: z.boolean().optional(),
    triggeredBy: z.string().min(1).default("admin"),
  }),
]);

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const service = await getBiOperationsService();
  return NextResponse.json({ runs: service.listSyncRuns().slice(0, 20) }, { status: 200 });
}

export async function POST(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const payload = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const service = await getBiOperationsService();
    const result = await runPowerBiContentSync(service, {
      mode: parsed.data.mode,
      triggeredBy: parsed.data.triggeredBy,
      ...(parsed.data.mode === "workspace" ? { workspaceId: parsed.data.workspaceId } : {}),
      ...(parsed.data.dryRun !== undefined ? { dryRun: parsed.data.dryRun } : {}),
    });
    return NextResponse.json(
      {
        runId: result.runId,
        summary: {
          added: result.delta.filter((item) => item.changeType === "added").length,
          updated: result.delta.filter((item) => item.changeType === "updated").length,
          removed: result.delta.filter((item) => item.changeType === "removed").length,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    return NextResponse.json({ error: "sync_failed", message }, { status: 500 });
  }
}

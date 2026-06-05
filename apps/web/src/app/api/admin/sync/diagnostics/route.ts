import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { diagnosePowerBiAccess } from "@/powerbi-content-client";

const querySchema = z.object({
  workspaceId: z.string().min(1).optional(),
  reportId: z.string().min(1).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    workspaceId: url.searchParams.get("workspaceId") ?? undefined,
    reportId: url.searchParams.get("reportId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const diagnostics = await diagnosePowerBiAccess({
      ...(parsed.data.workspaceId ? { workspaceId: parsed.data.workspaceId } : {}),
      ...(parsed.data.reportId ? { reportId: parsed.data.reportId } : {}),
    });
    return NextResponse.json(diagnostics, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "powerbi_diagnostics_failed" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

const ruleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  table: z.string().min(1),
  column: z.string().min(1),
  values: z.array(z.string().min(1)),
});

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const svc = await getBiOperationsService();
  return NextResponse.json({ rules: svc.listRules() });
}

export async function POST(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const payload = await req.json().catch(() => null);
  const parsed = ruleSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const svc = await getBiOperationsService();
  const rule = svc.upsertRule(parsed.data);
  return NextResponse.json({ rule }, { status: 200 });
}

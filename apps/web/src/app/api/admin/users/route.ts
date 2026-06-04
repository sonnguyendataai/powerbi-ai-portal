import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

const upsertUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  tenantId: z.string().min(1),
  roleIds: z.array(z.string().min(1)),
  customFields: z.record(z.string(), z.string()).default({}),
});

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const svc = await getBiOperationsService();
  return NextResponse.json({ users: svc.listUsers() });
}

export async function POST(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const payload = await req.json().catch(() => null);
  const parsed = upsertUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const svc = await getBiOperationsService();
  const user = svc.upsertUser(parsed.data);
  return NextResponse.json({ user }, { status: 200 });
}

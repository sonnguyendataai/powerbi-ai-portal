import { NextResponse } from "next/server";
import { z } from "zod";
import { getBiOperationsService } from "@/bi-ops";

const roleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isRequiredRule: z.boolean().default(false),
});

export async function GET(): Promise<Response> {
  const svc = getBiOperationsService();
  return NextResponse.json({ roles: svc.listRoles() });
}

export async function POST(req: Request): Promise<Response> {
  const payload = await req.json().catch(() => null);
  const parsed = roleSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const svc = getBiOperationsService();
  const role = svc.upsertRole(parsed.data);
  return NextResponse.json({ role }, { status: 200 });
}

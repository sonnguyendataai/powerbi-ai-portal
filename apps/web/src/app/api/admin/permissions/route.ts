import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

const permissionSchema = z.object({
  userId: z.string().min(1),
  reportId: z.string().min(1),
  pageId: z.string().min(1).optional(),
  ruleId: z.string().min(1).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId_required" }, { status: 400 });
  const svc = await getBiOperationsService();
  return NextResponse.json({ permissions: svc.getUserPermissions(userId), reports: svc.listReportsForUser(userId) });
}

export async function POST(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;
  const payload = await req.json().catch(() => null);
  const parsed = permissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const svc = await getBiOperationsService();
  const permission = svc.assignPermission({
    userId: parsed.data.userId,
    reportId: parsed.data.reportId,
    ...(parsed.data.pageId ? { pageId: parsed.data.pageId } : {}),
    ...(parsed.data.ruleId ? { ruleId: parsed.data.ruleId } : {}),
  });
  return NextResponse.json({ permission }, { status: 200 });
}

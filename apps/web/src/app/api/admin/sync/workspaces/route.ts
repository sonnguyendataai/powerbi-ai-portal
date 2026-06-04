import { NextResponse } from "next/server";
import { requireAdminApiKey } from "@/app/api/_lib/admin-auth";
import { getBiOperationsService } from "@/bi-ops";

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdminApiKey(req);
  if (denied) return denied;

  const service = await getBiOperationsService();
  return NextResponse.json({ workspaces: service.listWorkspaces() }, { status: 200 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { postDataPrep } from "@/api-data-prep";
import { resolveSessionUser } from "@/app/api/_lib/session";

const schema = z.object({
  datasetId: z.string().min(1),
  intent: z.string().min(1).max(2000),
  workspaceId: z.string().min(1).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
    }
    const plan = await postDataPrep(user, parsed.data);
    return NextResponse.json(plan, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "data_prep_error";
    const status = msg.includes("denied") || msg.includes("forbidden") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

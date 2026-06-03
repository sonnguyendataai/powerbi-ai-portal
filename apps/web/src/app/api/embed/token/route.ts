import { NextResponse } from "next/server";
import { z } from "zod";
import { postEmbedToken } from "@/api-embed";
import { resolveSessionUser } from "@/app/api/_lib/session";

const schema = z.object({
  reportId: z.string().min(1),
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  rlsRoles: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request): Promise<Response> {
  const user = resolveSessionUser(req);
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = await postEmbedToken(user, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "embed_token_error" },
      { status: 403 },
    );
  }
}

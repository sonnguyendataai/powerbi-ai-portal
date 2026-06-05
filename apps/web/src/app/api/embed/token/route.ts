import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/app/api/_lib/rate-limit";
import { postEmbedToken } from "@/api-embed";
import { resolveSessionUser } from "@/app/api/_lib/session";
import { loadEnv } from "@/env";

const schema = z.object({
  reportId: z.string().min(1),
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  rlsRoles: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    const env = loadEnv(process.env);
    const rate = await checkRateLimit(
      `embed:${user.tenantId}:${user.userId}`,
      env.EMBED_RATE_LIMIT_PER_MIN,
      60_000,
      env.DATABASE_URL,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds ?? 60 },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds ?? 60) } },
      );
    }
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
    }
    const result = await postEmbedToken(user, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "embed_token_error" },
      { status: 403 },
    );
  }
}

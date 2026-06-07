import { NextResponse } from "next/server";
import { z } from "zod";
import { postChat } from "@/api-chat";
import { checkRateLimit } from "@/app/api/_lib/rate-limit";
import { resolveSessionUser } from "@/app/api/_lib/session";
import { loadEnv } from "@/env";

const reportContextSchema = z.object({
  reportId: z.string().min(1),
  reportName: z.string().min(1),
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
});

const schema = z.object({
  message: z.string().min(1).max(4000),
  reportContext: reportContextSchema.optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    const env = loadEnv(process.env);
    const rate = await checkRateLimit(
      `chat:${user.tenantId}:${user.userId}`,
      env.CHAT_RATE_LIMIT_PER_MIN,
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
    const result = await postChat(user, parsed.data.message, parsed.data.reportContext);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "chat_error" },
      { status: 403 },
    );
  }
}

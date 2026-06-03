import { NextResponse } from "next/server";
import { z } from "zod";
import { postChat } from "@/api-chat";
import { resolveSessionUser } from "@/app/api/_lib/session";

const schema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(req: Request): Promise<Response> {
  const user = resolveSessionUser(req);
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = await postChat(user, parsed.data.message);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "chat_error" },
      { status: 403 },
    );
  }
}

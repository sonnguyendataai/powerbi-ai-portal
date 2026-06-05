import { NextResponse } from "next/server";
import { z } from "zod";
import { postChartPrompt } from "@/api-chart";
import { resolveSessionUser } from "@/app/api/_lib/session";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const user = resolveSessionUser(req);
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
    }
    const spec = postChartPrompt(user, parsed.data.prompt);
    return NextResponse.json(spec, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "chart_error" },
      { status: 403 },
    );
  }
}

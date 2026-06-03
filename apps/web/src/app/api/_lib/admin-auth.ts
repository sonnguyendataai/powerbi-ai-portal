import { loadEnv } from "@/env";
import { timingSafeEqual } from "node:crypto";

export function requireAdminApiKey(req: Request): Response | null {
  const env = loadEnv(process.env);
  const configuredKey = process.env.PORTAL_ADMIN_API_KEY ?? "";
  const provided = req.headers.get("x-admin-api-key") ?? "";

  if (env.APP_ENV === "prod" && !configuredKey) {
    return new Response(JSON.stringify({ error: "admin_api_key_not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (configuredKey && !safeCompare(provided, configuredKey)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

function safeCompare(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

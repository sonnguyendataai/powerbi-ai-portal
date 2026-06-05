import { loadEnv } from "@/env";
import { resolveSessionUser } from "@/app/api/_lib/session";

export function requireAdminApiKey(req: Request): Response | null {
  try {
    const user = resolveSessionUser(req);
    if (user.roles.includes("portal-admin")) {
      return null;
    }
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    const env = loadEnv(process.env);
    const error = env.APP_ENV === "prod" ? "authentication_required" : "forbidden";
    return new Response(JSON.stringify({ error }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
  POWERBI_TENANT_ID: z.string().min(1).optional(),
  POWERBI_CLIENT_ID: z.string().min(1).optional(),
  POWERBI_CLIENT_SECRET: z.string().min(1).optional(),
  POWERBI_API_BASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-3-5-sonnet-latest"),
  PORTAL_ADMIN_API_KEY: z.string().min(16).optional(),
  BI_OPS_STORE_FILE: z.string().min(1).default("./data/bi-ops.json"),
  DATABASE_URL: z.string().url().optional(),
  CHAT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  EMBED_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(40),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ");
    throw new Error(`Invalid env: ${msg}`);
  }
  if (parsed.data.APP_ENV === "prod") {
    const missing = [
      parsed.data.POWERBI_TENANT_ID ? null : "POWERBI_TENANT_ID",
      parsed.data.POWERBI_CLIENT_ID ? null : "POWERBI_CLIENT_ID",
      parsed.data.POWERBI_CLIENT_SECRET ? null : "POWERBI_CLIENT_SECRET",
      parsed.data.PORTAL_ADMIN_API_KEY ? null : "PORTAL_ADMIN_API_KEY",
      parsed.data.DATABASE_URL ? null : "DATABASE_URL",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Missing required prod env vars: ${missing.join(", ")}`);
    }
  }
  return parsed.data;
}

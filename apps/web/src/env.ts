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
  POSTGRES_URL: z.string().url().optional(),
  POSTGRES_URL_NON_POOLING: z.string().url().optional(),
  POSTGRES_HOST: z.string().min(1).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),
  POSTGRES_DATABASE: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SESSION_SIGNING_SECRET: z.string().min(24).optional(),
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
  const databaseUrl = resolveDatabaseUrl(parsed.data);
  const normalized: Env = {
    ...parsed.data,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  };

  if (normalized.APP_ENV === "prod") {
    const missing = [
      normalized.POWERBI_TENANT_ID ? null : "POWERBI_TENANT_ID",
      normalized.POWERBI_CLIENT_ID ? null : "POWERBI_CLIENT_ID",
      normalized.POWERBI_CLIENT_SECRET ? null : "POWERBI_CLIENT_SECRET",
      normalized.PORTAL_ADMIN_API_KEY ? null : "PORTAL_ADMIN_API_KEY",
      normalized.SESSION_SIGNING_SECRET ? null : "SESSION_SIGNING_SECRET",
      normalized.DATABASE_URL ? null : "DATABASE_URL|POSTGRES_URL|POSTGRES_URL_NON_POOLING",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Missing required prod env vars: ${missing.join(", ")}`);
    }
  }
  return normalized;
}

function resolveDatabaseUrl(env: z.infer<typeof schema>): string | undefined {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL_NON_POOLING) return env.POSTGRES_URL_NON_POOLING;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  if (env.POSTGRES_HOST && env.POSTGRES_USER && env.POSTGRES_PASSWORD && env.POSTGRES_DATABASE) {
    return `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${env.POSTGRES_HOST}/${encodeURIComponent(env.POSTGRES_DATABASE)}`;
  }
  return undefined;
}

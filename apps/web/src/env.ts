import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
  POWERBI_TENANT_ID: z.string().min(1),
  POWERBI_CLIENT_ID: z.string().min(1),
  POWERBI_CLIENT_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ");
    throw new Error(`Invalid env: ${msg}`);
  }
  return parsed.data;
}

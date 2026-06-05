import { NextResponse } from "next/server";
import { loadEnv } from "@/env";
import postgres from "postgres";

export async function GET(): Promise<Response> {
  try {
    const env = loadEnv(process.env);
    if (env.APP_ENV === "prod") {
      const missing = [
        env.POWERBI_TENANT_ID ? null : "POWERBI_TENANT_ID",
        env.POWERBI_CLIENT_ID ? null : "POWERBI_CLIENT_ID",
        env.POWERBI_CLIENT_SECRET ? null : "POWERBI_CLIENT_SECRET",
        env.SESSION_SIGNING_SECRET ? null : "SESSION_SIGNING_SECRET",
      ].filter(Boolean);
      if (missing.length > 0) {
        return NextResponse.json({ status: "not_ready", missing }, { status: 503 });
      }
    }
    if (env.DATABASE_URL) {
      const sql = postgres(env.DATABASE_URL, { max: 1 });
      try {
        await sql`select 1`;
      } finally {
        await sql.end({ timeout: 1 });
      }
    }
    return NextResponse.json({ status: "ready" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { status: "not_ready", error: error instanceof Error ? error.message : "env_validation_error" },
      { status: 503 },
    );
  }
}

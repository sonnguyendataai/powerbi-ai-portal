import { PolicyEngine, emitAudit } from "@portal/agent-core";
import type { SessionUser } from "./auth";
import { buildResource } from "./auth";
import { loadEnv } from "./env";
import { generateAnthropicAnswer } from "./llm-anthropic";
import { getBiOperationsService } from "./bi-ops";

export interface ChatAnswer {
  answer: string;
  evidence: string[];
  usedTools: string[];
}

// Fetch a service-principal OAuth token for the Power BI API
async function fetchPowerBiToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form },
  );
  if (!res.ok) throw new Error(`Power BI OAuth failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Power BI OAuth response missing access_token");
  return json.access_token;
}

interface PbiDataset { id: string; name: string; }
interface PbiReport { id: string; name: string; datasetId: string; }

async function fetchPowerBiContext(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<{ datasets: PbiDataset[]; reports: PbiReport[] }> {
  const token = await fetchPowerBiToken(tenantId, clientId, clientSecret);
  const headers = { Authorization: `Bearer ${token}` };

  const [dsRes, rpRes] = await Promise.all([
    fetch("https://api.powerbi.com/v1.0/myorg/datasets", { headers }),
    fetch("https://api.powerbi.com/v1.0/myorg/reports", { headers }),
  ]);

  const datasets: PbiDataset[] = dsRes.ok
    ? ((await dsRes.json()) as { value: PbiDataset[] }).value ?? []
    : [];
  const reports: PbiReport[] = rpRes.ok
    ? ((await rpRes.json()) as { value: PbiReport[] }).value ?? []
    : [];

  return { datasets, reports };
}

export async function answerDataQuestion(user: SessionUser, question: string): Promise<ChatAnswer> {
  const env = loadEnv(process.env);

  const policy = new PolicyEngine();
  const resource = buildResource(user.tenantId, "semantic-model", "default");
  const decision = policy.evaluate({
    subject: {
      userId: user.userId,
      tenantId: user.tenantId,
      roles: user.roles,
      ...(user.region ? { region: user.region } : {}),
    },
    action: "read_data",
    resource,
  });
  if (!decision.allowed) throw new Error(decision.reason ?? "permission denied");

  const usedTools: string[] = [];
  const evidence: string[] = [];

  // Tool 1: list synced reports from the portal store
  const svc = await getBiOperationsService();
  const syncedReports = svc.listReports().filter((r) => !r.isDeleted);
  usedTools.push("list_synced_reports");
  evidence.push(
    `Portal store: ${syncedReports.length} synced report(s): ${syncedReports.map((r) => r.displayName).slice(0, 10).join(", ")}`,
  );

  // Tool 2: live Power BI API context (datasets + reports from the tenant)
  let pbiContext: { datasets: PbiDataset[]; reports: PbiReport[] } | null = null;
  if (env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET) {
    try {
      pbiContext = await fetchPowerBiContext(
        env.POWERBI_TENANT_ID,
        env.POWERBI_CLIENT_ID,
        env.POWERBI_CLIENT_SECRET,
      );
      usedTools.push("list_datasets", "list_reports");
      evidence.push(
        `Power BI tenant: ${pbiContext.datasets.length} dataset(s): ${pbiContext.datasets.map((d) => d.name).slice(0, 10).join(", ")}`,
      );
      evidence.push(
        `Power BI tenant: ${pbiContext.reports.length} report(s): ${pbiContext.reports.map((r) => r.name).slice(0, 10).join(", ")}`,
      );
    } catch (err) {
      evidence.push(`Power BI API unavailable: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  } else {
    evidence.push("Power BI credentials not configured — using portal store only.");
  }

  emitAudit({
    kind: "agent.query",
    userId: user.userId,
    tenantId: user.tenantId,
    metadata: { questionLength: question.length, tools: usedTools },
  });

  let answer = `I found ${syncedReports.length} synced report(s) in the portal.`;

  if (env.ANTHROPIC_API_KEY) {
    try {
      answer = await generateAnthropicAnswer({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL,
        tenantId: user.tenantId,
        question,
        intent: "lookup",
        evidence,
      });
    } catch (err) {
      emitAudit({
        kind: "agent.query.llm_error",
        userId: user.userId,
        tenantId: user.tenantId,
        metadata: { message: err instanceof Error ? err.message : "anthropic_error" },
      });
    }
  }

  return { answer, evidence, usedTools };
}

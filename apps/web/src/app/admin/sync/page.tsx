"use client";

import { useEffect, useMemo, useState } from "react";

interface SyncRun {
  id: string;
  mode: "full" | "workspace";
  workspaceId?: string;
  status: "running" | "succeeded" | "failed";
  summaryCounts: { added: number; updated: number; removed: number };
}

interface SyncDeltaItem {
  runId: string;
  entityType: "workspace" | "dataset" | "report" | "page";
  entityId: string;
  changeType: "added" | "updated" | "removed";
}

interface Workspace {
  id: string;
  displayName: string;
}

export default function AdminSyncPage() {
  const [adminKey, setAdminKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [delta, setDelta] = useState<SyncDeltaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId), [runs, selectedRunId]);

  async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-api-key": adminKey } : {}),
      },
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(typeof json.message === "string" ? json.message : "Request failed");
    }
    return json as T;
  }

  async function reload(): Promise<void> {
    const [runRes, workspaceRes] = await Promise.all([
      callApi<{ runs: SyncRun[] }>("/api/admin/sync/runs"),
      callApi<{ workspaces: Workspace[] }>("/api/admin/sync/workspaces"),
    ]);
    setRuns(runRes.runs);
    setWorkspaces(workspaceRes.workspaces);
  }

  async function triggerSync(mode: "full" | "workspace"): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await callApi<{ runId: string }>("/api/admin/sync", {
        method: "POST",
        body: JSON.stringify(
          mode === "full"
            ? { mode: "full", triggeredBy: "admin-ui" }
            : { mode: "workspace", workspaceId, triggeredBy: "admin-ui" },
        ),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function showRun(runId: string): Promise<void> {
    setSelectedRunId(runId);
    try {
      const details = await callApi<{ delta: SyncDeltaItem[] }>(`/api/admin/sync/runs/${runId}`);
      setDelta(details.delta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run detail");
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1>Admin Sync Center</h1>
      <p>Sync Power BI content and inspect run-level delta history.</p>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin API key" />
        <button disabled={busy} onClick={() => void triggerSync("full")} style={{ marginLeft: 8 }}>Sync All</button>
        <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="">Select workspace</option>
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.displayName}</option>)}
        </select>
        <button disabled={busy || !workspaceId} onClick={() => void triggerSync("workspace")} style={{ marginLeft: 8 }}>
          Sync Workspace
        </button>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2>Run History</h2>
          {runs.map((run) => (
            <div key={run.id} onClick={() => void showRun(run.id)} style={{ cursor: "pointer", padding: "6px 0" }}>
              {run.id} - {run.mode} - {run.status} ({run.summaryCounts.added}/{run.summaryCounts.updated}/{run.summaryCounts.removed})
            </div>
          ))}
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2>Delta Detail</h2>
          <p>{selectedRun ? `Run ${selectedRun.id}` : "Choose a run."}</p>
          {delta.map((item) => (
            <div key={`${item.runId}-${item.entityType}-${item.entityId}`}>
              {item.changeType} {item.entityType} {item.entityId}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

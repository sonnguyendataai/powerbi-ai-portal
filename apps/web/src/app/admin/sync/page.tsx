"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

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
  }, []);

  return (
    <section>
      <PageHeader
        eyebrow="Operations"
        title="Power BI Sync Center"
        description="Sync Power BI workspaces, monitor run status, and inspect added, updated, or removed content."
        actions={<button disabled={busy} onClick={() => void triggerSync("full")}>{busy ? "Running..." : "Sync all"}</button>}
      />
      <Surface>
        <div className="grid-2">
          <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.displayName}</option>)}
          </select>
          <button className="secondary" disabled={busy || !workspaceId} onClick={() => void triggerSync("workspace")}>
            Sync selected workspace
          </button>
        </div>
        {error ? <Alert>{error}</Alert> : null}
      </Surface>
      <div className="grid-2" style={{ marginTop: 18 }}>
        <Surface title="Run history">
          {runs.length === 0 ? <EmptyState title="No sync runs yet" description="Run a sync to start tracking Power BI content changes." /> : null}
          <table className="table">
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} onClick={() => void showRun(run.id)} style={{ cursor: "pointer" }}>
                  <td><span className="badge">{run.status}</span></td>
                  <td>{run.mode}</td>
                  <td>{run.summaryCounts.added}/{run.summaryCounts.updated}/{run.summaryCounts.removed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
        <Surface title="Delta detail">
          <p className="muted">{selectedRun ? `Run ${selectedRun.id}` : "Choose a run to inspect delta detail."}</p>
          {delta.length === 0 ? <EmptyState title="No delta selected" description="Select a sync run to review changed content." /> : null}
          <div className="stack">
            {delta.map((item) => (
              <div className="card" key={`${item.runId}-${item.entityType}-${item.entityId}`}>
                <span className="badge">{item.changeType}</span> {item.entityType} <code>{item.entityId}</code>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </section>
  );
}

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
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [error, setError] = useState("");

  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId), [runs, selectedRunId]);

  async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) as Record<string, unknown> : {};
    if (!res.ok) {
      throw new Error(typeof json.message === "string" ? json.message : typeof json.error === "string" ? json.error : "Request failed");
    }
    return json as T;
  }

  async function reload(): Promise<void> {
    setError("");
    await Promise.allSettled([loadRuns(), loadWorkspaces()]);
  }

  async function loadRuns(): Promise<void> {
    setLoadingRuns(true);
    try {
      const runRes = await callApi<{ runs: SyncRun[] }>("/api/admin/sync/runs?limit=100");
      setRuns(runRes.runs);
      const nextRunId = runRes.runs[0]?.id ?? "";
      setSelectedRunId((current) => current || nextRunId);
      if (nextRunId && !selectedRunId) {
        await showRun(nextRunId);
      }
    } catch (err) {
      setError(err instanceof Error ? `Cannot load sync history: ${err.message}` : "Cannot load sync history");
    } finally {
      setLoadingRuns(false);
    }
  }

  async function loadWorkspaces(): Promise<void> {
    setLoadingWorkspaces(true);
    try {
      const workspaceRes = await callApi<{ workspaces: Workspace[] }>("/api/admin/sync/workspaces");
      setWorkspaces(workspaceRes.workspaces);
    } catch (err) {
      setError((current) => current || (err instanceof Error ? `Cannot load workspaces: ${err.message}` : "Cannot load workspaces"));
    } finally {
      setLoadingWorkspaces(false);
    }
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
    setDelta([]);
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
            <option value="">{loadingWorkspaces ? "Loading workspaces..." : "Select workspace"}</option>
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
          {loadingRuns ? <div className="empty-state">Loading sync history...</div> : null}
          {!loadingRuns && runs.length === 0 ? <EmptyState title="No sync runs yet" description="Run a sync to start tracking Power BI content changes." /> : null}
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

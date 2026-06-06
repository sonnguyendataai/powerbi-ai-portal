import { buildSyncDeltaItem, type BiOperationsService, type SyncDeltaItem, type SyncRequest } from "@portal/bi-operations";
import { fetchPowerBiContent, hashContent } from "./powerbi-content-client";

type ScopeInput = Pick<SyncRequest, "mode" | "workspaceId">;

export async function runPowerBiContentSync(
  service: BiOperationsService,
  request: SyncRequest & { dryRun?: boolean },
): Promise<{ runId: string; delta: SyncDeltaItem[] }> {
  const run = service.startSyncRun({
    mode: request.mode,
    ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
    dryRun: request.dryRun ?? false,
    triggeredBy: request.triggeredBy,
  });

  try {
    const snapshot = await fetchPowerBiContent(request.mode, request.workspaceId);
    const delta = buildDelta(service, snapshot, {
      mode: request.mode,
      ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
    });
    const runDelta = delta.map((item) => ({ ...item, runId: run.id }));

    if (!(request.dryRun ?? false)) {
      applyRemoteSnapshot(service, snapshot, {
        mode: request.mode,
        ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
      });
      applySoftDeletes(service, runDelta);
    }

    service.appendSyncDeltaItems(run.id, runDelta);
    service.finishSyncRun(run.id, { status: "succeeded" });
    return { runId: run.id, delta: runDelta };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    service.finishSyncRun(run.id, { status: "failed", error: message });
    throw error;
  }
}

function buildDelta(
  service: BiOperationsService,
  remote: Awaited<ReturnType<typeof fetchPowerBiContent>>,
  scope: ScopeInput,
): SyncDeltaItem[] {
  const now = new Date().toISOString();
  const delta: SyncDeltaItem[] = [];

  const remoteWorkspaces = new Map(remote.map((workspace) => [workspace.workspaceId, workspace]));
  const existingWorkspaces = service
    .listWorkspaces()
    .filter((workspace) => isInScope(scope, workspace.id))
    .map((workspace) => ({
      id: workspace.id,
      workspaceId: workspace.id,
      hash: workspace.contentHash ?? "",
      isDeleted: workspace.isDeleted,
      metadata: { name: workspace.name },
    }));
  const existingWorkspacesMap = new Map(existingWorkspaces.map((w) => [w.id, w]));

  for (const workspace of remote) {
    const afterHash = hashContent({ id: workspace.workspaceId, name: workspace.workspaceName });
    const current = existingWorkspacesMap.get(workspace.workspaceId);
    if (!current) {
      delta.push(
        buildSyncDeltaItem({
          runId: "",
          entityType: "workspace",
          entityId: workspace.workspaceId,
          workspaceId: workspace.workspaceId,
          changeType: "added",
          afterHash,
          metadata: { name: workspace.workspaceName, seenAt: now },
        }),
      );
      continue;
    }
    if (current.hash !== afterHash || current.isDeleted) {
      delta.push(
        buildSyncDeltaItem({
          runId: "",
          entityType: "workspace",
          entityId: workspace.workspaceId,
          workspaceId: workspace.workspaceId,
          changeType: "updated",
          beforeHash: current.hash,
          afterHash,
          metadata: { name: workspace.workspaceName, seenAt: now },
        }),
      );
    }
  }
  for (const current of existingWorkspaces) {
    if (!remoteWorkspaces.has(current.id) && !current.isDeleted) {
      delta.push(
        buildSyncDeltaItem({
          runId: "",
          entityType: "workspace",
          entityId: current.id,
          workspaceId: current.workspaceId,
          changeType: "removed",
          beforeHash: current.hash,
          metadata: { name: current.metadata.name, seenAt: now },
        }),
      );
    }
  }

  const remoteDatasets = flatten(remote, "datasets");
  const existingDatasets = service.listDatasets().filter((dataset) => isInScope(scope, dataset.workspaceId));
  compareScoped(
    delta,
    "dataset",
    remoteDatasets,
    existingDatasets.map((dataset) => ({
      id: dataset.id,
      workspaceId: dataset.workspaceId,
      hash: dataset.contentHash ?? "",
      isDeleted: dataset.isDeleted,
      metadata: { name: dataset.name },
    })),
    (item) => item.id,
    (item) => item.workspaceId,
    (item) => hashContent(item),
    (item) => ({ name: item.name, seenAt: now }),
  );

  const remoteReports = flatten(remote, "reports");
  const existingReports = service.listReports().filter((report) => isInScope(scope, report.workspaceId));
  compareScoped(
    delta,
    "report",
    remoteReports,
    existingReports.map((report) => ({
      id: report.id,
      workspaceId: report.workspaceId,
      hash: report.contentHash ?? "",
      isDeleted: report.isDeleted,
      metadata: { name: report.name },
    })),
    (item) => item.id,
    (item) => item.workspaceId,
    (item) => hashContent(item),
    (item) => ({ name: item.name, seenAt: now }),
  );

  const remotePages = remote.flatMap((workspace) =>
    Object.entries(workspace.pagesByReportId).flatMap(([reportId, pages]) =>
      pages.map((page) => ({
        id: page.id,
        reportId,
        workspaceId: workspace.workspaceId,
        name: page.name,
        displayName: page.displayName,
      })),
    ),
  );
  const reportsById = new Map(service.listReports().map((r) => [r.id, r]));
  const existingPages = service.listPages().flatMap((page) => {
    const report = reportsById.get(page.reportId);
    if (!report || !isInScope(scope, report.workspaceId)) return [];
    return [
      {
        id: page.id,
        workspaceId: report.workspaceId,
        hash: page.contentHash ?? "",
        isDeleted: page.isDeleted,
        metadata: { name: page.name },
      },
    ];
  });
  compareScoped(
    delta,
    "page",
    remotePages,
    existingPages,
    (item) => item.id,
    (item) => item.workspaceId,
    (item) => hashContent(item),
    (item) => ({ name: item.name, seenAt: now }),
  );

  return delta;
}

function compareScoped<TIncoming extends { id: string }, TExisting extends { id: string; hash: string; isDeleted: boolean }>(
  delta: SyncDeltaItem[],
  entityType: SyncDeltaItem["entityType"],
  incoming: TIncoming[],
  existing: TExisting[],
  getId: (item: TIncoming) => string,
  getWorkspaceId: (item: TIncoming) => string,
  toHash: (item: TIncoming) => string,
  toMetadata: (item: TIncoming) => Record<string, string>,
): void {
  const incomingMap = new Map(incoming.map((item) => [getId(item), item]));
  const existingMap = new Map(existing.map((entry) => [entry.id, entry]));
  for (const item of incoming) {
    const id = getId(item);
    const current = existingMap.get(id);
    const hash = toHash(item);
    if (!current) {
      delta.push(
        buildSyncDeltaItem({
          runId: "",
          entityType,
          entityId: id,
          workspaceId: getWorkspaceId(item),
          changeType: "added",
          afterHash: hash,
          metadata: toMetadata(item),
        }),
      );
      continue;
    }
    if (current.hash !== hash || current.isDeleted) {
      delta.push(
        buildSyncDeltaItem({
          runId: "",
          entityType,
          entityId: id,
          workspaceId: getWorkspaceId(item),
          changeType: "updated",
          beforeHash: current.hash,
          afterHash: hash,
          metadata: toMetadata(item),
        }),
      );
    }
  }
  for (const current of existing) {
    if (!incomingMap.has(current.id) && !current.isDeleted) {
      delta.push(
        buildSyncDeltaItem({
          runId: "",
          entityType,
          entityId: current.id,
          changeType: "removed",
          beforeHash: current.hash,
          metadata: { removed: "true" },
        }),
      );
    }
  }
}

function applyRemoteSnapshot(
  service: BiOperationsService,
  remote: Awaited<ReturnType<typeof fetchPowerBiContent>>,
  scope: ScopeInput,
): void {
  const seenAt = new Date().toISOString();
  for (const workspace of remote) {
    if (!isInScope(scope, workspace.workspaceId)) continue;
    service.upsertWorkspace({
      id: workspace.workspaceId,
      name: workspace.workspaceName,
      displayName: workspace.workspaceName,
      sourceBiId: workspace.workspaceId,
      lastSeenAt: seenAt,
      isDeleted: false,
      contentHash: hashContent({ id: workspace.workspaceId, name: workspace.workspaceName }),
    });

    for (const dataset of workspace.datasets) {
      service.upsertDataset({
        id: dataset.id,
        workspaceId: workspace.workspaceId,
        name: dataset.name,
        sourceBiId: dataset.id,
        lastSeenAt: seenAt,
        isDeleted: false,
        contentHash: hashContent(dataset),
      });
    }

    for (const report of workspace.reports) {
      const pageIds = (workspace.pagesByReportId[report.id] ?? []).map((page) => page.id);
      service.upsertReport({
        id: report.id,
        workspaceId: workspace.workspaceId,
        datasetId: report.datasetId ?? "unknown-dataset",
        name: report.name,
        displayName: report.name,
        embedUrl: report.embedUrl,
        pageIds,
        sourceBiId: report.id,
        lastSeenAt: seenAt,
        isDeleted: false,
        contentHash: hashContent({ report, pageIds }),
      });
      for (const page of workspace.pagesByReportId[report.id] ?? []) {
        service.upsertPage({
          id: page.id,
          reportId: report.id,
          name: page.name,
          displayName: page.displayName,
          sourceBiId: page.id,
          lastSeenAt: seenAt,
          isDeleted: false,
          contentHash: hashContent(page),
        });
      }
    }
  }
}

function applySoftDeletes(service: BiOperationsService, delta: SyncDeltaItem[]): void {
  const removed = delta.filter((item) => item.changeType === "removed");
  if (removed.length === 0) return;
  const markedAt = new Date().toISOString();

  const workspacesById = new Map(service.listWorkspaces().map((w) => [w.id, w]));
  const datasetsById = new Map(service.listDatasets().map((d) => [d.id, d]));
  const reportsById = new Map(service.listReports().map((r) => [r.id, r]));
  const pagesById = new Map(service.listPages().map((p) => [p.id, p]));

  for (const item of removed) {
    if (item.entityType === "workspace") {
      const workspace = workspacesById.get(item.entityId);
      if (workspace) service.upsertWorkspace({ ...workspace, isDeleted: true, lastSeenAt: markedAt });
      continue;
    }
    if (item.entityType === "dataset") {
      const dataset = datasetsById.get(item.entityId);
      if (dataset) service.upsertDataset({ ...dataset, isDeleted: true, lastSeenAt: markedAt });
      continue;
    }
    if (item.entityType === "report") {
      const report = reportsById.get(item.entityId);
      if (report) service.upsertReport({ ...report, isDeleted: true, lastSeenAt: markedAt });
      continue;
    }
    if (item.entityType === "page") {
      const page = pagesById.get(item.entityId);
      if (page) service.upsertPage({ ...page, isDeleted: true, lastSeenAt: markedAt });
    }
  }
}

function flatten(
  workspaces: Awaited<ReturnType<typeof fetchPowerBiContent>>,
  key: "datasets" | "reports",
): Array<{ workspaceId: string; id: string; name: string; embedUrl?: string; datasetId?: string }> {
  if (key === "datasets") {
    return workspaces.flatMap((workspace) =>
      workspace.datasets.map((dataset) => ({
        workspaceId: workspace.workspaceId,
        id: dataset.id,
        name: dataset.name,
      })),
    );
  }

  return workspaces.flatMap((workspace) =>
    workspace.reports.map((report) => ({
      workspaceId: workspace.workspaceId,
      id: report.id,
      name: report.name,
      embedUrl: report.embedUrl,
      ...(report.datasetId ? { datasetId: report.datasetId } : {}),
    })),
  );
}

function isInScope(scope: ScopeInput, workspaceId: string): boolean {
  if (scope.mode === "full") return true;
  return scope.workspaceId === workspaceId;
}

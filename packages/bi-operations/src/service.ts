import {
  biDatasetSchema,
  biPageSchema,
  biReportSchema,
  biRoleSchema,
  biRuleSchema,
  biUserSchema,
  biWorkspaceSchema,
  type BiDataset,
  type BiPage,
  type BiReport,
  type BiRole,
  type BiRule,
  type BiUser,
  type BiWorkspace,
  type SyncChangeType,
  type SyncDeltaItem,
  type SyncEntityType,
  type SyncRun,
  type SyncScopeMode,
  type SyncSummaryCounts,
  type UserExportRecord,
  type UserPermission,
} from "./types";
import { createBiOpsStore, toSnapshot, type BiOpsStore, type BiOpsStoreSnapshot } from "./store";

interface BiOperationsOptions {
  onMutate?: (snapshot: BiOpsStoreSnapshot) => void;
}

export class BiOperationsService {
  constructor(
    private readonly store: BiOpsStore = createBiOpsStore(),
    private readonly options: BiOperationsOptions = {},
  ) {}

  listUsers(): BiUser[] {
    return [...this.store.users.values()];
  }

  upsertUser(user: BiUser): BiUser {
    const parsed = biUserSchema.parse(user);
    this.store.users.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  listRoles(): BiRole[] {
    return [...this.store.roles.values()];
  }

  upsertRole(role: BiRole): BiRole {
    const parsed = biRoleSchema.parse(role);
    this.store.roles.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  listReportsForUser(userId: string): BiReport[] {
    const directReportIds = this.store.permissions
      .filter((perm) => perm.userId === userId)
      .map((perm) => perm.reportId);
    if (directReportIds.length === 0) return [...this.store.reports.values()];
    return directReportIds
      .map((id) => this.store.reports.get(id))
      .filter((report): report is BiReport => !!report);
  }

  listReports(): BiReport[] {
    return [...this.store.reports.values()];
  }

  listPages(): BiPage[] {
    return [...this.store.pages.values()];
  }

  listDatasets(): BiDataset[] {
    return [...this.store.datasets.values()];
  }

  upsertReport(report: BiReport): BiReport {
    const parsed = biReportSchema.parse(report);
    this.store.reports.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  upsertPage(page: BiPage): BiPage {
    const parsed = biPageSchema.parse(page);
    this.store.pages.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  upsertRule(rule: BiRule): BiRule {
    const parsed = biRuleSchema.parse(rule);
    this.store.rules.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  upsertDataset(dataset: BiDataset): BiDataset {
    const parsed = biDatasetSchema.parse(dataset);
    this.store.datasets.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  listSyncRuns(): SyncRun[] {
    return [...this.store.syncRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  listWorkspaces(): BiWorkspace[] {
    return [...this.store.workspaces.values()].filter((workspace) => !workspace.isDeleted);
  }

  upsertWorkspace(workspace: BiWorkspace): BiWorkspace {
    const parsed = biWorkspaceSchema.parse(workspace);
    this.store.workspaces.set(parsed.id, parsed);
    this.persist();
    return parsed;
  }

  getSyncRun(runId: string): SyncRun | undefined {
    return this.store.syncRuns.find((run) => run.id === runId);
  }

  listSyncDeltaItems(runId: string): SyncDeltaItem[] {
    return this.store.syncDeltaItems.filter((item) => item.runId === runId);
  }

  startSyncRun(input: {
    mode: SyncScopeMode;
    workspaceId?: string | undefined;
    dryRun: boolean;
    triggeredBy: string;
  }): SyncRun {
    const run: SyncRun = {
      id: createSyncRunId(),
      mode: input.mode,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      dryRun: input.dryRun,
      status: "running",
      startedAt: new Date().toISOString(),
      triggeredBy: input.triggeredBy,
      summaryCounts: { added: 0, updated: 0, removed: 0 },
    };
    this.store.syncRuns.push(run);
    this.persist();
    return run;
  }

  appendSyncDeltaItems(runId: string, items: SyncDeltaItem[]): SyncSummaryCounts {
    this.store.syncDeltaItems = this.store.syncDeltaItems.filter((item) => item.runId !== runId);
    this.store.syncDeltaItems.push(...items);
    const summary = summarizeDelta(items);
    const run = this.store.syncRuns.find((entry) => entry.id === runId);
    if (run) {
      run.summaryCounts = summary;
    }
    this.persist();
    return summary;
  }

  finishSyncRun(runId: string, input: { status: "succeeded" | "failed"; error?: string }): SyncRun | undefined {
    const run = this.store.syncRuns.find((entry) => entry.id === runId);
    if (!run) return undefined;
    run.status = input.status;
    run.finishedAt = new Date().toISOString();
    if (input.error) run.error = input.error;
    this.persist();
    return run;
  }

  assignPermission(permission: UserPermission): UserPermission {
    this.store.permissions = this.store.permissions.filter(
      (perm) =>
        !(
          perm.userId === permission.userId &&
          perm.reportId === permission.reportId &&
          perm.pageId === permission.pageId &&
          perm.ruleId === permission.ruleId
        ),
    );
    this.store.permissions.push(permission);
    this.persist();
    return permission;
  }

  getUserPermissions(userId: string): UserPermission[] {
    return this.store.permissions.filter((perm) => perm.userId === userId);
  }

  toggleFavorite(userId: string, reportId: string): { reportId: string; isFavorite: boolean } {
    const idx = this.store.favorites.findIndex((fav) => fav.userId === userId && fav.reportId === reportId);
    if (idx >= 0) {
      this.store.favorites.splice(idx, 1);
      this.persist();
      return { reportId, isFavorite: false };
    }
    this.store.favorites.push({ userId, reportId });
    this.persist();
    return { reportId, isFavorite: true };
  }

  exportUsers(): UserExportRecord[] {
    return [...this.store.users.values()].map((user) => {
      const roleNames = user.roleIds
        .map((roleId) => this.store.roles.get(roleId)?.name)
        .filter((name): name is string => !!name);
      const reportNames = this.listReportsForUser(user.id).map((report) => report.displayName);
      return {
        email: user.email,
        roleNames,
        reportNames,
        customFields: user.customFields,
      };
    });
  }

  private persist(): void {
    this.options.onMutate?.(toSnapshot(this.store));
  }
}

function summarizeDelta(items: SyncDeltaItem[]): SyncSummaryCounts {
  const summary: SyncSummaryCounts = { added: 0, updated: 0, removed: 0 };
  for (const item of items) {
    if (item.changeType === "added") summary.added += 1;
    else if (item.changeType === "updated") summary.updated += 1;
    else if (item.changeType === "removed") summary.removed += 1;
  }
  return summary;
}

export function buildSyncDeltaItem(input: {
  runId: string;
  entityType: SyncEntityType;
  entityId: string;
  workspaceId?: string;
  changeType: SyncChangeType;
  beforeHash?: string | undefined;
  afterHash?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}): SyncDeltaItem {
  return {
    runId: input.runId,
    entityType: input.entityType,
    entityId: input.entityId,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    changeType: input.changeType,
    ...(input.beforeHash ? { beforeHash: input.beforeHash } : {}),
    ...(input.afterHash ? { afterHash: input.afterHash } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

function createSyncRunId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

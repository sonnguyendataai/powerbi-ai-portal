import { z } from "zod";

export const biRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isRequiredRule: z.boolean().default(false),
});
export type BiRole = z.infer<typeof biRoleSchema>;

export const biRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  table: z.string().min(1),
  column: z.string().min(1),
  values: z.array(z.string().min(1)),
});
export type BiRule = z.infer<typeof biRuleSchema>;

export const biPageSchema = z.object({
  id: z.string().min(1),
  reportId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  sourceBiId: z.string().min(1).optional(),
  sourceUpdatedAt: z.string().min(1).optional(),
  lastSeenAt: z.string().min(1).optional(),
  isDeleted: z.boolean().default(false),
  contentHash: z.string().min(1).optional(),
});
export type BiPage = z.infer<typeof biPageSchema>;

export const biReportSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  embedUrl: z.string().url().or(z.string().startsWith("https://")),
  pageIds: z.array(z.string().min(1)),
  sourceBiId: z.string().min(1).optional(),
  sourceUpdatedAt: z.string().min(1).optional(),
  lastSeenAt: z.string().min(1).optional(),
  isDeleted: z.boolean().default(false),
  contentHash: z.string().min(1).optional(),
});
export type BiReport = z.infer<typeof biReportSchema>;

export const biDatasetSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  sourceBiId: z.string().min(1),
  sourceUpdatedAt: z.string().min(1).optional(),
  lastSeenAt: z.string().min(1).optional(),
  isDeleted: z.boolean().default(false),
  contentHash: z.string().min(1).optional(),
});
export type BiDataset = z.infer<typeof biDatasetSchema>;

export const biWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  sourceBiId: z.string().min(1),
  sourceUpdatedAt: z.string().min(1).optional(),
  lastSeenAt: z.string().min(1).optional(),
  isDeleted: z.boolean().default(false),
  contentHash: z.string().min(1).optional(),
});
export type BiWorkspace = z.infer<typeof biWorkspaceSchema>;

export const biUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  tenantId: z.string().min(1),
  roleIds: z.array(z.string().min(1)),
  customFields: z.record(z.string(), z.string()).default({}),
});
export type BiUser = z.infer<typeof biUserSchema>;

export interface UserPermission {
  userId: string;
  reportId: string;
  pageId?: string;
  ruleId?: string;
}

export interface FavoriteReport {
  userId: string;
  reportId: string;
}

export interface UserExportRecord {
  email: string;
  roleNames: string[];
  reportNames: string[];
  customFields: Record<string, string>;
}

export type SyncScopeMode = "full" | "workspace";
export type SyncStatus = "running" | "succeeded" | "failed";
export type SyncEntityType = "workspace" | "dataset" | "report" | "page";
export type SyncChangeType = "added" | "updated" | "removed";

export interface SyncSummaryCounts {
  added: number;
  updated: number;
  removed: number;
}

export interface SyncRun {
  id: string;
  mode: SyncScopeMode;
  workspaceId?: string | undefined;
  dryRun: boolean;
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string | undefined;
  triggeredBy: string;
  error?: string | undefined;
  summaryCounts: SyncSummaryCounts;
}

export interface SyncDeltaItem {
  runId: string;
  entityType: SyncEntityType;
  entityId: string;
  workspaceId?: string | undefined;
  changeType: SyncChangeType;
  beforeHash?: string | undefined;
  afterHash?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface SyncRequest {
  mode: SyncScopeMode;
  workspaceId?: string | undefined;
  dryRun?: boolean | undefined;
  triggeredBy: string;
}

import type {
  BiDataset,
  BiPage,
  BiReport,
  BiRole,
  BiRule,
  BiUser,
  BiWorkspace,
  FavoriteReport,
  SyncDeltaItem,
  SyncRun,
  UserPermission,
} from "./types";

export interface BiOpsStore {
  users: Map<string, BiUser>;
  roles: Map<string, BiRole>;
  rules: Map<string, BiRule>;
  reports: Map<string, BiReport>;
  pages: Map<string, BiPage>;
  datasets: Map<string, BiDataset>;
  workspaces: Map<string, BiWorkspace>;
  permissions: UserPermission[];
  favorites: FavoriteReport[];
  syncRuns: SyncRun[];
  syncDeltaItems: SyncDeltaItem[];
}

export interface BiOpsStoreSnapshot {
  users: BiUser[];
  roles: BiRole[];
  rules: BiRule[];
  reports: BiReport[];
  pages: BiPage[];
  datasets: BiDataset[];
  workspaces: BiWorkspace[];
  permissions: UserPermission[];
  favorites: FavoriteReport[];
  syncRuns: SyncRun[];
  syncDeltaItems: SyncDeltaItem[];
}

export function createBiOpsStore(seed?: Partial<BiOpsStoreSnapshot>): BiOpsStore {
  const roles = new Map<string, BiRole>([
    ["role-admin", { id: "role-admin", name: "Admin", isRequiredRule: false }],
    ["role-member", { id: "role-member", name: "Member", isRequiredRule: false }],
    ["role-analyst", { id: "role-analyst", name: "Analyst", isRequiredRule: true }],
  ]);
  const reports = new Map<string, BiReport>([
    [
      "report-sales",
      {
        id: "report-sales",
        workspaceId: "ws-main",
        datasetId: "ds-sales",
        name: "Sales Overview",
        displayName: "Sales Overview",
        embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-sales",
        pageIds: ["page-sales-main"],
        isDeleted: false,
      },
    ],
  ]);
  const pages = new Map<string, BiPage>([
    [
      "page-sales-main",
      {
        id: "page-sales-main",
        reportId: "report-sales",
        name: "Main",
        displayName: "Main",
        isDeleted: false,
      },
    ],
  ]);
  const datasets = new Map<string, BiDataset>([
    [
      "dataset-sales",
      {
        id: "dataset-sales",
        workspaceId: "ws-main",
        name: "Sales Model",
        sourceBiId: "dataset-sales",
        isDeleted: false,
      },
    ],
  ]);
  const workspaces = new Map<string, BiWorkspace>([
    [
      "ws-main",
      {
        id: "ws-main",
        name: "Main Workspace",
        displayName: "Main Workspace",
        sourceBiId: "ws-main",
        isDeleted: false,
      },
    ],
  ]);
  const rules = new Map<string, BiRule>([
    [
      "rule-region-apac",
      { id: "rule-region-apac", name: "Region APAC", table: "Sales", column: "Region", values: ["APAC"] },
    ],
  ]);
  const users = new Map<string, BiUser>([
    [
      "user-admin",
      {
        id: "user-admin",
        email: "admin@datamind.local",
        tenantId: "tenant-default",
        roleIds: ["role-admin"],
        customFields: { department: "BI" },
      },
    ],
  ]);

  if (seed?.roles) {
    for (const role of seed.roles) roles.set(role.id, role);
  }
  if (seed?.reports) {
    for (const report of seed.reports) reports.set(report.id, report);
  }
  if (seed?.pages) {
    for (const page of seed.pages) pages.set(page.id, page);
  }
  if (seed?.datasets) {
    for (const dataset of seed.datasets) datasets.set(dataset.id, dataset);
  }
  if (seed?.workspaces) {
    for (const workspace of seed.workspaces) workspaces.set(workspace.id, workspace);
  }
  if (seed?.rules) {
    for (const rule of seed.rules) rules.set(rule.id, rule);
  }
  if (seed?.users) {
    for (const user of seed.users) users.set(user.id, user);
  }

  return {
    users,
    roles,
    rules,
    reports,
    pages,
    datasets,
    workspaces,
    permissions: seed?.permissions ? [...seed.permissions] : [],
    favorites: seed?.favorites ? [...seed.favorites] : [],
    syncRuns: seed?.syncRuns ? [...seed.syncRuns] : [],
    syncDeltaItems: seed?.syncDeltaItems ? [...seed.syncDeltaItems] : [],
  };
}

export function toSnapshot(store: BiOpsStore): BiOpsStoreSnapshot {
  return {
    users: [...store.users.values()],
    roles: [...store.roles.values()],
    rules: [...store.rules.values()],
    reports: [...store.reports.values()],
    pages: [...store.pages.values()],
    datasets: [...store.datasets.values()],
    workspaces: [...store.workspaces.values()],
    permissions: [...store.permissions],
    favorites: [...store.favorites],
    syncRuns: [...store.syncRuns],
    syncDeltaItems: [...store.syncDeltaItems],
  };
}

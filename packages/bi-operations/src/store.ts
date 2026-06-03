import type {
  BiPage,
  BiReport,
  BiRole,
  BiRule,
  BiUser,
  FavoriteReport,
  UserPermission,
} from "./types";

export interface BiOpsStore {
  users: Map<string, BiUser>;
  roles: Map<string, BiRole>;
  rules: Map<string, BiRule>;
  reports: Map<string, BiReport>;
  pages: Map<string, BiPage>;
  permissions: UserPermission[];
  favorites: FavoriteReport[];
}

export interface BiOpsStoreSnapshot {
  users: BiUser[];
  roles: BiRole[];
  rules: BiRule[];
  reports: BiReport[];
  pages: BiPage[];
  permissions: UserPermission[];
  favorites: FavoriteReport[];
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
      },
    ],
  ]);
  const pages = new Map<string, BiPage>([
    [{ id: "page-sales-main", reportId: "report-sales", name: "Main", displayName: "Main" }.id, {
      id: "page-sales-main",
      reportId: "report-sales",
      name: "Main",
      displayName: "Main",
    }],
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
    permissions: seed?.permissions ? [...seed.permissions] : [],
    favorites: seed?.favorites ? [...seed.favorites] : [],
  };
}

export function toSnapshot(store: BiOpsStore): BiOpsStoreSnapshot {
  return {
    users: [...store.users.values()],
    roles: [...store.roles.values()],
    rules: [...store.rules.values()],
    reports: [...store.reports.values()],
    pages: [...store.pages.values()],
    permissions: [...store.permissions],
    favorites: [...store.favorites],
  };
}

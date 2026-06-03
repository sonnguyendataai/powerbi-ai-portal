import {
  biPageSchema,
  biReportSchema,
  biRoleSchema,
  biRuleSchema,
  biUserSchema,
  type BiPage,
  type BiReport,
  type BiRole,
  type BiRule,
  type BiUser,
  type UserExportRecord,
  type UserPermission,
} from "./types";
import { createBiOpsStore, type BiOpsStore } from "./store";

export class BiOperationsService {
  constructor(private readonly store: BiOpsStore = createBiOpsStore()) {}

  listUsers(): BiUser[] {
    return [...this.store.users.values()];
  }

  upsertUser(user: BiUser): BiUser {
    const parsed = biUserSchema.parse(user);
    this.store.users.set(parsed.id, parsed);
    return parsed;
  }

  listRoles(): BiRole[] {
    return [...this.store.roles.values()];
  }

  upsertRole(role: BiRole): BiRole {
    const parsed = biRoleSchema.parse(role);
    this.store.roles.set(parsed.id, parsed);
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

  upsertReport(report: BiReport): BiReport {
    const parsed = biReportSchema.parse(report);
    this.store.reports.set(parsed.id, parsed);
    return parsed;
  }

  upsertPage(page: BiPage): BiPage {
    const parsed = biPageSchema.parse(page);
    this.store.pages.set(parsed.id, parsed);
    return parsed;
  }

  upsertRule(rule: BiRule): BiRule {
    const parsed = biRuleSchema.parse(rule);
    this.store.rules.set(parsed.id, parsed);
    return parsed;
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
    return permission;
  }

  getUserPermissions(userId: string): UserPermission[] {
    return this.store.permissions.filter((perm) => perm.userId === userId);
  }

  toggleFavorite(userId: string, reportId: string): { reportId: string; isFavorite: boolean } {
    const idx = this.store.favorites.findIndex((fav) => fav.userId === userId && fav.reportId === reportId);
    if (idx >= 0) {
      this.store.favorites.splice(idx, 1);
      return { reportId, isFavorite: false };
    }
    this.store.favorites.push({ userId, reportId });
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
}

export interface SessionUser {
  userId: string;
  tenantId: string;
  roles: Array<"portal-admin" | "analyst" | "viewer">;
  region?: "NA" | "EMEA" | "APAC";
}

export function buildResource(tenantId: string, resourceType: string, resourceId: string): string {
  return `tenant:${tenantId}:${resourceType}:${resourceId}`;
}

import type { SessionUser } from "@/auth";

export function resolveSessionUser(req: Request): SessionUser {
  const tenantId = req.headers.get("x-tenant-id") ?? "tenant-default";
  const userId = req.headers.get("x-user-id") ?? "user@example.com";
  const roleHeader = req.headers.get("x-user-roles") ?? "analyst";
  const roles = roleHeader
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean) as SessionUser["roles"];

  return {
    userId,
    tenantId,
    roles: roles.length > 0 ? roles : ["analyst"],
  };
}

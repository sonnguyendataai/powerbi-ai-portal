import type { AuditEvent } from "./types";

export function emitAudit(event: Omit<AuditEvent, "timestamp">): void {
  const payload: AuditEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(payload));
}

export interface TelemetryEvent {
  name: string;
  tenantId: string;
  userId: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export function emitTelemetry(event: TelemetryEvent): void {
  const payload = { ts: new Date().toISOString(), ...event };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(payload));
}

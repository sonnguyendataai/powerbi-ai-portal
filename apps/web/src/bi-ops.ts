import {
  BiOperationsService,
  createBiOpsStore,
} from "@portal/bi-operations";
import { loadEnv } from "@/env";
import { loadBiOpsSnapshot, persistBiOpsSnapshot } from "@/bi-ops-persistence";

declare global {
  // eslint-disable-next-line no-var
  var __biOperationsService: BiOperationsService | undefined;
  // eslint-disable-next-line no-var
  var __biOperationsServicePromise: Promise<BiOperationsService> | undefined;
  // eslint-disable-next-line no-var
  var __biOpsPendingPersist: Promise<void>;
}

globalThis.__biOpsPendingPersist ??= Promise.resolve();

export async function getBiOperationsService(): Promise<BiOperationsService> {
  if (!globalThis.__biOperationsService) {
    if (!globalThis.__biOperationsServicePromise) {
      globalThis.__biOperationsServicePromise = buildBiOperationsService();
    }
    globalThis.__biOperationsService = await globalThis.__biOperationsServicePromise;
  }
  return globalThis.__biOperationsService;
}

// Awaits the last in-flight DB write. Call this before returning a response that
// another request (on a potentially different serverless instance) must read back.
export async function flushBiOpsPersistence(): Promise<void> {
  await globalThis.__biOpsPendingPersist;
}

async function buildBiOperationsService(): Promise<BiOperationsService> {
  const env = loadEnv(process.env);
  const snapshot = await loadBiOpsSnapshot({
    filePath: env.BI_OPS_STORE_FILE,
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
  });
  const store = createBiOpsStore(snapshot);
  const opts = {
    filePath: env.BI_OPS_STORE_FILE,
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
  };
  return new BiOperationsService(store, {
    onMutate: (next) => {
      globalThis.__biOpsPendingPersist = persistBiOpsSnapshot(opts, next).catch((err) => {
        console.error("[bi-ops] persist failed:", err instanceof Error ? err.message : err);
      });
    },
  });
}

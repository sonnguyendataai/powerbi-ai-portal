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
}

export async function getBiOperationsService(): Promise<BiOperationsService> {
  if (!globalThis.__biOperationsService) {
    if (!globalThis.__biOperationsServicePromise) {
      globalThis.__biOperationsServicePromise = buildBiOperationsService();
    }
    globalThis.__biOperationsService = await globalThis.__biOperationsServicePromise;
  }
  return globalThis.__biOperationsService;
}

async function buildBiOperationsService(): Promise<BiOperationsService> {
  const env = loadEnv(process.env);
  const snapshot = await loadBiOpsSnapshot({
    filePath: env.BI_OPS_STORE_FILE,
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
  });
  const store = createBiOpsStore(snapshot);
  return new BiOperationsService(store, {
    onMutate: (next) =>
      persistBiOpsSnapshot(
        {
          filePath: env.BI_OPS_STORE_FILE,
          ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
        },
        next,
      ),
  });
}

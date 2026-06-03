import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  BiOperationsService,
  createBiOpsStore,
  type BiOpsStoreSnapshot,
} from "@portal/bi-operations";
import { loadEnv } from "@/env";

declare global {
  // eslint-disable-next-line no-var
  var __biOperationsService: BiOperationsService | undefined;
}

export function getBiOperationsService(): BiOperationsService {
  if (!globalThis.__biOperationsService) {
    const env = loadEnv(process.env);
    const filePath = resolve(process.cwd(), env.BI_OPS_STORE_FILE);
    const store = createBiOpsStore(readSnapshot(filePath));
    globalThis.__biOperationsService = new BiOperationsService(store, {
      onMutate: (snapshot) => writeSnapshot(filePath, snapshot),
    });
  }
  return globalThis.__biOperationsService;
}

function readSnapshot(filePath: string): BiOpsStoreSnapshot | undefined {
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as BiOpsStoreSnapshot;
  } catch {
    return undefined;
  }
}

function writeSnapshot(filePath: string, snapshot: BiOpsStoreSnapshot): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  } catch {
    // Best-effort persistence in environments without writable disk.
  }
}

import { BiOperationsService } from "@portal/bi-operations";

declare global {
  // eslint-disable-next-line no-var
  var __biOperationsService: BiOperationsService | undefined;
}

export function getBiOperationsService(): BiOperationsService {
  if (!globalThis.__biOperationsService) {
    globalThis.__biOperationsService = new BiOperationsService();
  }
  return globalThis.__biOperationsService;
}

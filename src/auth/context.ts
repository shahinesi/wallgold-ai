import { AsyncLocalStorage } from 'node:async_hooks';

const wallGoldApiKeyContext = new AsyncLocalStorage<string | undefined>();

export function runWithWallGoldApiKey<T>(apiKey: string | undefined, fn: () => T): T {
  return wallGoldApiKeyContext.run(apiKey, fn);
}

export function getRequestWallGoldApiKey() {
  return wallGoldApiKeyContext.getStore();
}

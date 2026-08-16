import test from 'node:test';
import assert from 'node:assert/strict';
import { getRequestWallGoldApiKey, runWithWallGoldApiKey } from '../src/auth/context.js';
import { externalBaseUrl } from '../src/auth/oauth.js';

test('WallGold API key context is request-scoped across async work', async () => {
  assert.equal(getRequestWallGoldApiKey(), undefined);
  const results = await Promise.all([
    runWithWallGoldApiKey('key-a', async () => {
      await Promise.resolve();
      return getRequestWallGoldApiKey();
    }),
    runWithWallGoldApiKey('key-b', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return getRequestWallGoldApiKey();
    }),
  ]);
  assert.deepEqual(results, ['key-a', 'key-b']);
  assert.equal(getRequestWallGoldApiKey(), undefined);
});

test('externalBaseUrl prefers forwarded HTTPS host', () => {
  const req = {
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'example-3000.app.github.dev',
    },
    protocol: 'http',
    get: () => 'internal:3000',
  } as any;
  assert.equal(externalBaseUrl(req), 'https://example-3000.app.github.dev');
});

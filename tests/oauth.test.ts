import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { registerOAuthRoutes } from '../src/auth/oauth.js';
import { config } from '../src/config.js';

test('OAuth discovery, consent UX, API-key validation, callback and PKCE token exchange', async () => {
  const app = express();
  registerOAuthRoutes(app);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const callback = 'https://chatgpt.com/callback';
  const verifier = 'test-verifier-with-enough-entropy-123456789';
  const challengeValue = createHash('sha256').update(verifier).digest('base64url');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith(config.wallgoldBaseUrl)) {
      const apiKey = new Headers(init?.headers).get('Authorization');
      return new Response(apiKey === 'Bearer valid-key' ? JSON.stringify({ result: [] }) : JSON.stringify({ errorCode: 'unauthorized' }), {
        status: apiKey === 'Bearer valid-key' ? 200 : 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const discovery = await fetch(`${base}/.well-known/oauth-authorization-server`);
    assert.equal(discovery.status, 200);
    const metadata = await discovery.json() as Record<string, unknown>;
    assert.equal(metadata.code_challenge_methods_supported instanceof Array && metadata.code_challenge_methods_supported[0], 'S256');

    const registration = await fetch(`${base}/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ redirect_uris: 'https://evil.example/callback', client_name: 'ChatGPT' }),
    });
    assert.equal(registration.status, 400, 'invalid redirect must be rejected');

    const registrationBody = new URLSearchParams();
    registrationBody.append('redirect_uris', callback);
    registrationBody.set('client_name', 'ChatGPT');
    const validRegistration = await fetch(`${base}/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: registrationBody,
    });
    assert.equal(validRegistration.status, 201);
    const client = await validRegistration.json() as { client_id: string };

    const authorizeUrl = new URL(`${base}/oauth/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: callback,
      response_type: 'code',
      code_challenge: challengeValue,
      code_challenge_method: 'S256',
      state: 'state-123',
      resource: `${base}/mcp`,
    }).toString();
    const authorize = await fetch(authorizeUrl);
    assert.equal(authorize.status, 200);
    const authorizeHtml = await authorize.text();
    assert.ok(authorizeHtml.includes(`action="${base}/oauth/authorize"`));
    assert.match(authorizeHtml, /در حال بررسی API Key و اتصال به WallGold/);
    assert.match(authorize.headers.get('content-security-policy') ?? '', new RegExp(`form-action ${base}`));
    const requestId = authorizeHtml.match(/name="request_id" value="([^"]+)"/)?.[1];
    assert.ok(requestId);

    const invalid = await fetch(`${base}/oauth/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ request_id: requestId, decision: 'approve', api_key: 'invalid-key' }),
    });
    assert.equal(invalid.status, 400);
    const invalidHtml = await invalid.text();
    assert.match(invalidHtml, /❌ اتصال ناموفق بود/);
    assert.doesNotMatch(invalidHtml, /WallGoldClient|stack|Error:/);

    const successful = await fetch(`${base}/oauth/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ request_id: requestId, decision: 'approve', api_key: 'valid-key' }),
    });
    assert.equal(successful.status, 200);
    const successHtml = await successful.text();
    assert.match(successHtml, /✅ اتصال برقرار شد/);
    const redirectLiteral = successHtml.match(/location\.replace\((".*?")\)/)?.[1];
    assert.ok(redirectLiteral);
    const redirect = new URL(JSON.parse(redirectLiteral));
    assert.equal(redirect.origin, 'https://chatgpt.com');
    assert.equal(redirect.searchParams.get('state'), 'state-123');
    const code = redirect.searchParams.get('code');
    assert.ok(code);

    const token = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, code, redirect_uri: callback, code_verifier: verifier, resource: `${base}/mcp` }),
    });
    assert.equal(token.status, 200);
    const tokenBody = await token.json() as { access_token: string };
    assert.ok(tokenBody.access_token);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

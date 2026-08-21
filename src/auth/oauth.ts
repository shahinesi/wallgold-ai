import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { WallGoldApiError, WallGoldClient } from '../wallgold/client.js';

const RESOURCE_SCOPE = 'wallgold:read';
const MARKET_SCOPE = 'wallgold:market';
const PORTFOLIO_SCOPE = 'wallgold:portfolio';
const OFFLINE_SCOPE = 'offline_access';
const SUPPORTED_SCOPES = new Set([RESOURCE_SCOPE, MARKET_SCOPE, PORTFOLIO_SCOPE, OFFLINE_SCOPE]);
const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_CLIENTS_FILE = join(config.dataDir, 'oauth-clients.json');

type RegisteredClient = {
  clientId: string;
  redirectUris: string[];
  clientName: string;
  createdAt: string;
};

type PendingAuthorization = {
  requestId: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  state?: string;
  scope: string;
  codeChallenge: string;
  resource: string;
  expiresAtMs: number;
};

type AuthorizationCode = {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  resource: string;
  apiKey: string;
  expiresAtMs: number;
};

type TokenRecord = {
  clientId: string;
  scope: string;
  resource: string;
  apiKey: string;
  expiresAtMs: number;
};

const clients = new Map<string, RegisteredClient>();
const pendingAuthorizations = new Map<string, PendingAuthorization>();
const authorizationCodes = new Map<string, AuthorizationCode>();
const accessTokens = new Map<string, TokenRecord>();
const refreshTokens = new Map<string, TokenRecord>();
const apiKeyAttempts = new Map<string, { count: number; resetAtMs: number }>();
let clientsLoaded: Promise<void> | undefined;

function randomOpaque(prefix: string) {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function pkceS256(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function firstHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value?.split(',')[0]?.trim();
}

export function externalBaseUrl(req: Request) {
  const proto = firstHeader(req.headers['x-forwarded-proto']) || req.protocol || 'https';
  const host = firstHeader(req.headers['x-forwarded-host']) || req.get('host');
  if (!host) throw new Error('Host header is required.');
  return `${proto}://${host}`.replace(/\/$/, '');
}

function canonicalResource(req: Request) {
  return `${externalBaseUrl(req)}/mcp`;
}

function normalizeResource(value: string) {
  return value.replace(/\/$/, '');
}

function resourceMatches(a: string, b: string) {
  return normalizeResource(a) === normalizeResource(b);
}

function allowedOpenAIRedirect(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return h === 'chatgpt.com' || h.endsWith('.chatgpt.com') || h === 'openai.com' || h.endsWith('.openai.com');
  } catch {
    return false;
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeScopes(raw: unknown) {
  const requested = String(raw ?? '').split(/\s+/).filter(Boolean);
  const values = requested.length ? requested : [RESOURCE_SCOPE, MARKET_SCOPE, PORTFOLIO_SCOPE, OFFLINE_SCOPE];
  for (const scope of values) {
    if (!SUPPORTED_SCOPES.has(scope)) throw new Error(`unsupported_scope:${scope}`);
  }
  const granted = new Set(values);
  granted.add(RESOURCE_SCOPE);
  if (granted.has(RESOURCE_SCOPE) && !granted.has(MARKET_SCOPE) && !granted.has(PORTFOLIO_SCOPE)) {
    granted.add(MARKET_SCOPE);
    granted.add(PORTFOLIO_SCOPE);
  }
  return [...granted].join(' ');
}

function selectedScopes(body: Record<string, unknown>, allowedScope: string) {
  const allowed = new Set(allowedScope.split(/\s+/));
  const selected = [
    body.permission_market === 'on' && allowed.has(MARKET_SCOPE) ? MARKET_SCOPE : null,
    body.permission_portfolio === 'on' && allowed.has(PORTFOLIO_SCOPE) ? PORTFOLIO_SCOPE : null,
  ].filter((scope): scope is string => Boolean(scope));
  if (!selected.length) throw new Error('حداقل یک دسترسی برای ادامه اتصال باید فعال باشد.');
  if (allowed.has(OFFLINE_SCOPE)) selected.push(OFFLINE_SCOPE);
  selected.unshift(RESOURCE_SCOPE);
  return [...new Set(selected)].join(' ');
}

const WALLGOLD_MONOGRAM = `<svg width="56" height="40" viewBox="0 0 56 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="نشان وال‌گلد" role="img"><path d="M47.2052 15.5735L42.2181 10.36C42.0299 10.1722 41.7904 10.0738 41.5509 10.0738C41.3113 10.0738 41.0633 10.1722 40.8836 10.36L35.8965 15.5735C35.7084 15.7702 35.6228 16.0206 35.6228 16.271C35.6228 16.5214 35.7169 16.7807 35.8965 16.9685L40.8836 22.182C41.0718 22.3698 41.3113 22.4682 41.5509 22.4682C41.7904 22.4682 42.0384 22.3698 42.2181 22.182L47.2052 16.9685C47.3934 16.7718 47.4789 16.5214 47.2052 15.5735Z" fill="#CF8C06"/><path d="M27.7444 10.2884C27.3766 9.90387 26.7778 9.90387 26.4099 10.2884L21.4228 15.5019C21.055 15.8864 20.4562 15.8864 20.0884 15.5019L15.1184 10.3063C14.7506 9.92175 14.1518 9.92175 13.784 10.3063L8.79687 15.5198C8.42904 15.9043 8.42904 16.5303 8.79687 16.9148L21.0379 29.7116C21.4057 30.0961 22.0045 30.0961 22.3724 29.7116L24.451 27.5386L27.368 24.4981C27.7358 24.1136 28.3346 24.1136 28.7025 24.4981L33.6895 29.7116C34.0574 30.0961 34.6562 30.0961 35.024 29.7116L40.0111 24.4981C40.3789 24.1136 40.3789 23.4876 40.0111 23.1031L27.7444 10.2884Z" fill="#2D2D2D"/></svg>`;

function redirectWithParams(url: string, params: Record<string, string | undefined>) {
  const out = new URL(url);
  for (const [key, value] of Object.entries(params)) if (value != null) out.searchParams.set(key, value);
  return out.toString();
}

async function ensureClientsLoaded() {
  if (!clientsLoaded) {
    clientsLoaded = (async () => {
      try {
        const parsed = JSON.parse(await readFile(OAUTH_CLIENTS_FILE, 'utf8')) as RegisteredClient[];
        for (const client of parsed) {
          if (client?.clientId && Array.isArray(client.redirectUris)) clients.set(client.clientId, client);
        }
      } catch (error: any) {
        if (error?.code !== 'ENOENT') console.warn('OAuth client registry could not be loaded.');
      }
    })();
  }
  await clientsLoaded;
}

async function persistClients() {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(OAUTH_CLIENTS_FILE, JSON.stringify([...clients.values()], null, 2), { mode: 0o600 });
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, v] of pendingAuthorizations) if (v.expiresAtMs <= now) pendingAuthorizations.delete(id);
  for (const [id, v] of authorizationCodes) if (v.expiresAtMs <= now) authorizationCodes.delete(id);
  for (const [id, v] of accessTokens) if (v.expiresAtMs <= now) accessTokens.delete(id);
  for (const [id, v] of refreshTokens) if (v.expiresAtMs <= now) refreshTokens.delete(id);
  for (const [id, v] of apiKeyAttempts) if (v.resetAtMs <= now) apiKeyAttempts.delete(id);
}

function apiKeyAttemptAllowed(req: Request) {
  pruneExpired();
  const id = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = apiKeyAttempts.get(id);
  if (!entry || entry.resetAtMs <= now) {
    apiKeyAttempts.set(id, { count: 1, resetAtMs: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

function securityHeaders(req: Request, res: Response, scriptNonce = randomBytes(16).toString('base64url')) {
  const origin = externalBaseUrl(req);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; form-action ${origin}; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`);
}

function authorizationPage(input: { requestId: string; clientName: string; scope: string; formAction: string; scriptNonce: string; marketEnabled: boolean; portfolioEnabled: boolean; error?: string }) {
  const error = input.error ? `<div class="error" role="alert"><strong>❌ اتصال ناموفق بود</strong><span>${escapeHtml(input.error)}</span></div>` : '';
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>اتصال WallGold AI</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,#352814 0,#111 42%,#070707 100%);color:#f5f0e6;font-family:Tahoma,Arial,sans-serif;padding:24px}.card{width:min(520px,100%);background:linear-gradient(180deg,rgba(31,31,31,.98),rgba(14,14,14,.98));border:1px solid #725721;border-radius:24px;box-shadow:0 24px 80px #0009;padding:30px}.brand{display:flex;align-items:center;gap:14px;margin-bottom:24px}.logo{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:#fff;border:1px solid #725721;padding:8px;box-shadow:0 8px 30px #b77b2433}.logo svg{width:100%;height:100%}.brand h1{font-size:22px;margin:0}.brand p{margin:5px 0 0;color:#aaa;font-size:13px}.notice{background:#17140e;border:1px solid #493a1d;border-radius:14px;padding:14px 16px;color:#d8c69e;font-size:13px;line-height:1.9;margin:18px 0}.error{background:#321414;border:1px solid #7f3030;border-radius:12px;padding:12px 14px;color:#ffb9b9;margin:14px 0;font-size:13px;display:grid;gap:6px}.field label{display:block;font-weight:700;margin-bottom:9px}.field input{width:100%;background:#090909;border:1px solid #4b412d;color:#fff;border-radius:12px;padding:14px;font:inherit;direction:ltr;outline:none}.field input:focus{border-color:#d4a93d;box-shadow:0 0 0 3px #d4a93d22}.help{font-size:12px;line-height:1.8;color:#aaa;margin-top:9px}.help a{color:#e6bd55;text-decoration:none}.permissions{display:grid;gap:8px;margin:20px 0;font-size:13px}.permission{display:flex;align-items:center;justify-content:space-between;background:#101010;border-radius:10px;padding:10px 12px;cursor:pointer}.permission span{display:grid;gap:3px}.permission small{color:#888;font-size:11px}.permission input{width:18px;height:18px;accent-color:#d4a93d}.permission.locked{cursor:not-allowed;opacity:.65}.actions{display:grid;gap:10px;margin-top:22px}.primary,.secondary{border:0;border-radius:12px;padding:14px 16px;font:inherit;font-weight:800;cursor:pointer}.primary{background:linear-gradient(135deg,#f2c85d,#b77a17);color:#171109}.secondary{background:#242424;color:#bbb}.primary:disabled,.secondary:disabled{cursor:wait;opacity:.7}.spinner{display:inline-block;margin-left:8px;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.foot{margin-top:18px;color:#777;font-size:11px;line-height:1.8;text-align:center}
</style>
</head>
<body><main class="card">
<div class="brand"><div class="logo">${WALLGOLD_MONOGRAM}</div><div><h1>اتصال WallGold AI</h1><p>اتصال امن حساب وال‌گلد به ChatGPT</p></div></div>
<p>برای فعال‌شدن موجودی، قیمت اختصاصی و تحلیل پرتفوی، API Key وال‌گلد را اینجا وارد کن.</p>
<div class="notice">API Key در پیام ChatGPT یا ورودی ابزار قرار نمی‌گیرد. در نسخه آزمایشی Codespaces کلید روی دیسک ذخیره نمی‌شود و فقط تا زمان روشن‌بودن همین سرور در حافظه باقی می‌ماند.</div>
${error}
<form method="post" action="${escapeHtml(input.formAction)}" autocomplete="off">
<input type="hidden" name="request_id" value="${escapeHtml(input.requestId)}">
<div class="field"><label for="api_key">API Key وال‌گلد</label><input id="api_key" name="api_key" type="password" required minlength="8" maxlength="4096" autocomplete="off" placeholder="کلید را فقط اینجا وارد کن"><div class="help">کلید را از <a href="https://developers.wallgold.ir/fa/docs/api-key" target="_blank" rel="noopener noreferrer">راهنمای رسمی WallGold</a> بساز. این فرم قبل از اتصال، کلید را با API خصوصی WallGold بررسی می‌کند.</div></div>
<div class="permissions"><label class="permission"><span>مشاهده بازار و قیمت خصوصی<small>قیمت و داده بازار اختصاصی WallGold</small></span><input type="checkbox" name="permission_market" ${input.marketEnabled ? 'checked' : ''} aria-label="فعال‌سازی مشاهده بازار و قیمت خصوصی"></label><label class="permission"><span>مشاهده موجودی و پرتفوی<small>موجودی و دارایی‌های حساب</small></span><input type="checkbox" name="permission_portfolio" ${input.portfolioEnabled ? 'checked' : ''} aria-label="فعال‌سازی مشاهده موجودی و پرتفوی"></label><label class="permission locked"><span>ثبت سفارش واقعی<small>برای این اتصال و نسخه عمومی غیرفعال است</small></span><input type="checkbox" disabled aria-label="ثبت سفارش واقعی غیرفعال است"></label></div>
<div class="actions"><button class="primary" name="decision" value="approve" type="submit">اتصال حساب و بازگشت به ChatGPT</button><button class="secondary" name="decision" value="deny" type="submit" formnovalidate>لغو</button></div>
</form>
<div class="foot">درخواست اتصال از «${escapeHtml(input.clientName)}» · دسترسی: ${escapeHtml(input.scope)}</div>
<script nonce="${escapeHtml(input.scriptNonce)}">document.querySelector('form')?.addEventListener('submit',event=>{const submitter=event.submitter;if(!(submitter instanceof HTMLButtonElement)||submitter.value!=='approve')return;submitter.disabled=true;submitter.innerHTML='<span class="spinner" aria-hidden="true">⟳</span> در حال بررسی API Key و اتصال به WallGold...';document.querySelectorAll('button').forEach(button=>{button.disabled=true})});</script>
</main></body></html>`;
}

function successPage(redirectUrl: string, scriptNonce: string) {
  return `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>اتصال برقرار شد</title><style>body{margin:0;background:#0b0b0b;color:#eee;font-family:Tahoma,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}main{max-width:560px;border:1px solid #28633f;border-radius:18px;padding:26px;background:#151515;text-align:center}h2{color:#7ce7a6}p{line-height:1.9;color:#bbb}</style><main><h2>✅ اتصال برقرار شد</h2><p>در حال بازگشت به ChatGPT...</p></main><script nonce="${escapeHtml(scriptNonce)}">setTimeout(()=>location.replace(${JSON.stringify(redirectUrl)}),600);</script></html>`;
}

function simpleErrorPage(title: string, detail: string) {
  return `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><body style="margin:0;background:#0b0b0b;color:#eee;font-family:Tahoma,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px"><main style="max-width:560px;border:1px solid #5a4722;border-radius:18px;padding:26px;background:#151515"><h2>${escapeHtml(title)}</h2><p style="line-height:1.9;color:#bbb">${escapeHtml(detail)}</p></main></body></html>`;
}

async function validateWallGoldApiKey(apiKey: string) {
  const key = apiKey.trim();
  if (!key || key.length > 4096) throw new Error('API Key معتبر وارد نشده است.');
  try {
    const client = new WallGoldClient(config.wallgoldBaseUrl, key);
    await client.getBalances();
    return key;
  } catch (error) {
    if (error instanceof WallGoldApiError && (error.status === 401 || error.status === 403)) {
      throw new Error('API Key توسط WallGold رد شد. کلید، تاریخ انقضا و محدودیت IP را بررسی کن.');
    }
    throw new Error('در حال حاضر بررسی API Key با WallGold ممکن نشد. چند لحظه بعد دوباره تلاش کن.');
  }
}

function issueTokens(record: TokenRecord) {
  const accessToken = randomOpaque('wga');
  const refreshToken = randomOpaque('wgr');
  accessTokens.set(accessToken, { ...record, expiresAtMs: Date.now() + ACCESS_TOKEN_TTL_MS });
  refreshTokens.set(refreshToken, { ...record, expiresAtMs: Date.now() + REFRESH_TOKEN_TTL_MS });
  return { accessToken, refreshToken };
}

export function resolveMcpAccessToken(token: string, expectedResource: string) {
  pruneExpired();
  const record = accessTokens.get(token);
  if (!record || record.expiresAtMs <= Date.now()) return null;
  if (!resourceMatches(record.resource, expectedResource)) return null;
  if (!record.scope.split(/\s+/).includes(RESOURCE_SCOPE)) return null;
  return { apiKey: record.apiKey, clientId: record.clientId, scope: record.scope };
}

export function registerOAuthRoutes(app: Express) {
  app.set('trust proxy', true);
  app.use('/oauth', express.urlencoded({ extended: false, limit: '32kb' }));

  const protectedResource = (req: Request, res: Response) => {
    const base = externalBaseUrl(req);
    res.json({
      resource: `${base}/mcp`,
      authorization_servers: [base],
      scopes_supported: [RESOURCE_SCOPE, MARKET_SCOPE, PORTFOLIO_SCOPE],
      bearer_methods_supported: ['header'],
    });
  };
  app.get('/.well-known/oauth-protected-resource', protectedResource);
  app.get('/.well-known/oauth-protected-resource/mcp', protectedResource);

  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const base = externalBaseUrl(req);
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      revocation_endpoint: `${base}/oauth/revoke`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: [RESOURCE_SCOPE, MARKET_SCOPE, PORTFOLIO_SCOPE, OFFLINE_SCOPE],
    });
  });

  app.post('/oauth/register', async (req, res) => {
    securityHeaders(req, res);
    await ensureClientsLoaded();
    const rawRedirectUris: unknown[] = Array.isArray(req.body?.redirect_uris)
      ? req.body.redirect_uris
      : [req.body?.redirect_uris];
    const redirectUris = rawRedirectUris.filter((v): v is string => typeof v === 'string');
    if (!redirectUris.length || !redirectUris.every(allowedOpenAIRedirect)) {
      return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'Only HTTPS OpenAI/ChatGPT redirect URIs are allowed.' });
    }
    const requestedMethod = req.body?.token_endpoint_auth_method ?? 'none';
    if (requestedMethod !== 'none') {
      return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'This development server supports public PKCE clients only.' });
    }
    const clientId = randomOpaque('wgc');
    const client: RegisteredClient = {
      clientId,
      redirectUris: [...new Set<string>(redirectUris)],
      clientName: typeof req.body?.client_name === 'string' && req.body.client_name.trim() ? req.body.client_name.trim().slice(0, 120) : 'ChatGPT',
      createdAt: new Date().toISOString(),
    };
    clients.set(clientId, client);
    await persistClients();
    return res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: client.redirectUris,
      client_name: client.clientName,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  });

  app.get('/oauth/authorize', async (req, res) => {
    const scriptNonce = randomBytes(16).toString('base64url');
    securityHeaders(req, res, scriptNonce);
    await ensureClientsLoaded();
    pruneExpired();
    const clientId = String(req.query.client_id ?? '');
    const client = clients.get(clientId);
    const redirectUri = String(req.query.redirect_uri ?? '');
    const responseType = String(req.query.response_type ?? '');
    const codeChallenge = String(req.query.code_challenge ?? '');
    const challengeMethod = String(req.query.code_challenge_method ?? '');
    if (!client || !client.redirectUris.includes(redirectUri)) return res.status(400).send(simpleErrorPage('درخواست اتصال نامعتبر است', 'شناسه برنامه یا آدرس بازگشت با ثبت OAuth مطابقت ندارد.'));
    if (responseType !== 'code' || !codeChallenge || challengeMethod !== 'S256') return res.status(400).send(simpleErrorPage('OAuth امن لازم است', 'این اتصال فقط Authorization Code همراه با PKCE S256 را می‌پذیرد.'));
    let scope: string;
    try { scope = normalizeScopes(req.query.scope); }
    catch { return res.redirect(redirectWithParams(redirectUri, { error: 'invalid_scope', state: String(req.query.state ?? '') || undefined })); }
    const expectedResource = canonicalResource(req);
    const requestedResource = String(req.query.resource ?? expectedResource);
    if (!resourceMatches(requestedResource, expectedResource)) return res.redirect(redirectWithParams(redirectUri, { error: 'invalid_target', state: String(req.query.state ?? '') || undefined }));
    const requestId = randomOpaque('wgp');
    const base = externalBaseUrl(req);
    pendingAuthorizations.set(requestId, {
      requestId,
      clientId,
      clientName: client.clientName,
      redirectUri,
      state: String(req.query.state ?? '') || undefined,
      scope,
      codeChallenge,
      resource: expectedResource,
      expiresAtMs: Date.now() + AUTH_REQUEST_TTL_MS,
    });
    return res.status(200).send(authorizationPage({ requestId, clientName: client.clientName, scope, formAction: `${base}/oauth/authorize`, scriptNonce, marketEnabled: scope.split(/\s+/).includes(MARKET_SCOPE), portfolioEnabled: scope.split(/\s+/).includes(PORTFOLIO_SCOPE) }));
  });

  app.post('/oauth/authorize', async (req, res) => {
    const scriptNonce = randomBytes(16).toString('base64url');
    securityHeaders(req, res, scriptNonce);
    pruneExpired();
    const requestId = String(req.body?.request_id ?? '');
    const pending = pendingAuthorizations.get(requestId);
    if (!pending || pending.expiresAtMs <= Date.now()) return res.status(400).send(simpleErrorPage('درخواست منقضی شده است', 'اتصال را از داخل ChatGPT دوباره شروع کن.'));
    if (String(req.body?.decision ?? '') === 'deny') {
      pendingAuthorizations.delete(requestId);
      return res.redirect(redirectWithParams(pending.redirectUri, { error: 'access_denied', state: pending.state }));
    }
    const base = externalBaseUrl(req);
    const marketEnabled = req.body?.permission_market === 'on';
    const portfolioEnabled = req.body?.permission_portfolio === 'on';
    if (!apiKeyAttemptAllowed(req)) return res.status(429).send(authorizationPage({ requestId, clientName: pending.clientName, scope: pending.scope, formAction: `${base}/oauth/authorize`, scriptNonce, marketEnabled, portfolioEnabled, error: 'تعداد تلاش‌ها زیاد شده است. یک دقیقه صبر کن و دوباره تلاش کن.' }));
    try {
      const grantedScope = selectedScopes(req.body as Record<string, unknown>, pending.scope);
      const apiKey = await validateWallGoldApiKey(String(req.body?.api_key ?? ''));
      pendingAuthorizations.delete(requestId);
      const code = randomOpaque('wgcod');
      authorizationCodes.set(code, {
        clientId: pending.clientId,
        redirectUri: pending.redirectUri,
        scope: grantedScope,
        codeChallenge: pending.codeChallenge,
        resource: pending.resource,
        apiKey,
        expiresAtMs: Date.now() + AUTH_CODE_TTL_MS,
      });
      const callback = redirectWithParams(pending.redirectUri, { code, state: pending.state });
      return res.status(200).send(successPage(callback, scriptNonce));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'اتصال به WallGold برقرار نشد.';
      return res.status(400).send(authorizationPage({ requestId, clientName: pending.clientName, scope: pending.scope, formAction: `${base}/oauth/authorize`, scriptNonce, marketEnabled, portfolioEnabled, error: message }));
    }
  });

  app.post('/oauth/token', async (req, res) => {
    securityHeaders(req, res);
    await ensureClientsLoaded();
    pruneExpired();
    const grantType = String(req.body?.grant_type ?? '');
    const clientId = String(req.body?.client_id ?? '');
    if (!clientId || !clients.has(clientId)) return res.status(401).json({ error: 'invalid_client' });

    if (grantType === 'authorization_code') {
      const code = String(req.body?.code ?? '');
      const record = authorizationCodes.get(code);
      if (!record || record.expiresAtMs <= Date.now()) return res.status(400).json({ error: 'invalid_grant' });
      if (record.clientId !== clientId || record.redirectUri !== String(req.body?.redirect_uri ?? '')) return res.status(400).json({ error: 'invalid_grant' });
      const verifier = String(req.body?.code_verifier ?? '');
      if (!verifier || !safeEqual(pkceS256(verifier), record.codeChallenge)) return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed.' });
      const tokenResource = String(req.body?.resource ?? record.resource);
      if (!resourceMatches(tokenResource, record.resource)) return res.status(400).json({ error: 'invalid_target' });
      authorizationCodes.delete(code);
      const { accessToken, refreshToken } = issueTokens({ ...record, expiresAtMs: 0 });
      return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_MS / 1000, refresh_token: refreshToken, scope: record.scope });
    }

    if (grantType === 'refresh_token') {
      const oldRefresh = String(req.body?.refresh_token ?? '');
      const record = refreshTokens.get(oldRefresh);
      if (!record || record.expiresAtMs <= Date.now() || record.clientId !== clientId) return res.status(400).json({ error: 'invalid_grant' });
      const tokenResource = String(req.body?.resource ?? record.resource);
      if (!resourceMatches(tokenResource, record.resource)) return res.status(400).json({ error: 'invalid_target' });
      refreshTokens.delete(oldRefresh);
      const { accessToken, refreshToken } = issueTokens({ ...record, expiresAtMs: 0 });
      return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_MS / 1000, refresh_token: refreshToken, scope: record.scope });
    }

    return res.status(400).json({ error: 'unsupported_grant_type' });
  });

  app.post('/oauth/revoke', (req, res) => {
    securityHeaders(req, res);
    const token = String(req.body?.token ?? '');
    if (token) {
      accessTokens.delete(token);
      refreshTokens.delete(token);
    }
    return res.status(200).end();
  });
}

export function requireMcpOAuth(req: Request, res: Response, next: NextFunction) {
  const base = externalBaseUrl(req);
  const resource = `${base}/mcp`;
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const record = token ? resolveMcpAccessToken(token, resource) : null;
  if (!record) {
    const resourceMetadata = `${base}/.well-known/oauth-protected-resource`;
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}", scope="${RESOURCE_SCOPE}"`);
    return res.status(401).json({ error: 'unauthorized', message: 'برای دسترسی به WallGold AI ابتدا اتصال OAuth را کامل کنید.' });
  }
  res.locals.wallgoldApiKey = record.apiKey;
  res.locals.oauthClientId = record.clientId;
  res.locals.oauthScope = record.scope;
  return next();
}

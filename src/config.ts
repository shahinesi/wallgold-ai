import 'dotenv/config';

const bool = (v: string | undefined, fallback = false) =>
  v == null ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: num(process.env.PORT, 3000),
  wallgoldBaseUrl: process.env.WALLGOLD_BASE_URL ?? 'https://api.wallgold.ir',
  // WALLGOLD_TOKEN remains as a backward-compatible alias only.
  wallgoldApiKey: process.env.WALLGOLD_API_KEY ?? process.env.WALLGOLD_TOKEN ?? '',
  wallgoldDefaultSymbol: process.env.WALLGOLD_DEFAULT_SYMBOL ?? 'GLD_18C_750TMN',
  wallgoldRequestTimeoutMs: num(process.env.WALLGOLD_REQUEST_TIMEOUT_MS, 10_000),
  wallgoldMinExecutionTtlSeconds: num(process.env.WALLGOLD_MIN_EXECUTION_TTL_SECONDS, 4),
  // Codespaces defaults to OAuth so a public forwarded port never exposes private WallGold data anonymously.
  mcpOauthEnabled: bool(process.env.MCP_OAUTH_ENABLED, bool(process.env.CODESPACES, false)),
  mcpSharedBearer: process.env.MCP_SHARED_BEARER ?? '',
  allowUnauthenticatedMcp: bool(process.env.ALLOW_UNAUTHENTICATED_MCP, false),
  allowedHosts: (process.env.MCP_ALLOWED_HOSTS ?? 'localhost,127.0.0.1').split(',').map(s => s.trim()).filter(Boolean),
  allowedOrigins: (process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  previewSigningSecret: process.env.PREVIEW_SIGNING_SECRET ?? 'dev-only-change-me',
  previewSigningSecretIsStrong: Boolean(process.env.PREVIEW_SIGNING_SECRET && process.env.PREVIEW_SIGNING_SECRET.length >= 32),
  previewTtlSeconds: num(process.env.PREVIEW_TTL_SECONDS, 25),
  analysisTokenTtlSeconds: num(process.env.ANALYSIS_TOKEN_TTL_SECONDS, 3600),
  allowMcpTradeExecution: bool(process.env.WALLGOLD_MCP_ALLOW_TRADE_EXECUTION, false),
  privateExecutionEnabled: bool(process.env.PRIVATE_EXECUTION_ENABLED, false),
  privateMaxOrderToman: num(process.env.PRIVATE_MAX_ORDER_TOMAN, 0),
  privateMaxOrderGrams: num(process.env.PRIVATE_MAX_ORDER_GRAMS, 0),
  dataDir: process.env.DATA_DIR ?? './data',
};

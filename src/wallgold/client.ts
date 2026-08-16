import { config } from '../config.js';
import { getRequestWallGoldApiKey } from '../auth/context.js';

export interface WallGoldBalance {
  currency: string;
  amount: string;
  locked_amount?: string;
  [k: string]: unknown;
}

export interface WallGoldMarket {
  symbol: string;
  baseAsset?: string;
  baseAssetPrecision?: string;
  quoteAsset?: string;
  quotePrecision?: string;
  otcFeeCoefficient?: string;
  sltpFeeCoefficient?: string;
  minQty?: string;
  maxQty?: string;
  minNotional?: string;
  maxNotional?: string;
  minQtySLTP?: string;
  maxQtySLTP?: string;
  minNotionalSLTP?: string;
  maxNotionalSLTP?: string;
  IsEnableBuySide?: boolean;
  IsEnableSellSide?: boolean;
  buyStatus?: string;
  sellStatus?: string;
  faName?: string;
  enName?: string;
  faBaseAsset?: string;
  enBaseAsset?: string;
  faQuoteAsset?: string;
  enQuoteAsset?: string;
  [k: string]: unknown;
}

export interface WallGoldPriceResult {
  price: string;
  priceExpiresAt: string;
  currentTime: string;
  ttl: number;
  [k: string]: unknown;
}

export interface WallGoldOrderResult {
  orderId?: string;
  clientId?: string;
  symbol?: string;
  orderAmount?: string;
  filledAmount?: string;
  price?: string;
  totalPrice?: string;
  side?: 'buy' | 'sell';
  status?: string;
  fee?: string;
  feeCurrency?: string;
  otcFee?: string;
  otcFeeCurrency?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

export class WallGoldApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'WallGoldApiError';
  }
}

function pickErrorCode(body: any): string | undefined {
  const code = body?.errorCode ?? body?.result?.errorCode ?? body?.error?.errorCode;
  return typeof code === 'string' ? code : undefined;
}

export class WallGoldClient {
  constructor(
    private baseUrl = config.wallgoldBaseUrl,
    private apiKey = getRequestWallGoldApiKey() ?? config.wallgoldApiKey,
  ) {}

  hasApiKey() {
    return Boolean(this.apiKey);
  }

  private async request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
    if (auth) {
      if (!this.apiKey) throw new Error('WALLGOLD_API_KEY تنظیم نشده است.');
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.wallgoldRequestTimeoutMs);
    let r: Response;
    try {
      r = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`درخواست WallGold پس از ${config.wallgoldRequestTimeoutMs} میلی‌ثانیه به پایان رسید.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const text = await r.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!r.ok) {
      const errorCode = pickErrorCode(body);
      const suffix = errorCode ? ` / ${errorCode}` : '';
      throw new WallGoldApiError(`خطای WallGold (${r.status}${suffix})`, r.status, errorCode, body);
    }
    return body as T;
  }

  getMarkets() {
    return this.request<{ result: WallGoldMarket[] }>('/api/v1/markets');
  }

  getBalances() {
    return this.request<{ result: WallGoldBalance[] }>('/api/v1/account/balances', {}, true);
  }

  getPrivatePrice(symbol: string, side: 'buy' | 'sell') {
    const q = new URLSearchParams({ symbol, side });
    return this.request<{ result: WallGoldPriceResult }>(`/api/v1/account/price?${q}`, {}, true);
  }

  placeOrder(input: { symbol: string; side: 'buy' | 'sell'; orderAmount: string; clientId?: string }) {
    // Important: POST is intentionally not auto-retried. A network failure after the request
    // reaches WallGold can leave execution status ambiguous, and clientId uniqueness is not
    // documented as a safe retry/idempotency contract.
    return this.request<{ result: WallGoldOrderResult }>(
      '/api/v1/account/orders',
      { method: 'POST', body: JSON.stringify(input) },
      true,
    );
  }

  getOrder(orderId: string) {
    return this.request<{ result: WallGoldOrderResult }>(
      `/api/v1/account/orders/${encodeURIComponent(orderId)}`,
      {},
      true,
    );
  }
}

export function unwrapPrice(x: { result?: WallGoldPriceResult } | WallGoldPriceResult | any) {
  const r = x?.result ?? x;
  const price = Number(r?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('قیمت معتبر از WallGold دریافت نشد.');

  const ttl = Number(r?.ttl);
  const currentTimeMs = Date.parse(String(r?.currentTime ?? ''));
  const expiresAtMs = Date.parse(String(r?.priceExpiresAt ?? ''));
  const computedTtl = Number.isFinite(currentTimeMs) && Number.isFinite(expiresAtMs)
    ? Math.max(0, (expiresAtMs - currentTimeMs) / 1000)
    : NaN;

  return {
    price,
    priceExpiresAt: typeof r?.priceExpiresAt === 'string' ? r.priceExpiresAt : undefined,
    currentTime: typeof r?.currentTime === 'string' ? r.currentTime : undefined,
    ttlSeconds: Number.isFinite(ttl) ? ttl : (Number.isFinite(computedTtl) ? computedTtl : undefined),
    raw: r as WallGoldPriceResult,
  };
}

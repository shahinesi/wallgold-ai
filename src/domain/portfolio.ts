import type { WallGoldBalance, WallGoldMarket } from '../wallgold/client.js';
import { round } from '../utils/math.js';

function numeric(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function balanceSnapshot(b: WallGoldBalance | undefined, precision: number) {
  const total = numeric(b?.amount);
  const locked = numeric(b?.locked_amount);
  const available = Math.max(0, total - locked);
  return {
    total: round(total, precision),
    locked: round(locked, precision),
    available: round(available, precision),
  };
}

export function portfolioFromBalances(balances: WallGoldBalance[], goldPriceToman?: number) {
  const cash = balanceSnapshot(balances.find(b => b.currency === 'TMN'), 0);
  const gold = balanceSnapshot(balances.find(b => b.currency === 'GLD_18C_750'), 3);

  // Asset allocation uses TOTAL balances because locked assets still belong to the user.
  // Trade-capacity checks must use the available balances below.
  const goldValue = goldPriceToman ? gold.total * goldPriceToman : null;
  const totalValue = goldValue == null ? null : cash.total + goldValue;

  return {
    cashToman: cash.total,
    availableCashToman: cash.available,
    lockedCashToman: cash.locked,
    goldGrams: gold.total,
    availableGoldGrams: gold.available,
    lockedGoldGrams: gold.locked,
    goldValueToman: goldValue == null ? null : round(goldValue, 0),
    totalValueToman: totalValue == null ? null : round(totalValue, 0),
    goldAllocationPct: totalValue && goldValue != null ? round(goldValue / totalValue * 100, 2) : null,
  };
}

export function findMarket(markets: WallGoldMarket[], symbol: string) {
  const market = markets.find(x => x.symbol === symbol);
  if (!market) throw new Error(`بازار ${symbol} در پاسخ WallGold پیدا نشد.`);
  return market;
}

export function marketPrecision(markets: WallGoldMarket[], symbol: string) {
  const m = findMarket(markets, symbol);
  const p = Number(m.baseAssetPrecision ?? 3);
  // Store-order docs currently state at most 3 decimal places for gold orderAmount.
  return Math.max(0, Math.min(Number.isFinite(p) ? p : 3, 3));
}

function finiteOrUndefined(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function statusAllows(value: unknown) {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  return ['enable', 'enabled', 'active', 'open', 'true', '1'].includes(normalized);
}

export function validateInstantMarketOrder(
  market: WallGoldMarket,
  side: 'buy' | 'sell',
  grams: number,
  notionalToman: number,
) {
  const errors: string[] = [];
  if (side === 'buy') {
    if (market.IsEnableBuySide === false || !statusAllows(market.buyStatus)) errors.push('امکان خرید در این بازار WallGold در حال حاضر فعال نیست.');
  } else {
    if (market.IsEnableSellSide === false || !statusAllows(market.sellStatus)) errors.push('امکان فروش در این بازار WallGold در حال حاضر فعال نیست.');
  }

  const minQty = finiteOrUndefined(market.minQty);
  const maxQty = finiteOrUndefined(market.maxQty);
  const minNotional = finiteOrUndefined(market.minNotional);
  const maxNotional = finiteOrUndefined(market.maxNotional);

  if (minQty != null && grams < minQty) errors.push(`مقدار سفارش از حداقل WallGold (${minQty} گرم) کمتر است.`);
  if (maxQty != null && grams > maxQty) errors.push(`مقدار سفارش از حداکثر WallGold (${maxQty} گرم) بیشتر است.`);
  if (minNotional != null && notionalToman < minNotional) errors.push(`ارزش سفارش از حداقل WallGold (${minNotional} تومان) کمتر است.`);
  if (maxNotional != null && notionalToman > maxNotional) errors.push(`ارزش سفارش از حداکثر WallGold (${maxNotional} تومان) بیشتر است.`);

  return { allowed: errors.length === 0, errors, limits: { minQty, maxQty, minNotional, maxNotional } };
}

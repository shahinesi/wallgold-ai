import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { WallGoldApiError, WallGoldClient, unwrapPrice } from '../wallgold/client.js';
import { floorToPrecision, round } from '../utils/math.js';
import {
  findMarket,
  marketPrecision,
  portfolioFromBalances,
  validateInstantMarketOrder,
} from '../domain/portfolio.js';
import { calculateRebalance } from '../domain/rebalance.js';
import { store } from '../storage/json-store.js';
import { signPreview, verifyPreview } from './preview-token.js';
import { evaluateRisk } from '../domain/risk-engine.js';

function wallGoldErrorFa(error: unknown) {
  if (error instanceof WallGoldApiError) {
    if (error.errorCode === 'INVALID_PRICE') {
      return 'قیمت قابل معامله WallGold منقضی یا نامعتبر شده است؛ یک پیش‌نمایش تازه بگیر و معامله را از روی همان ادامه بده.';
    }
    if (error.status === 401 || error.status === 403) {
      return 'احراز هویت WallGold رد شد؛ اعتبار API Key، تاریخ انقضا و محدودیت IP آن را بررسی کن.';
    }
    if (error.status === 422) {
      return `WallGold سفارش را به‌دلیل اعتبارسنجی رد کرد${error.errorCode ? ` (${error.errorCode})` : ''}.`;
    }
    return `WallGold درخواست را با خطای ${error.status}${error.errorCode ? ` / ${error.errorCode}` : ''} رد کرد.`;
  }
  return error instanceof Error ? error.message : 'خطای نامشخص در ارتباط با WallGold.';
}

function mergeRisk(risk: ReturnType<typeof evaluateRisk>, extraBlocks: string[] = [], extraWarnings: string[] = []) {
  return {
    allowed: risk.allowed && extraBlocks.length === 0,
    blocks: [...risk.blocks, ...extraBlocks],
    warnings: [...risk.warnings, ...extraWarnings],
  };
}

export class TradingService {
  constructor(private wallgold = new WallGoldClient()) {}

  async portfolio(symbol = config.wallgoldDefaultSymbol) {
    const [balances, quote] = await Promise.all([
      this.wallgold.getBalances(),
      this.wallgold.getPrivatePrice(symbol, 'sell'),
    ]);
    const q = unwrapPrice(quote);
    return {
      portfolio: portfolioFromBalances(balances.result, q.price),
      liquidationPriceToman: q.price,
      quoteExpiresAt: q.priceExpiresAt,
      quoteCurrentTime: q.currentTime,
      quoteTtlSeconds: q.ttlSeconds,
    };
  }

  async previewRebalance(input: { symbol?: string; targetGoldAllocationPct?: number; tolerancePct?: number }) {
    const symbol = input.symbol ?? config.wallgoldDefaultSymbol;
    const policy = await store.getPolicy();
    const current = await this.portfolio(symbol);
    const p = current.portfolio;
    const target = input.targetGoldAllocationPct ?? policy.targetGoldAllocationPct;
    const plan = calculateRebalance({
      cashToman: p.cashToman,
      goldGrams: p.goldGrams,
      goldPriceToman: current.liquidationPriceToman,
      targetGoldAllocationPct: target,
      tolerancePct: input.tolerancePct,
    });
    if (plan.action === 'none') {
      return { plan, preview: null, messageFa: 'ترکیب فعلی داخل محدوده هدف است و نیازی به معامله ندارد.' };
    }
    const preview = await this.preview({ symbol, side: plan.action, tomanAmount: plan.estimatedTomanAmount });
    return { plan, preview, messageFa: `برای نزدیک‌شدن به هدف ${target}٪ طلا، پیش‌نمایش ${plan.actionFa} ساخته شد.` };
  }

  async preview(input: { side: 'buy' | 'sell'; tomanAmount?: number; goldAmount?: number; symbol?: string }) {
    const symbol = input.symbol ?? config.wallgoldDefaultSymbol;
    const [balances, markets, quote, policy, latestAnalysis] = await Promise.all([
      this.wallgold.getBalances(),
      this.wallgold.getMarkets(),
      this.wallgold.getPrivatePrice(symbol, input.side),
      store.getPolicy(),
      store.latestAnalysis(),
    ]);

    const q = unwrapPrice(quote);
    if (q.ttlSeconds != null && q.ttlSeconds <= 0) {
      throw new Error('قیمت قابل معامله WallGold منقضی شده است؛ دوباره قیمت بگیر.');
    }

    const market = findMarket(markets.result, symbol);
    const precision = marketPrecision(markets.result, symbol);
    let grams = input.goldAmount ?? ((input.tomanAmount ?? 0) / q.price);
    grams = floorToPrecision(grams, precision);
    if (!Number.isFinite(grams) || grams <= 0) throw new Error('مقدار معامله باید بیشتر از صفر باشد.');

    const notional = round(grams * q.price, 0);
    const marketCheck = validateInstantMarketOrder(market, input.side, grams, notional);
    const before = portfolioFromBalances(balances.result, q.price);

    if (input.side === 'buy' && before.availableCashToman < notional) {
      throw new Error(`موجودی تومان قابل‌استفاده برای این خرید کافی نیست. موجودی قابل‌استفاده: ${before.availableCashToman} تومان.`);
    }
    if (input.side === 'sell' && before.availableGoldGrams < grams) {
      throw new Error(`موجودی طلای قابل‌استفاده برای این فروش کافی نیست. موجودی قابل‌استفاده: ${before.availableGoldGrams} گرم.`);
    }

    // Allocation is based on total assets; risk reserve is based on AVAILABLE cash.
    const totalCashAfter = round(before.cashToman + (input.side === 'sell' ? notional : -notional), 0);
    const availableCashAfter = round(before.availableCashToman + (input.side === 'sell' ? notional : -notional), 0);
    const totalGoldAfter = round(before.goldGrams + (input.side === 'buy' ? grams : -grams), 3);
    const availableGoldAfter = round(before.availableGoldGrams + (input.side === 'buy' ? grams : -grams), 3);
    const totalAfter = totalCashAfter + totalGoldAfter * q.price;
    const allocationAfter = totalAfter > 0 ? round(totalGoldAfter * q.price / totalAfter * 100, 2) : 0;

    const analysisAgeMinutes = latestAnalysis?.at ? Math.max(0, (Date.now() - Date.parse(latestAnalysis.at)) / 60000) : null;
    const decision = latestAnalysis?.decision && Number.isFinite(Number(latestAnalysis.decision?.confidence)) ? latestAnalysis.decision : undefined;
    const baseRisk = evaluateRisk({
      side: input.side,
      orderToman: notional,
      orderGrams: grams,
      cashAfter: availableCashAfter,
      goldAllocationAfter: allocationAfter,
      decision,
      policy,
    });

    const warnings: string[] = [];
    if (!decision) warnings.push('تحلیل بازار معتبر/ذخیره‌شده‌ای برای مقایسه با این پیش‌نمایش وجود ندارد.');
    else if (policy.requireAnalysisFreshMinutes > 0 && analysisAgeMinutes != null && analysisAgeMinutes > policy.requireAnalysisFreshMinutes) warnings.push(`آخرین تحلیل حدود ${Math.floor(analysisAgeMinutes)} دقیقه قدمت دارد و از حد تازگی سیاست (${policy.requireAnalysisFreshMinutes} دقیقه) قدیمی‌تر است.`);
    if (q.ttlSeconds != null && q.ttlSeconds < Math.max(8, config.wallgoldMinExecutionTtlSeconds + 2)) {
      warnings.push(`قیمت WallGold فقط حدود ${Math.max(0, Math.floor(q.ttlSeconds))} ثانیه دیگر اعتبار دارد؛ برای اجرا پیش‌نمایش تازه بگیر.`);
    }
    if (Number(market.otcFeeCoefficient) > 0) {
      warnings.push('کارمزد نهایی معامله را از پاسخ واقعی سفارش WallGold ملاک قرار بده؛ پیش‌نمایش مبلغ کارمزد را از موجودی کم نمی‌کند.');
    }
    const risk = mergeRisk(baseRisk, marketCheck.errors, warnings);

    const expiresFromQuote = q.priceExpiresAt ? Date.parse(q.priceExpiresAt) : NaN;
    const wallGoldNowMs = q.currentTime ? Date.parse(q.currentTime) : NaN;
    const localTtlDeadline = Date.now() + config.previewTtlSeconds * 1000;
    const quoteDeadline = Number.isFinite(expiresFromQuote) && Number.isFinite(wallGoldNowMs)
      ? Date.now() + Math.max(0, expiresFromQuote - wallGoldNowMs)
      : (Number.isFinite(expiresFromQuote) ? expiresFromQuote : Infinity);
    const expiresAtMs = Math.min(quoteDeadline, localTtlDeadline);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new Error('قیمت قابل معامله برای ساخت پیش‌نمایش معتبر نیست؛ دوباره قیمت بگیر.');
    }

    const payload = {
      v: 2,
      symbol,
      side: input.side,
      grams,
      quotedPrice: q.price,
      notionalToman: notional,
      createdAtMs: Date.now(),
      expiresAtMs,
      clientId: `wg-${randomUUID()}`,
    };

    return {
      symbol,
      sideFa: input.side === 'buy' ? 'خرید' : 'فروش',
      goldAmountGrams: grams,
      pricePerGramToman: q.price,
      notionalToman: notional,
      quoteExpiresAt: q.priceExpiresAt ?? new Date(expiresAtMs).toISOString(),
      quoteCurrentTime: q.currentTime ?? null,
      quoteTtlSeconds: q.ttlSeconds ?? null,
      marketLimits: marketCheck.limits,
      analysisContext: { latestAnalysisAt: latestAnalysis?.at ?? null, ageMinutes: analysisAgeMinutes, decision: decision ?? null },
      marketStatus: {
        buyEnabled: market.IsEnableBuySide ?? null,
        sellEnabled: market.IsEnableSellSide ?? null,
        buyStatus: market.buyStatus ?? null,
        sellStatus: market.sellStatus ?? null,
      },
      before,
      after: {
        cashToman: totalCashAfter,
        availableCashToman: availableCashAfter,
        goldGrams: totalGoldAfter,
        availableGoldGrams: availableGoldAfter,
        goldAllocationPct: allocationAfter,
      },
      risk,
      previewToken: signPreview(payload),
    };
  }

  async executePrivate(previewToken: string) {
    if (!config.previewSigningSecretIsStrong) {
      throw new Error('برای اجرای واقعی، PREVIEW_SIGNING_SECRET تصادفی و حداقل ۳۲ کاراکتری لازم است؛ مقدار پیش‌فرض توسعه قابل استفاده نیست.');
    }
    const p = verifyPreview(previewToken) as any;
    if (!config.privateExecutionEnabled) {
      throw new Error('درگاه اجرای خصوصی خاموش است. PRIVATE_EXECUTION_ENABLED=true لازم است.');
    }

    const [freshResponse, balancesResponse, marketsResponse, policy, latestAnalysis] = await Promise.all([
      this.wallgold.getPrivatePrice(p.symbol, p.side),
      this.wallgold.getBalances(),
      this.wallgold.getMarkets(),
      store.getPolicy(),
      store.latestAnalysis(),
    ]);
    const fresh = unwrapPrice(freshResponse);

    if (fresh.ttlSeconds == null || fresh.ttlSeconds < config.wallgoldMinExecutionTtlSeconds) {
      throw new Error(`قیمت WallGold برای اجرای امن زمان کافی ندارد (${fresh.ttlSeconds == null ? 'نامشخص' : `${Math.floor(fresh.ttlSeconds)} ثانیه`}). یک پیش‌نمایش تازه بگیر.`);
    }

    const slippage = Math.abs(fresh.price - p.quotedPrice) / p.quotedPrice * 100;
    if (slippage > 0.35) {
      throw new Error(`قیمت نسبت به پیش‌نمایش ${round(slippage, 2)}٪ تغییر کرده؛ معامله لغو شد و باید دوباره پیش‌نمایش بگیری.`);
    }
    const notional = round(p.grams * fresh.price, 0);

    const market = findMarket(marketsResponse.result, p.symbol);
    const precision = marketPrecision(marketsResponse.result, p.symbol);
    const marketCheck = validateInstantMarketOrder(market, p.side, p.grams, notional);
    if (!marketCheck.allowed) throw new Error(`شرایط لحظه‌ای بازار WallGold معامله را مجاز نمی‌داند: ${marketCheck.errors.join(' | ')}`);

    if (config.privateMaxOrderToman <= 0 && config.privateMaxOrderGrams <= 0) {
      throw new Error('برای اجرای خصوصی حداقل یکی از سقف‌های PRIVATE_MAX_ORDER_TOMAN یا PRIVATE_MAX_ORDER_GRAMS را تعریف کنید.');
    }
    if (config.privateMaxOrderToman > 0 && notional > config.privateMaxOrderToman) throw new Error('مبلغ از سقف اجرای خصوصی بیشتر است.');
    if (config.privateMaxOrderGrams > 0 && p.grams > config.privateMaxOrderGrams) throw new Error('مقدار طلا از سقف اجرای خصوصی بیشتر است.');
    if (policy.mode === 'advisor') throw new Error('سیاست مدیریت ریسک در حالت «مشاور» است؛ اجرای معامله مجاز نیست. ابتدا حالت را آگاهانه به حالت «همراه» تغییر دهید.');

    const previewAgeSeconds = Math.max(0, (Date.now() - Number(p.createdAtMs ?? 0)) / 1000);
    if (policy.maxQuoteAgeSeconds > 0 && previewAgeSeconds > policy.maxQuoteAgeSeconds) {
      throw new Error(`پیش‌نمایش ${Math.floor(previewAgeSeconds)} ثانیه قدمت دارد و از سقف سیاست (${policy.maxQuoteAgeSeconds} ثانیه) قدیمی‌تر است؛ پیش‌نمایش تازه بگیر.`);
    }

    const analysisAtMs = Date.parse(String(latestAnalysis?.at ?? ''));
    const analysisAgeMinutes = Number.isFinite(analysisAtMs) ? Math.max(0, (Date.now() - analysisAtMs) / 60000) : Infinity;
    const decision = latestAnalysis?.decision;
    if (policy.requireAnalysisFreshMinutes > 0) {
      if (!decision || !Number.isFinite(Number(decision?.confidence))) throw new Error('برای اجرای خصوصی، تحلیل بازار معتبر و ذخیره‌شده لازم است؛ ابتدا تحلیل تازه بساز.');
      if (analysisAgeMinutes > policy.requireAnalysisFreshMinutes) throw new Error(`آخرین تحلیل ${Math.floor(analysisAgeMinutes)} دقیقه قدمت دارد و از حد مجاز سیاست (${policy.requireAnalysisFreshMinutes} دقیقه) قدیمی‌تر است.`);
      const minConfidence = p.side === 'buy' ? policy.minConfidenceToBuy : policy.minConfidenceToSell;
      if (Number(decision.confidence) < minConfidence) throw new Error(`اطمینان آخرین تحلیل (${decision.confidence}٪) از حداقل سیاست برای ${p.side === 'buy' ? 'خرید' : 'فروش'} (${minConfidence}٪) کمتر است.`);
      if (policy.mode === 'autopilot') {
        const buySignals = new Set(['strong_buy','scale_buy','lean_buy']);
        const sellSignals = new Set(['sell','scale_sell','lean_sell']);
        const aligned = p.side === 'buy' ? buySignals.has(decision.signal) : sellSignals.has(decision.signal);
        if (!aligned) throw new Error('در حالت خودکار، جهت آخرین سیگنال بازار با سمت معامله هم‌راستا نیست.');
      }
    }

    const before = portfolioFromBalances(balancesResponse.result, fresh.price);
    if (p.side === 'buy' && before.availableCashToman < notional) throw new Error('موجودی تومان قابل‌استفاده فعلی برای این خرید کافی نیست.');
    if (p.side === 'sell' && before.availableGoldGrams < p.grams) throw new Error('موجودی طلای قابل‌استفاده فعلی برای این فروش کافی نیست.');

    const totalCashAfter = round(before.cashToman + (p.side === 'sell' ? notional : -notional), 0);
    const availableCashAfter = round(before.availableCashToman + (p.side === 'sell' ? notional : -notional), 0);
    const totalGoldAfter = round(before.goldGrams + (p.side === 'buy' ? p.grams : -p.grams), 3);
    const totalAfter = totalCashAfter + totalGoldAfter * fresh.price;
    const allocationAfter = totalAfter > 0 ? round(totalGoldAfter * fresh.price / totalAfter * 100, 2) : 0;
    const risk = evaluateRisk({
      side: p.side,
      orderToman: notional,
      orderGrams: p.grams,
      cashAfter: availableCashAfter,
      goldAllocationAfter: allocationAfter,
      decision,
      policy,
    });
    if (!risk.allowed) throw new Error(`سیاست مدیریت ریسک معامله را مسدود کرد: ${risk.blocks.join(' | ')}`);

    // Atomically reserve this preview and the 24h risk budget before the external write.
    // This closes the check-then-write race for concurrent requests in a single process.
    const claim = await store.claimTradeAttempt({
      type: 'trade_attempt',
      at: new Date().toISOString(),
      symbol: p.symbol,
      side: p.side,
      grams: p.grams,
      priceToman: fresh.price,
      notionalToman: notional,
      clientId: p.clientId,
      quoteExpiresAt: fresh.priceExpiresAt ?? null,
      quoteTtlSeconds: fresh.ttlSeconds,
      risk,
    }, {
      maxDailyTrades: policy.maxDailyTrades,
      maxDailyNotionalToman: policy.maxDailyNotionalToman,
    });
    if(!claim.claimed) throw new Error(claim.reason ?? 'این پیش‌نمایش برای اجرا قابل رزرو نیست.');

    let submitted;
    try {
      submitted = await this.wallgold.placeOrder({
        symbol: p.symbol,
        side: p.side,
        orderAmount: Number(p.grams).toFixed(precision),
        clientId: p.clientId,
      });
    } catch (error) {
      await store.addAudit({
        type: 'trade_ambiguous_or_failed',
        at: new Date().toISOString(),
        symbol: p.symbol,
        side: p.side,
        grams: p.grams,
        notionalToman: notional,
        clientId: p.clientId,
        error: wallGoldErrorFa(error),
      });
      throw new Error(`${wallGoldErrorFa(error)} اگر خطا هنگام ارسال سفارش رخ داده، وضعیت می‌تواند مبهم باشد؛ سفارش را در WallGold بررسی کن و این درخواست را خودکار تکرار نکن.`);
    }

    const orderId = submitted?.result?.orderId;
    await store.addAudit({
      type: 'trade_submitted',
      at: new Date().toISOString(),
      symbol: p.symbol,
      side: p.side,
      grams: p.grams,
      priceToman: fresh.price,
      notionalToman: notional,
      clientId: p.clientId,
      orderId: orderId ?? null,
      submitted: submitted?.result ?? submitted,
    });

    let reconciled = null;
    let reconciliationWarningFa: string | null = null;
    if (orderId != null && String(orderId).length > 0) {
      try {
        const status = await this.wallgold.getOrder(String(orderId));
        reconciled = status.result;
        await store.addAudit({
          type: 'trade',
          at: new Date().toISOString(),
          symbol: p.symbol,
          side: p.side,
          grams: p.grams,
          priceToman: fresh.price,
          notionalToman: notional,
          clientId: p.clientId,
          orderId: String(orderId),
          status: reconciled?.status ?? null,
          filledAmount: reconciled?.filledAmount ?? null,
          otcFee: reconciled?.otcFee ?? null,
          otcFeeCurrency: reconciled?.otcFeeCurrency ?? null,
          reconciled,
        });
      } catch (error) {
        reconciliationWarningFa = `سفارش ارسال شد اما خواندن وضعیت نهایی آن ناموفق بود: ${wallGoldErrorFa(error)}. سفارش را دوباره ارسال نکن؛ با شناسه سفارش در WallGold پیگیری کن.`;
        await store.addAudit({
          type: 'trade_reconciliation_failed',
          at: new Date().toISOString(),
          clientId: p.clientId,
          orderId: String(orderId),
          warning: reconciliationWarningFa,
        });
      }
    } else {
      reconciliationWarningFa = 'WallGold پاسخ ثبت سفارش را برگرداند اما شناسه سفارش در پاسخ قابل استخراج نبود؛ سفارش را دوباره ارسال نکن و حساب را بررسی کن.';
    }

    return {
      submitted: submitted.result,
      reconciled,
      reconciliationWarningFa,
      messageFa: reconciled
        ? `سفارش ثبت شد و با WallGold تطبیق داده شد. وضعیت: ${reconciled.status ?? 'نامشخص'}؛ مقدار انجام‌شده: ${reconciled.filledAmount ?? 'نامشخص'}.`
        : 'سفارش به WallGold ارسال شد؛ وضعیت نهایی هنوز به‌صورت قطعی تطبیق داده نشده است.',
    };
  }
}

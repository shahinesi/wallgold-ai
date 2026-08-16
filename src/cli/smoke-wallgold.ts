import { WallGoldClient, unwrapPrice } from '../wallgold/client.js';
import { config } from '../config.js';

const c = new WallGoldClient();
try {
  const markets = await c.getMarkets();
  console.log(JSON.stringify({
    publicApi: true,
    marketCount: markets.result?.length ?? 0,
    symbols: (markets.result ?? []).map(x => x.symbol),
  }, null, 2));

  if (!c.hasApiKey()) {
    console.log('WALLGOLD_API_KEY تنظیم نشده؛ تست private عمداً رد شد.');
    process.exit(0);
  }

  const [balances, quoteRaw] = await Promise.all([
    c.getBalances(),
    c.getPrivatePrice(config.wallgoldDefaultSymbol, 'sell'),
  ]);
  const quote = unwrapPrice(quoteRaw);
  console.log(JSON.stringify({
    privateApi: true,
    balanceCurrencies: balances.result.map(x => x.currency),
    quote: {
      symbol: config.wallgoldDefaultSymbol,
      side: 'sell',
      price: quote.price,
      ttlSeconds: quote.ttlSeconds ?? null,
      priceExpiresAt: quote.priceExpiresAt ?? null,
    },
    secretPrinted: false,
  }, null, 2));
} catch (e: any) {
  console.error(e?.message ?? 'خطای تست WallGold');
  process.exit(1);
}

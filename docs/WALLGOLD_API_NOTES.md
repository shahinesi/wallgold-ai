# قرارداد WallGold که در نسخه 0.2.0 استفاده می‌شود

مرجع: https://developers.wallgold.ir/fa/docs

Base URL پیش‌فرض:

```text
https://api.wallgold.ir
```

## Endpointها

### بازارها

```http
GET /api/v1/markets
```

Public است و برای هر سفارش باید response زنده آن مبنای محدودیت‌ها باشد. فیلدهای استفاده‌شده:

- `symbol`
- `baseAsset`, `baseAssetPrecision`
- `quoteAsset`, `quotePrecision`
- `otcFeeCoefficient`, `sltpFeeCoefficient`
- `minQty`, `maxQty`
- `minNotional`, `maxNotional`
- محدودیت‌های SLTP در صورت وجود
- `IsEnableBuySide`, `IsEnableSellSide`
- `buyStatus`, `sellStatus`

> محدودیت‌ها hard-code نشده‌اند؛ چون مقادیر live ممکن است تغییر کنند.

### موجودی

```http
GET /api/v1/account/balances
Authorization: Bearer <API_KEY>
```

- `amount`: کل موجودی
- `locked_amount`: بخش فریز‌شده
- موجودی قابل‌استفاده برای معامله: `max(0, amount - locked_amount)`
- asset allocation از کل دارایی محاسبه می‌شود، ولی trade capacity از available balance.

### قیمت اختصاصی قابل معامله

```http
GET /api/v1/account/price?symbol=GLD_18C_750TMN&side=buy|sell
Authorization: Bearer <API_KEY>
```

فیلدهای مهم:
- `price`
- `priceExpiresAt`
- `currentTime`
- `ttl`

قیمت کوتاه‌عمر است (راهنمای فعلی WallGold حدود ۳۰ ثانیه اعلام می‌کند). درخواست دوباره را نباید به‌عنوان تمدید تضمینی همان quote فرض کرد؛ `ttl`/`priceExpiresAt` هر response ملاک است. قیمت `side=buy` فقط برای خرید و `side=sell` فقط برای فروش استفاده می‌شود.

در صورت قیمت نامعتبر/منقضی ممکن است `INVALID_PRICE` دریافت شود.

### ثبت سفارش

```http
POST /api/v1/account/orders
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

بدنه:
- `symbol`
- `side`: `buy | sell`
- `orderAmount`: string؛ برای طلای فعلی حداکثر ۳ رقم اعشار در مستندات سفارش ذکر شده است.
- `clientId`: اختیاری؛ اگر ارسال شود باید unique باشد.

**نکته retry:** یکتا بودن `clientId` را معادل idempotency تضمین‌شده در نظر نگرفته‌ایم. POST سفارش auto-retry نمی‌شود.

### پیگیری سفارش

```http
GET /api/v1/account/orders/{orderId}
Authorization: Bearer <API_KEY>
```

بعد از POST برای reconciliation استفاده می‌شود. فیلدهای مهم:
- `orderId`, `clientId`
- `orderAmount`, `filledAmount`
- `price`, `totalPrice`
- `side`, `status`
- `fee`, `feeCurrency`
- `otcFee`, `otcFeeCurrency`
- `createdAt`, `updatedAt`

برای نتیجه مالی نهایی، مقدار `filledAmount`, وضعیت و کارمزد واقعی GET سفارش مهم‌تر از فرض «پرشدن کامل» هستند.

## API Key

مرجع: https://developers.wallgold.ir/fa/docs/api-key

- private endpointها با Bearer API Key کار می‌کنند.
- کلید را secret سمت سرور نگه دارید.
- API Key در ابزار MCP یا چت دریافت نمی‌شود.
- IP allowlist و rotation قبل از انقضا توصیه/پشتیبانی می‌شود.

راهنمای نصب امن: `docs/API_KEY_SETUP_FA.md`

# گزارش ساخت WallGold Copilot

## وضعیت

نسخه سورس: `0.2.0`

Audit کامل قرارداد فعلی WallGold در تاریخ `2026-08-16` روی docs، API Key، market، balance، private price، store order و get order انجام و mismatchهای critical/high اصلاح شدند. جزئیات: `docs/AUDIT_2026-08-16.md`.

## قابلیت‌های اصلی

- رابط پنج API فعلی WallGold
- موجودی کل / قفل‌شده / قابل‌استفاده
- قیمت واقعی قابل معامله کوتاه‌عمر و آگاه از زمان اعتبار
- live market constraints و buy/sell availability
- پرتفوی و ارزش تقریبی طلا/نقد
- موتور تحلیل شش‌بعدی با درصد اطمینان محاسباتی
- طلای جهانی، دلار/ریال، تکنیکال، اقتصاد کلان، اخبار/ژئوپلیتیک، حباب داخلی
- سناریو صعودی/خنثی/نزولی و نقطه ابطال تحلیل
- محاسبات تکنیکال
- سیاست مدیریت ریسک و خزانه
- پیش‌نمایش خرید/فروش
- بازمتعادل‌سازی، هشدار، برنامه خرید دوره‌ای و شرطی
- تاریخچه snapshot بازار
- معامله آزمایشی و بک‌تست
- کارت RTL فارسی ChatGPT
- HTTP MCP و STDIO MCP
- راهنمای API Key امن + ابزار بررسی اتصال بدون افشای secret
- مسیر اجرای خصوصی guarded و خاموش به‌صورت پیش‌فرض

## سخت‌گیری اجرای خصوصی بعد از Audit

- execution tool در حالت عمومی register نمی‌شود
- preview کوتاه‌عمر HMAC-signed؛ اجرای واقعی نیازمند secret تصادفی حداقل ۳۲ کاراکتری
- قیمت تازه + TTL واقعی قبل execution
- موجودی تازه و استفاده از `amount - locked_amount` برای capacity
- live market status + min/max qty/notional
- server hard caps
- Treasury/Risk policy
- الزام تحلیل ذخیره‌شده تازه و حداقل اطمینان سیاست برای اجرای خصوصی
- در حالت خودکار، الزام هم‌راستایی جهت سیگنال با سمت معامله
- فقط تحلیل HMAC-signed صادرشده از Decision Engine قابل ذخیره به‌عنوان تحلیل معتبر است
- سقف معاملات ۲۴ ساعت
- `clientId` فقط unique correlation ID؛ **نه تضمین idempotency**
- POST order بدون auto-retry
- consume preview قبل write برای جلوگیری از replay
- network ambiguity → عدم retry کور
- GET order بعد از POST برای reconciliation
- ثبت `status`, `filledAmount`, `otcFee`, `otcFeeCurrency`

## QA انجام‌شده

- syntax transpilation همه ۲۷ فایل TypeScript: بدون خطای نحوی
- اجرای ۱۰ تست runtime دامنه/قرارداد شامل موجودی قفل‌شده، محدودیت زنده بازار، تحلیل، مانیتورینگ، بازمتعادل‌سازی، بک‌تست و claim اتمیک: ۱۰/۱۰ PASS
- اجرای E2E Mock مسیر `preview → fresh quote/limits/risk → atomic claim → POST → GET reconciliation`: PASS
- تست replay: اجرای دوباره همان preview فقط یک POST ایجاد کرد: PASS
- تست concurrent replay: دو اجرای هم‌زمان همان preview فقط یک POST ایجاد کردند: PASS
- تست signed analysis token و جلوگیری از token-purpose confusion: PASS
- unit tests قبلی decision/rebalance/monitoring/backtest/technical
- اعتبارسنجی JSON manifest/package
- بررسی annotation اجرای معامله (`destructive=true`, `idempotent=false`)
- بررسی عدم چاپ API Key در smoke tool/output

## محدودیت محیط ساخت

`npm install` در محیط ساخت قبلی به‌دلیل محدودیت خروجی شبکه timeout شده بود؛ در نتیجه build نهایی با dependencyهای واقعی SDK باید روی محیط دارای اینترنت اجرا شود:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run smoke:wallgold
```

## باقی‌مانده‌های production architecture

1. اتصال عمومی چندکاربره هنوز نیازمند OAuth 2.1 برای MCP و integration رسمی/تفویض دسترسی از WallGold است؛ Plugin عمومی نباید API Key خام کاربران را جمع‌آوری یا پردازش کند.
2. Provider مستقل 24/7 برای XAU/USD، USD/IRR، macro و news هنوز وجود ندارد؛ ChatGPT workflow فعلی از Web Search میزبان برای Evidence gathering استفاده می‌کند.
3. JSON Store باید برای production multi-user با DB transactional + tenant isolation + immutable audit جایگزین شود.
4. انتشار عمومی باید قواعد OpenAI و مجوز/شرایط استفاده عمومی از API/برند WallGold را پاس کند؛ execution سرمایه‌گذاری در Plugin عمومی فعال نمی‌شود.

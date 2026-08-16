# امنیت WallGold Copilot

## Credential

1. متغیر اصلی credential فقط `WALLGOLD_API_KEY` است. `WALLGOLD_TOKEN` صرفاً alias سازگاری نسخه قدیمی است.
2. API Key هرگز input/output ابزار MCP، Skill، Prompt، manifest، log یا audit record نیست.
3. برای استفاده شخصی، کلید در environment/Secret Manager سرور قرار می‌گیرد.
4. برای Plugin عمومی چندکاربره، Shared API Key یا دریافت/ذخیره API Key خام کاربران مسیر قابل‌قبولی نیست؛ OAuth 2.1 برای هویت ChatGPT/Codex و integration رسمی/تفویض دسترسی مورد توافق WallGold لازم است. vault کلید خام فقط در deployment خصوصی/سازمانی خارج از Plugin عمومی قابل بررسی است.
5. از IP allowlist خود WallGold برای محدودکردن کلید به IP خروجی ثابت سرور استفاده شود.
6. کلیدهای ۳۰/۶۰/۹۰ روزه قبل از انقضا rotate شوند و در صورت احتمال نشت فوراً revoke شوند.

## اجرای سفارش

1. `WALLGOLD_MCP_ALLOW_TRADE_EXECUTION=false` پیش‌فرض است و برای Plugin عمومی باید false بماند.
2. `PRIVATE_EXECUTION_ENABLED=true` و حداقل یکی از سقف‌های `PRIVATE_MAX_ORDER_TOMAN` / `PRIVATE_MAX_ORDER_GRAMS` برای اجرای خصوصی لازم است.
3. پیش‌نمایش HMAC-signed و کوتاه‌عمر است؛ `PREVIEW_SIGNING_SECRET` باید تصادفی و حداقل ۳۲ کاراکتر باشد. اجرای واقعی با مقدار پیش‌فرض توسعه یا secret کوتاه fail-closed می‌شود.
4. پیش از POST سفارش، قیمت خصوصی، TTL، موجودی، وضعیت بازار، محدودیت‌های `min/max` و سیاست مدیریت ریسک دوباره با داده تازه کنترل می‌شوند.
5. ظرفیت خرید/فروش از **موجودی قابل‌استفاده = amount - locked_amount** محاسبه می‌شود؛ موجودی قفل‌شده قابل خرج/فروش فرض نمی‌شود.
6. اجرای خصوصی اگر TTL قیمت از `WALLGOLD_MIN_EXECUTION_TTL_SECONDS` کمتر باشد متوقف می‌شود.
7. تغییر قیمت بیش از ۰٫۳۵٪ نسبت به پیش‌نمایش، اجرای آن preview را متوقف می‌کند.
8. `clientId` فقط شناسه یکتای client است. مستندات WallGold تضمین idempotency برای retry ارائه نکرده‌اند؛ POST سفارش auto-retry نمی‌شود و Tool `idempotentHint=false` دارد.
9. پیش از POST یک `trade_attempt` ثبت می‌شود تا همان preview دوباره مصرف نشود. اگر network failure پس از ارسال رخ دهد، وضعیت «مبهم» تلقی می‌شود و retry کور ممنوع است.
10. بعد از POST موفق، `orderId` با GET سفارش reconcile می‌شود و `status`, `filledAmount`, `otcFee` و `otcFeeCurrency` در audit ثبت می‌شوند.
11. شکست reconciliation به معنی «ارسال دوباره سفارش» نیست؛ کاربر باید همان `orderId` را پیگیری کند.
12. Fee نهایی از پاسخ واقعی سفارش ملاک است؛ preview فعلی fee را از موجودی پیش‌بینی‌شده کم نمی‌کند.

## MCP / Network

1. MCP راه‌دور production باید HTTPS باشد.
2. `MCP_SHARED_BEARER` فقط برای private single-user deployment ساده قابل قبول است؛ برای محصول چندکاربره OAuth 2.1 لازم است.
3. Host/Origin allowlist دفاع کمکی است و جای authentication/authorization را نمی‌گیرد.
4. درخواست WallGold timeout دارد و response body خطا مستقیم در پیام user-facing چاپ نمی‌شود.
5. ابزارهای destructive باید confirmation/approval میزبان را حفظ کنند و annotation واقعی داشته باشند.

## Storage

JSON Store این repo برای prototype/private deployment است. برای production:
- PostgreSQL یا storage پایدار
- encryption-at-rest
- immutable/append-only audit برای execution
- backup و retention policy
- tenant isolation برای multi-user
- secret vault جدا از business DB

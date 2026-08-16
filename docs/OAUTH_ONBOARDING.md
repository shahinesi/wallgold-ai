# اتصال OAuth حساب WallGold به ChatGPT

نسخه `0.3.0` برای اتصال حساب خصوصی WallGold به MCP از OAuth 2.1-style Authorization Code + PKCE S256 استفاده می‌کند.

## تجربه کاربر

1. Plugin در ChatGPT با Authentication = OAuth ساخته می‌شود.
2. ChatGPT از Protected Resource Metadata و Authorization Server Metadata آدرس‌های OAuth را کشف می‌کند.
3. کلاینت ChatGPT با Dynamic Client Registration برای prototype ثبت می‌شود.
4. مرورگر صفحه فارسی `WallGold AI` را باز می‌کند.
5. کاربر API Key WallGold را فقط در همان صفحه HTTPS وارد می‌کند.
6. سرور با `GET /api/v1/account/balances` اعتبار کلید را مستقیم با WallGold بررسی می‌کند.
7. در صورت موفقیت، authorization code کوتاه‌عمر صادر می‌شود و ChatGPT با PKCE آن را به access/refresh token تبدیل می‌کند.
8. هر درخواست MCP با Bearer access token وارد می‌شود و API Key متناظر فقط در AsyncLocalStorage همان request به WallGoldClient می‌رسد.

## endpointها

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server`
- `/oauth/register`
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/revoke`
- `/mcp`

## امنیت prototype Codespaces

- API Key در tool input، prompt، URL، log یا فایل ذخیره نمی‌شود.
- API Key، access token و refresh token فقط در RAM هستند.
- restart شدن process همه sessionهای OAuth را باطل می‌کند؛ کاربر باید دوباره Connect کند.
- فقط OAuth client metadata عمومی در `DATA_DIR/oauth-clients.json` ذخیره می‌شود تا client_id پس از restart قابل تشخیص باشد.
- callbackهای DCR فقط روی HTTPS و دامنه‌های `openai.com` / `chatgpt.com` و زیردامنه‌های آن‌ها پذیرفته می‌شوند.
- PKCE S256 اجباری است.
- authorization code یک‌بارمصرف و ۵ دقیقه‌ای است.
- access token یک ساعت و refresh token حداکثر ۳۰ روز اعتبار دارد، ولی چون همه tokenها memory-only هستند restart زودتر آن‌ها را باطل می‌کند.
- endpoint MCP بدون Bearer معتبر `401` و `WWW-Authenticate` مطابق Protected Resource Metadata برمی‌گرداند.
- اجرای معامله واقعی در Codespaces خاموش است.

## محدودیت production

این implementation برای prototype شخصی/تست Developer Mode ساخته شده است. برای محصول چندکاربره باید Authorization Server و credential vault پایدار، encrypted-at-rest، tenant isolation، database transactional، key rotation، audit و deployment پایدار جایگزین memory store شود. همچنین DCR برای سازگاری prototype استفاده شده؛ در نسخه‌های جدید MCP، Client ID Metadata Documents مسیر ترجیحی جدید هستند و باید در production بررسی/پیاده‌سازی شوند.

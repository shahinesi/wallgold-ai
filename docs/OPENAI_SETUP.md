# اتصال WallGold Copilot به ChatGPT و Codex

## ۱) آماده‌سازی پروژه

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run build
```

API Key وال‌گلد را فقط در `.env` خصوصی یا Secret Manager سرور قرار بده:

```bash
WALLGOLD_API_KEY=...
```

**کلید را در Skill، Prompt، manifest، MCP argument یا خود گفتگو قرار نده.** مراحل امن ساخت کلید در `API_KEY_SETUP_FA.md` است.

## ۲) Codex — MCP محلی با STDIO

بعد از build، `dist/stdio.js` MCP محلی است:

```bash
codex mcp add wallgold \
  --env WALLGOLD_API_KEY="$WALLGOLD_API_KEY" \
  --env PREVIEW_SIGNING_SECRET="$PREVIEW_SIGNING_SECRET" \
  -- node /ABSOLUTE/PATH/wallgold-copilot/dist/stdio.js
```

برای استفاده عادی:

```text
WALLGOLD_MCP_ALLOW_TRADE_EXECUTION=false
```

## ۳) Codex — MCP راه‌دور

MCP HTTP را روی HTTPS deploy کن و در تنظیمات Codex به endpoint `/mcp` وصل کن. برای single-user private deployment می‌توان از bearer اختصاصی استفاده کرد. برای multi-user باید OAuth 2.1 واقعی پیاده شود.

## ۴) ChatGPT Developer Mode

1. MCP را با Streamable HTTP روی HTTPS قابل دسترس اجرا کن (یا برای توسعه از Secure MCP Tunnel استفاده کن).
2. در ChatGPT، `Settings → Security and login → Developer mode` را فعال کن.
3. در Plugins، اتصال جدید بساز و URL کامل `https://YOUR-HOST.example/mcp` را وارد کن.
4. metadata/tools را Refresh کن.
5. ابتدا `get_wallgold_markets` و سپس `check_wallgold_connection` را تست کن.
6. بعد از صحت authentication، `get_portfolio` و `preview_trade` را تست کن.
7. Execution واقعی را در اتصال عمومی فعال نکن.

## ۵) Single-user vs Multi-user

### Single-user/private

```text
ChatGPT/Codex → authenticated MCP → server secret WALLGOLD_API_KEY → WallGold
```

این همان mode فعلی repo است.

### Multi-user/product

برای Plugin عمومی، گرفتن یا ذخیره API Key خام WallGold از کاربر را مسیر محصول در نظر نگیر. معماری هدف باید این باشد:

```text
ChatGPT/Codex
      │ OAuth 2.1
      ▼
MCP Gateway + user identity
      │ اتصال رسمی / token delegation مورد توافق WallGold
      ▼
WallGold
```

OAuth resource metadata، authorization server، PKCE/scopes و scope enforcement باید اضافه شوند. برای اتصال حساب واقعی WallGold نیز باید integration رسمی‌ای داشته باشیم که کاربر مجبور به دادن API Key/OTP/password خام به Plugin نباشد.

## ۶) Plugin packaging

`plugin/` شامل manifest و Skillهای فارسی است. برای ChatGPT/Directory با قابلیت live data، مسیر درست انتشار **MCP endpoint راه‌دور HTTPS + Skillها در همان submission** است؛ فایل local STDIO به‌تنهایی مسیر انتشار عمومی ChatGPT نیست.

برای توسعه Codex می‌توان STDIO همین repo را جداگانه register کرد. فایل `.mcp.json.example` فقط نمونه است و چون path نهایی installation را نمی‌دانیم عمداً به manifest عمومی bind نشده است.

## ۷) محدودیت انتشار عمومی

نسخه عمومی در وضعیت فعلی:
- تحلیل بازار، داده‌های عمومی market، بک‌تست و UI بدون اطلاعات حساب شخصی قابل ارائه‌اند.
- portfolio، قیمت خصوصی و preview وابسته به حساب فقط بعد از OAuth 2.1 و اتصال رسمی/مجاز WallGold برای کاربران قابل انتشار هستند.
- **اجرای خرید/فروش سرمایه‌گذاری نباید در Plugin عمومی expose شود.**
- برای انتشار رسمی با برند/API سرویس شخص ثالث، مجوز WallGold و شرایط استفاده آن نیز باید جدا تأیید شود؛ Plugin عمومی نباید یک connector غیررسمی pass-through باشد.

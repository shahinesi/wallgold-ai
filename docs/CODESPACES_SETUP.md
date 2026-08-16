# اجرای WallGold AI با GitHub Codespaces

این مسیر فقط برای اولین تست اتصال MCP به ChatGPT Developer Mode است.

## اصل امنیتی مرحله اول

در مرحله discovery اولیه:

- `WALLGOLD_API_KEY` را در Codespaces تنظیم نکنید.
- اجرای واقعی معامله خاموش است.
- MCP بدون احراز هویت بالا می‌آید تا ChatGPT بتواند ابزارها را discover کند.
- پورت 3000 در Codespaces به‌صورت پیش‌فرض Private است؛ فقط هنگام تست ChatGPT آن را موقتاً Public کنید.

ChatGPT Developer Mode در حال حاضر برای MCP از OAuth، No Authentication و Mixed Authentication پشتیبانی می‌کند. Bearer ثابت سفارشی روش اتصال مستقیم ChatGPT نیست؛ بنابراین اتصال دارای داده خصوصی WallGold در مرحله بعد باید OAuth شود.

## ساخت Codespace

1. وارد repository شوید.
2. `Code` → `Codespaces` → `Create codespace on main`.
3. ساخت container منتظر `npm install` و `npm run build` می‌ماند.
4. MCP پس از start به‌صورت خودکار روی port `3000` اجرا می‌شود.
5. از ترمینال بررسی کنید:

```bash
curl http://127.0.0.1:3000/health
```

باید پاسخ `ok: true` بگیرید.

## عمومی‌کردن موقت پورت برای ChatGPT

در تب `PORTS` روی port `3000` راست‌کلیک کنید و `Port Visibility` را روی `Public` بگذارید.

GitHub آدرسی شبیه این می‌دهد:

```text
https://<CODESPACE-NAME>-3000.app.github.dev
```

آدرس MCP:

```text
https://<CODESPACE-NAME>-3000.app.github.dev/mcp
```

توجه: GitHub ممکن است visibility پورت را بعد از stop/restart دوباره Private کند؛ قبل از هر تست بررسی کنید.

## اتصال به ChatGPT

1. در ChatGPT وب، Developer Mode را فعال کنید.
2. به ChatGPT Plugins بروید.
3. یک developer-mode app جدید بسازید.
4. URL بالا با `/mcp` را وارد کنید.
5. Authentication را برای این مرحله روی `No Authentication` قرار دهید.
6. ابزارها را refresh/discover کنید.

## قبل از اضافه‌کردن API Key واقعی WallGold

این مرحله فقط وقتی مجاز است که احراز هویت OAuth برای MCP اضافه شده باشد. تا قبل از آن، API Key، موجودی خصوصی یا execution واقعی را روی یک public Codespaces port فعال نکنید.

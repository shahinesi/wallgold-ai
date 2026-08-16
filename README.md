# WallGold Copilot — دستیار فارسی هوشمند طلا

**نسخه: 0.3.0 — OAuth Account Connection — 2026-08-16**

این پروژه یک MCP Server + Plugin برای ChatGPT و Codex است که هدفش فقط «نمایش قیمت» نیست؛ یک لایه تصمیم‌یار کامل برای طلا می‌سازد:

- مشاهده بازار و موجودی WallGold
- اتصال امن حساب WallGold با OAuth و صفحه فارسی ورود API Key
- قیمت واقعی قابل معامله خرید/فروش با زمان انقضا
- ارزش‌گذاری پرتفوی و سهم طلا/نقد
- تحلیل شش‌بعدی: **طلای جهانی، دلار/ریال، تکنیکال، اقتصاد کلان، اخبار/ژئوپلیتیک، حباب داخلی**
- امتیاز -100 تا +100 و **درصد اطمینان محاسباتی** مبتنی بر پوشش، تازگی و اختلاف شواهد
- سناریوی صعودی / خنثی / نزولی
- «چه چیزی نظر را عوض می‌کند؟» و عامل منتقد مخالف
- سیاست مدیریت ریسک و خزانه
- پیش‌نمایش خرید/فروش با اثر روی موجودی و تخصیص دارایی
- قوانین هشدار، تصویر لحظه‌ای تحلیل، معامله آزمایشی
- بک‌تست سیگنال
- مسیر اجرای خصوصی جدا و خاموش به‌صورت پیش‌فرض

## خروجی کاملاً فارسی

تمام عنوان‌ها، توضیح‌ها، تصمیم‌ها و وضعیت‌هایی که کاربر می‌بیند فارسی طراحی شده‌اند. نام داخلی Toolها انگلیسی مانده تا قرارداد MCP پایدار و قابل نگهداری باشد.

نمونه خروجی مورد انتظار:

```text
تصمیم: خرید پله‌ای
درصد اطمینان: ۷۴٪

طلای جهانی: صعودی
دلار / ریال: صعودی
تحلیل تکنیکال: خنثی
اقتصاد کلان: نزولی
اخبار و ژئوپلیتیک: صعودی
حباب و پریمیوم بازار داخلی: خنثی

سناریوی صعودی: ...
سناریوی نزولی: ...
چه چیزی نظر را عوض می‌کند؟ ...
```

## شروع محلی

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

MCP روی `http://127.0.0.1:3000/mcp` و health روی `/health` بالا می‌آید.

برای local/STDIO می‌توان API Key را فقط در Secret Manager یا `WALLGOLD_API_KEY` محیط اجرا گذاشت. API Key را داخل ChatGPT/Codex paste نکن.

## اتصال ChatGPT با OAuth

در GitHub Codespaces، OAuth به‌صورت پیش‌فرض فعال است. پورت 3000 را Public کن و در ChatGPT Plugin آدرس زیر را با Authentication = OAuth بده:

```text
https://<codespace>-3000.app.github.dev/mcp
```

ChatGPT باید OAuth metadata را کشف کند و یک صفحه فارسی WallGold AI برای واردکردن API Key باز کند. کلید در آن صفحه مستقیماً با WallGold اعتبارسنجی می‌شود، هرگز به prompt/tool input نمی‌رود و در prototype Codespaces روی دیسک ذخیره نمی‌شود. جزئیات: [`docs/OAUTH_ONBOARDING.md`](docs/OAUTH_ONBOARDING.md).

## امنیت و اجرای معامله

نسخه عمومی/قابل‌انتشار Plugin **هیچ ابزار اجرای معامله‌ای advertise نمی‌کند**. `preview_trade` فقط پیش‌نمایش می‌سازد.

برای محیط خصوصی، کد اجرای واقعی وجود دارد اما سه قفل دارد:

1. `PRIVATE_EXECUTION_ENABLED=true`
2. تعریف سقف مبلغ یا گرم در env
3. اجرای دستی CLI با `--yes-i-understand`

```bash
npm run trade:private -- --preview-token 'TOKEN' --yes-i-understand
```

برای MCP خصوصی می‌توان `WALLGOLD_MCP_ALLOW_TRADE_EXECUTION=true` کرد؛ این حالت برای Plugin عمومی مناسب نیست. مسیر execution بعد از Audit، TTL واقعی قیمت، موجودی قابل‌استفاده (با کسر locked)، محدودیت زنده بازار، سقف‌های ریسک، جلوگیری از retry کور و reconciliation با GET سفارش را بررسی می‌کند.

## منبع داده هوشمند

WallGold لایه account/execution/quote را می‌دهد. برای اخبار، طلای جهانی، ماکرو و دلار/ریال، Skill طوری نوشته شده که ChatGPT در صورت داشتن Web Search داده تازه را از وب جمع‌آوری کند و سپس شواهد ساختاریافته را به `analyze_gold_market` بدهد. این طراحی جلوی ساختن اعداد از روی حدس LLM را می‌گیرد.

برای محصول مستقل خارج از ChatGPT، بعداً Providerهای اختصاصی market/news/macro را می‌توان به همان Evidence contract وصل کرد.

## نکته انتشار عمومی

قابلیت‌های وابسته به حساب WallGold برای انتشار عمومی نیازمند integration رسمی/مجاز WallGold و معماری production-grade authorization/credential storage هستند. اجرای واقعی معامله خصوصی می‌ماند و در Codespaces/Plugin عمومی خاموش است.

## Audit مستندات WallGold

گزارش کامل Audit و mismatchهای اصلاح‌شده: [`docs/AUDIT_2026-08-16.md`](docs/AUDIT_2026-08-16.md). قرارداد endpointها و فیلدها: [`docs/WALLGOLD_API_NOTES.md`](docs/WALLGOLD_API_NOTES.md).

## اتصال API Key بدون افشای secret

OAuth onboarding کاربر را به صفحه HTTPS خود WallGold AI می‌برد. API Key فقط همان‌جا وارد می‌شود، با WallGold اعتبارسنجی می‌شود و به session OAuth متصل می‌شود؛ مدل و tool schema هیچ فیلدی برای دریافت API Key ندارند.

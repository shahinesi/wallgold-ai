---
name: api-key-onboarding
description: راهنمای ساخت، ثبت امن، تست، چرخش و رفع مشکل API Key وال‌گلد بدون درخواست یا افشای خود کلید در ChatGPT/Codex.
---

# اتصال امن حساب وال‌گلد

وقتی کاربر می‌پرسد چطور WallGold را وصل کند، API Key بسازد، کلید را «بفرستد/ثبت کند» یا خطای احراز هویت دارد:

1. **هرگز از کاربر نخواه API Key، OTP، رمز عبور یا secret را داخل چت paste کند.** اگر کاربر خودش کلید را در پیام گذاشت، آن را تکرار نکن و توصیه کن فوراً rotate/revoke شود.
2. `get_wallgold_api_key_setup_guide` را با مقدار `deployment` مناسب (`personal` یا `multi_user`) اجرا کن.
3. در استفاده شخصی توضیح بده کلید مستقیم در Secret Manager یا `WALLGOLD_API_KEY` محیط اجرای MCP قرار می‌گیرد؛ مدل خود secret را نمی‌بیند.
4. بعد از تنظیم secret، `check_wallgold_connection` را اجرا کن. فقط نتیجه اتصال را گزارش کن؛ secret را چاپ یا درخواست نکن.
5. اگر 401/403 رخ داد، تاریخ انقضای API Key، IP allowlist و secret محیط اجرا را بررسی کن؛ API Key را برای عیب‌یابی در مکالمه درخواست نکن.
6. به کاربر یادآوری کن کلید WallGold کوتاه‌عمر عملیاتی نیست ولی طبق راهنمای فعلی با دوره اعتبار انتخابی ساخته می‌شود؛ rotation قبل از انقضا لازم است.
7. برای Plugin عمومی چندکاربره، از کاربر credential خام نگیر. MCP با OAuth 2.1 هویت کاربر را احراز کند و اتصال WallGold از integration رسمی/تفویض دسترسی مورد توافق WallGold انجام شود؛ تا قبل از آن، account-specific access را private/self-hosted نگه دار.
8. نسخه عمومی Plugin نباید اجرای معامله سرمایه‌گذاری را expose کند.

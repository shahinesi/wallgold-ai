import type { ComponentKey, DecisionSignal, Direction } from '../domain/types.js';

export const componentLabelFa: Record<ComponentKey, string> = {
  globalGold: 'طلای جهانی',
  usdIrr: 'دلار / ریال',
  technical: 'تحلیل تکنیکال',
  macro: 'اقتصاد کلان',
  news: 'اخبار و ژئوپلیتیک',
  localPremium: 'حباب و اختلاف قیمت بازار داخلی',
};

export const directionFa: Record<Direction, string> = {
  bullish: 'صعودی',
  bearish: 'نزولی',
  neutral: 'خنثی',
};

export const signalFa: Record<DecisionSignal, string> = {
  strong_buy: 'خرید قوی',
  scale_buy: 'خرید پله‌ای',
  lean_buy: 'تمایل به خرید',
  wait: 'صبر',
  hold: 'نگهداری',
  lean_sell: 'تمایل به فروش',
  scale_sell: 'فروش پله‌ای',
  sell: 'فروش',
};

export const faNumber = (n: number, maxFractionDigits = 2) =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: maxFractionDigits }).format(n);

export const directionEmoji: Record<Direction, string> = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '🟡',
};

export function formatDecisionFa(d: import('../domain/types.js').MarketDecision) {
  const lines = [
    `تصمیم: ${d.signalFa}`,
    `درصد اطمینان: ${faNumber(d.confidence, 0)}٪`,
    `امتیاز کلی: ${faNumber(d.score, 1)} از ۱۰۰`,
    `پوشش داده: ${faNumber(d.coverage, 0)}٪`,
    `اختلاف میان مؤلفه‌ها: ${faNumber(d.disagreement, 0)}٪`,
    '',
    ...d.components.map(c => `${c.labelFa}: ${directionEmoji[c.direction]} ${c.directionFa} — امتیاز ${faNumber(c.score, 1)}، اطمینان ${faNumber(c.confidence, 0)}٪`),
    '',
    `سناریوی صعودی: ${faNumber(d.scenarioProbabilities.up, 0)}٪`,
    `سناریوی خنثی: ${faNumber(d.scenarioProbabilities.sideways, 0)}٪`,
    `سناریوی نزولی: ${faNumber(d.scenarioProbabilities.down, 0)}٪`,
  ];
  if (d.invalidationFa.length) lines.push('', 'چه چیزی می‌تواند این دیدگاه را تغییر دهد؟', ...d.invalidationFa.map((x,i)=>`${faNumber(i+1,0)}. ${x}`));
  if (d.warningsFa.length) lines.push('', 'هشدارها:', ...d.warningsFa.map(x=>`• ${x}`));
  return lines.join('\n');
}

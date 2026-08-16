import type { MarketDecision, TreasuryPolicy } from './types.js';
export function evaluateRisk(args:{side:'buy'|'sell'; orderToman:number; orderGrams:number; cashAfter:number; goldAllocationAfter:number|null; decision?:MarketDecision; policy:TreasuryPolicy}){
  const {policy}=args; const blocks:string[]=[]; const warnings:string[]=[];
  if(policy.maxTradeToman<=0 && policy.maxTradeGrams<=0) blocks.push('سقف معامله در سیاست مدیریت ریسک تعریف نشده است.');
  if(policy.maxTradeToman>0 && args.orderToman>policy.maxTradeToman) blocks.push('مبلغ معامله از سقف مجاز سیاست مدیریت ریسک بیشتر است.');
  if(policy.maxTradeGrams>0 && args.orderGrams>policy.maxTradeGrams) blocks.push('مقدار طلا از سقف مجاز سیاست مدیریت ریسک بیشتر است.');
  if(args.cashAfter<policy.minCashReserveToman) blocks.push('ذخیره نقدی پس از معامله از حداقل تعیین‌شده کمتر می‌شود.');
  if(args.goldAllocationAfter!=null && policy.maxGoldAllocationPct>0 && args.goldAllocationAfter>policy.maxGoldAllocationPct && args.side==='buy') blocks.push('سهم طلا پس از خرید از سقف تخصیص مجاز عبور می‌کند.');
  if(args.decision){ const min=args.side==='buy'?policy.minConfidenceToBuy:policy.minConfidenceToSell; if(args.decision.confidence<min) warnings.push(`اطمینان تحلیل (${args.decision.confidence}٪) از حد ترجیحی سیاست مدیریت ریسک (${min}٪) کمتر است.`); }
  if(policy.mode==='advisor') warnings.push('سیاست مدیریت ریسک در حالت مشاور است؛ اجرای خودکار مجاز نیست.');
  return {allowed:blocks.length===0,blocks,warnings};
}

import { round } from '../utils/math.js';

export function calculateRebalance(args:{
  cashToman:number;
  goldGrams:number;
  goldPriceToman:number;
  targetGoldAllocationPct:number;
  tolerancePct?:number;
}){
  const {cashToman,goldGrams,goldPriceToman,targetGoldAllocationPct}=args;
  const tolerancePct=args.tolerancePct ?? 0.5;
  if(goldPriceToman<=0) throw new Error('قیمت طلا باید بیشتر از صفر باشد.');
  if(targetGoldAllocationPct<0||targetGoldAllocationPct>100) throw new Error('هدف تخصیص طلا باید بین صفر تا صد باشد.');
  const goldValue=goldGrams*goldPriceToman;
  const total=cashToman+goldValue;
  const currentPct=total>0?goldValue/total*100:0;
  const targetGoldValue=total*targetGoldAllocationPct/100;
  const delta=targetGoldValue-goldValue;
  const driftPct=currentPct-targetGoldAllocationPct;
  const noAction=Math.abs(driftPct)<=tolerancePct || Math.abs(delta)<1;
  return {
    totalValueToman:round(total,0),
    currentGoldAllocationPct:round(currentPct,2),
    targetGoldAllocationPct:round(targetGoldAllocationPct,2),
    driftPct:round(driftPct,2),
    action:noAction?'none':delta>0?'buy':'sell' as 'none'|'buy'|'sell',
    actionFa:noAction?'نیازی به معامله نیست':delta>0?'خرید برای بازمتعادل‌سازی':'فروش برای بازمتعادل‌سازی',
    estimatedTomanAmount:noAction?0:round(Math.abs(delta),0),
  };
}

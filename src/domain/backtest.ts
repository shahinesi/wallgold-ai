import { round } from '../utils/math.js';
export interface BacktestPoint { time:string; price:number; signalScore:number; }
export function backtest(points:BacktestPoint[], initialCash=100_000_000, buyThreshold=35, sellThreshold=-35) {
  if(points.length<2) throw new Error('داده کافی برای بک‌تست وجود ندارد.');
  let cash=initialCash, gold=0, entry=0, wins=0, completed=0; const equity:number[]=[]; const trades:any[]=[];
  for(const p of points){
    if(p.signalScore>=buyThreshold && gold===0){ gold=cash/p.price; entry=p.price; cash=0; trades.push({time:p.time,action:'خرید',price:p.price}); }
    else if(p.signalScore<=sellThreshold && gold>0){ cash=gold*p.price; if(p.price>entry)wins++; completed++; gold=0; trades.push({time:p.time,action:'فروش',price:p.price}); }
    equity.push(cash+gold*p.price);
  }
  const finalEquity=equity.at(-1)!; let peak=equity[0], maxDd=0;
  for(const e of equity){peak=Math.max(peak,e); maxDd=Math.max(maxDd,(peak-e)/peak*100)}
  return { initialCash, finalEquity:round(finalEquity,0), returnPct:round((finalEquity/initialCash-1)*100,2), maxDrawdownPct:round(maxDd,2), completedTrades:completed, winRatePct:completed?round(wins/completed*100,1):0, trades:trades.slice(-100) };
}

import { clamp, round } from '../utils/math.js';

export interface Candle { time: string; open: number; high: number; low: number; close: number; volume?: number; }

function ema(values: number[], period: number) {
  if (!values.length) return [];
  const k = 2/(period+1); const out=[values[0]];
  for (let i=1;i<values.length;i++) out.push(values[i]*k+out[i-1]*(1-k));
  return out;
}
function rsi(values:number[], period=14) {
  if (values.length <= period) return null;
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){ const d=values[i]-values[i-1]; if(d>=0) gains+=d; else losses-=d; }
  let ag=gains/period, al=losses/period;
  for(let i=period+1;i<values.length;i++){ const d=values[i]-values[i-1]; ag=(ag*(period-1)+Math.max(d,0))/period; al=(al*(period-1)+Math.max(-d,0))/period; }
  if(al===0) return 100; const rs=ag/al; return 100-(100/(1+rs));
}
function atr(c:Candle[], period=14){
  if(c.length<period+1) return null;
  const tr:number[]=[];
  for(let i=1;i<c.length;i++) tr.push(Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close)));
  return tr.slice(-period).reduce((a,b)=>a+b,0)/period;
}

export function technicalAnalysis(candles:Candle[]) {
  if(candles.length < 35) throw new Error('برای تحلیل تکنیکال حداقل ۳۵ کندل لازم است.');
  const closes=candles.map(c=>c.close);
  const e20=ema(closes,20).at(-1)!; const e50=ema(closes,50).at(-1) ?? ema(closes, Math.min(34,closes.length)).at(-1)!;
  const e12=ema(closes,12); const e26=ema(closes,26);
  const macd=e12.at(-1)!-e26.at(-1)!;
  const macdSeries=e12.slice(-Math.min(e12.length,e26.length)).map((v,i)=>v-e26[e26.length-Math.min(e12.length,e26.length)+i]);
  const signal=ema(macdSeries,9).at(-1) ?? 0;
  const r=rsi(closes,14); const a=atr(candles,14); const price=closes.at(-1)!;
  let score=0;
  score += price>e20 ? 18 : -18;
  score += e20>e50 ? 18 : -18;
  score += macd>signal ? 18 : -18;
  if(r!=null){ if(r>=55&&r<=72) score+=16; else if(r<45) score-=16; else if(r>78) score-=8; }
  const lookback=candles.slice(-20);
  const support=Math.min(...lookback.map(c=>c.low)); const resistance=Math.max(...lookback.map(c=>c.high));
  if(price > resistance*0.998) score+=12;
  if(price < support*1.002) score-=12;
  score=clamp(score,-100,100);
  return { score:round(score,1), rsi:r==null?null:round(r,1), ema20:round(e20,2), ema50:round(e50,2), macd:round(macd,4), macdSignal:round(signal,4), atr:a==null?null:round(a,2), support:round(support,2), resistance:round(resistance,2), lastPrice:round(price,2) };
}

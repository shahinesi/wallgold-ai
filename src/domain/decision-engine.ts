import type { ComponentKey, DecisionSignal, Direction, EvidenceSet, MarketDecision } from './types.js';
import { clamp, round, stddev } from '../utils/math.js';
import { componentLabelFa, directionFa, signalFa } from '../utils/fa.js';

const weights: Record<ComponentKey, number> = {
  globalGold: 0.24,
  usdIrr: 0.20,
  technical: 0.18,
  macro: 0.14,
  news: 0.14,
  localPremium: 0.10,
};

const maxFreshMinutes: Record<ComponentKey, number> = {
  globalGold: 90,
  usdIrr: 90,
  technical: 90,
  macro: 1440,
  news: 360,
  localPremium: 180,
};

function direction(score: number): Direction {
  return score > 12 ? 'bullish' : score < -12 ? 'bearish' : 'neutral';
}

function signal(score: number): DecisionSignal {
  if (score >= 62) return 'strong_buy';
  if (score >= 35) return 'scale_buy';
  if (score >= 14) return 'lean_buy';
  if (score <= -62) return 'sell';
  if (score <= -35) return 'scale_sell';
  if (score <= -14) return 'lean_sell';
  return Math.abs(score) < 6 ? 'wait' : 'hold';
}

export function analyzeEvidence(evidence: EvidenceSet): MarketDecision {
  const present = (Object.keys(evidence) as ComponentKey[]).filter(k => evidence[k]);
  const coverage = present.reduce((s,k)=>s+weights[k],0);
  if (present.length === 0 || coverage === 0) throw new Error('برای تحلیل حداقل یک مؤلفه داده لازم است.');

  const components = present.map(key => {
    const e = evidence[key]!;
    const score = clamp(e.score, -100, 100);
    const confidence = clamp(e.confidence, 0, 100);
    const age = Math.max(0, e.freshnessMinutes);
    const freshness = clamp(1 - age / maxFreshMinutes[key], 0.35, 1);
    const effectiveWeight = weights[key] * (confidence / 100) * freshness;
    const dir = direction(score);
    return {
      key,
      labelFa: componentLabelFa[key],
      direction: dir,
      directionFa: directionFa[dir],
      score: round(score, 1),
      confidence: round(confidence, 1),
      effectiveWeight,
      reasons: e.reasons.slice(0, 6),
    };
  });

  const denominator = components.reduce((s,c)=>s+c.effectiveWeight,0) || 1;
  const composite = components.reduce((s,c)=>s+c.score*c.effectiveWeight,0) / denominator;
  const disagreement = clamp(stddev(components.map(c=>c.score)) / 100, 0, 1);
  const avgEvidenceConfidence = components.reduce((s,c)=>s+c.confidence*c.effectiveWeight,0)/denominator/100;
  const confidenceRaw = 20 + 45*coverage + 22*avgEvidenceConfidence + 18*(Math.abs(composite)/100) - 28*disagreement;
  const confidence = round(clamp(confidenceRaw, 5, 95), 0);
  const sig = signal(composite);

  const bull = components.filter(c=>c.score>0).reduce((s,c)=>s+c.score*c.effectiveWeight,0)/denominator;
  const bear = Math.abs(components.filter(c=>c.score<0).reduce((s,c)=>s+c.score*c.effectiveWeight,0)/denominator);
  const directional = clamp(composite/100, -0.92, 0.92);
  const certainty = confidence/100;
  const up = clamp(0.34 + 0.38*directional*certainty, 0.05, 0.86);
  const down = clamp(0.34 - 0.38*directional*certainty, 0.05, 0.86);
  const sideways = Math.max(0.08, 1 - up - down);
  const total = up+down+sideways;

  const stale = components.filter(c => {
    const e = evidence[c.key]!;
    return e.freshnessMinutes > maxFreshMinutes[c.key];
  });
  const warnings: string[] = [];
  if (coverage < 0.75) warnings.push('پوشش داده کامل نیست؛ نتیجه باید با احتیاط بیشتری استفاده شود.');
  if (disagreement > 0.55) warnings.push('بین مؤلفه‌های تحلیل اختلاف معنی‌دار وجود دارد؛ بازار در وضعیت کم‌قطعیت است.');
  if (stale.length) warnings.push(`داده ${stale.map(x=>x.labelFa).join('، ')} از بازه تازگی ترجیحی قدیمی‌تر است.`);
  warnings.push('این خروجی پیش‌بینی قطعی قیمت نیست؛ احتمال‌ها سناریویی و وابسته به کیفیت شواهد ورودی هستند.');

  const invalidation: string[] = [];
  if (composite > 10) {
    invalidation.push('شکست معتبر حمایت‌های کلیدی و چرخش هم‌زمان مومنتوم تکنیکال می‌تواند دیدگاه صعودی را باطل کند.');
    invalidation.push('تقویت معنادار دلار جهانی/بازده واقعی یا کاهش ریسک ژئوپلیتیک می‌تواند وزن سناریوی نزولی را بالا ببرد.');
  } else if (composite < -10) {
    invalidation.push('شکست معتبر مقاومت‌های کلیدی و تقویت هم‌زمان دلار/ریال می‌تواند دیدگاه نزولی را باطل کند.');
    invalidation.push('شوک ریسک، کاهش نرخ‌های واقعی یا تغییر لحن سیاست پولی به سمت انبساط می‌تواند وزن سناریوی صعودی را بالا ببرد.');
  } else {
    invalidation.push('برای خروج از وضعیت خنثی باید چند مؤلفه اصلی هم‌جهت شوند؛ یک سیگنال منفرد کافی نیست.');
  }

  return {
    signal: sig,
    signalFa: signalFa[sig],
    score: round(composite, 1),
    confidence,
    coverage: round(coverage*100, 0),
    disagreement: round(disagreement*100, 0),
    components,
    bullCaseScore: round(bull, 1),
    bearCaseScore: round(bear, 1),
    scenarioProbabilities: {
      up: round(up/total*100, 0),
      sideways: round(sideways/total*100, 0),
      down: round(down/total*100, 0),
    },
    summaryFa: `جمع‌بندی فعلی: ${signalFa[sig]} با امتیاز ${round(composite,1)} از ۱۰۰ و اطمینان ${confidence}٪.`,
    invalidationFa: invalidation,
    warningsFa: warnings,
  };
}

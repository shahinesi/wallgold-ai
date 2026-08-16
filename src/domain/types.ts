export type Direction = 'bullish' | 'bearish' | 'neutral';
export type ComponentKey = 'globalGold' | 'usdIrr' | 'technical' | 'macro' | 'news' | 'localPremium';

export interface EvidenceComponent {
  score: number; // -100..100
  confidence: number; // 0..100
  freshnessMinutes: number;
  reasons: string[];
  sources?: string[];
}

export type EvidenceSet = Partial<Record<ComponentKey, EvidenceComponent>>;

export interface DecisionComponent {
  key: ComponentKey;
  labelFa: string;
  direction: Direction;
  directionFa: string;
  score: number;
  confidence: number;
  effectiveWeight: number;
  reasons: string[];
}

export type DecisionSignal =
  | 'strong_buy'
  | 'scale_buy'
  | 'lean_buy'
  | 'wait'
  | 'hold'
  | 'lean_sell'
  | 'scale_sell'
  | 'sell';

export interface MarketDecision {
  signal: DecisionSignal;
  signalFa: string;
  score: number;
  confidence: number;
  coverage: number;
  disagreement: number;
  components: DecisionComponent[];
  bullCaseScore: number;
  bearCaseScore: number;
  scenarioProbabilities: { up: number; sideways: number; down: number };
  summaryFa: string;
  invalidationFa: string[];
  warningsFa: string[];
}

export interface TreasuryPolicy {
  mode: 'advisor' | 'copilot' | 'autopilot';
  minCashReserveToman: number;
  maxTradeToman: number;
  maxTradeGrams: number;
  maxDailyTrades: number;
  maxDailyNotionalToman: number;
  targetGoldAllocationPct: number;
  maxGoldAllocationPct: number;
  minConfidenceToBuy: number;
  minConfidenceToSell: number;
  maxQuoteAgeSeconds: number;
  requireAnalysisFreshMinutes: number;
}

export const DEFAULT_POLICY: TreasuryPolicy = {
  mode: 'advisor',
  minCashReserveToman: 0,
  maxTradeToman: 0,
  maxTradeGrams: 0,
  maxDailyTrades: 0,
  maxDailyNotionalToman: 0,
  targetGoldAllocationPct: 25,
  maxGoldAllocationPct: 40,
  minConfidenceToBuy: 65,
  minConfidenceToSell: 65,
  maxQuoteAgeSeconds: 30,
  requireAnalysisFreshMinutes: 60,
};

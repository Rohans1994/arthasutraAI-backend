
export enum MarketCap {
  LARGE = 'Large Cap',
  MID = 'Mid Cap',
  SMALL = 'Small Cap'
}

export enum RiskProfile {
  MODERATE = 'Moderate',
  AGGRESSIVE = 'Aggressive'
}

export enum PlanTier {
  FREE = 'Free',
  PLUS = 'Plus',
  PREMIUM = 'Premium'
}

export type PortfolioTheme = 'MIXTURE' | 'IT' | 'FINTECH' | 'HEALTHCARE' | 'RETAIL' | 'DEFENSE' | 'CUSTOM';

export interface User {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt?: number;
  planTier?: PlanTier;
}

export interface Stock {
  ticker: string;
  name: string;
  sector: string;
  marketCap: MarketCap;
  allocation: number;
  allocationAmount?: number;
  rationale: string;
  projectedReturn: string;
}

export interface MutualFundRecommendation {
  name: string;
  category: string;
  rationale: string;
  allocation: number;
  allocationAmount?: number;
  expectedReturn: string;
}

export interface OtherAsset {
  type: 'GOLD' | 'DEBT' | 'PPF' | 'NPS' | 'CASH';
  name: string;
  allocation: number;
  allocationAmount?: number;
  rationale: string;
  projectedReturn: string;
}

export interface UserHolding {
  ticker: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
}

export interface StockScorecard {
  performance: string;
  profitability: string;
  valuation: string;
  growth: string;
  redFlags: string[];
}

export interface AlternativeStock {
  ticker?: string;
  name: string;
  category: 'Balanced Portfolio Suggestions (Domestic Equity)' | 'Global Portfolio Suggestion' | 'Debt Portfolio Suggestion' | 'Gold Portfolio Suggestion';
  rationale: string;
  projectedReturn: string;
}

export interface HoldingAnalysis extends UserHolding {
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  action: 'SELL' | 'HOLD' | 'ACCUMULATE';
  recommendationRationale: string;
  fundamentalDeepDive: string;
  technicalDeepDive: string;
  keyMetrics: string[];
  projectedGrowth: number;
  targetPrice: number;
  scorecard: StockScorecard;
  alternativeRecommendation?: AlternativeStock;
}

export interface ExistingPortfolioAnalysis {
  id?: string;
  totalInvested: number;
  currentValue: number;
  totalProfitLoss: number;
  projectedValue: number;
  portfolioCagr: number;
  portfolioSummary: string;
  analysis: HoldingAnalysis[];
  years: number;
  sources?: { uri: string; title: string }[];
  timestamp?: number;
}

export interface SavedAuditReport {
  id: string;
  timestamp: number;
  result: ExistingPortfolioAnalysis;
}

export interface SavedRebalancerStrategy {
  id: string;
  timestamp: number;
  input: RebalancerInput;
  analysis: RebalancerAnalysis;
  aiRationale: RebalancerRationale | null;
}

export type InvestmentType = 'LUMPSUM' | 'SIP';

export interface AssetAllocations {
  equity: number;
  mutualFunds: number;
  gold: number;
  debt: number;
  ppf: number;
  nps: number;
}

export interface InvestmentInput {
  type: InvestmentType;
  initialAmount: number;
  monthlySip?: number;
  stepUp?: number;
  targetAmount: number;
  years: number;
  theme: PortfolioTheme;
  customTheme?: string;
  isMultiAsset: boolean;
  age?: number;
  assetAllocations?: AssetAllocations;
  customDistribution?: {
    large: number;
    mid: number;
    small: number;
  };
}

export interface PortfolioResult {
  id?: string;
  timestamp?: number;
  investmentType: InvestmentType;
  initialAmount: number;
  monthlySip?: number;
  stepUp?: number;
  targetAmount: number;
  projectedAmount: number;
  years: number;
  cagr: number;
  riskProfile: RiskProfile;
  theme: PortfolioTheme;
  customTheme?: string;
  isMultiAsset: boolean;
  age?: number;
  stocks: Stock[];
  mutualFunds: MutualFundRecommendation[];
  otherAssets: OtherAsset[];
  sectorDistribution: { name: string; value: number }[];
  assetClassDistribution: { name: string; value: number }[];
  capCounts: {
    large: number;
    mid: number;
    small: number;
  };
}

export type PrepaymentStrategy = 'TENURE' | 'EMI';

export interface LoanScheduleRow {
  period: number;
  emiPaid: number;
  principalPaid: number;
  interestPaid: number;
  totalPayment: number;
  principalOutstanding: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
  prepayment: number;
  interestRate: number;
  monthName?: string;
  yearNumber?: number;
}

export interface LoanInput {
  principal: number;
  interestRate: number;
  tenureYears: number;
  prepaymentStrategy: PrepaymentStrategy;
  prepayments: Record<number, number>;
  interestRateOverrides: Record<number, number>;
  emiOverrides: Record<number, number>;
}

export interface FIREInput {
  monthlyIncome: number;
  monthlyExpense: number;
  inflationRate: number;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  postRetirementReturn: number;
}

export interface FIREResult {
  monthlySurplus: number;
  emergencyFund: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  futureMonthlyExpense: number;
  fireCorpus4Percent: number;
  sustenanceCorpus: number;
}

export type InvestmentFrequency = '15DAYS' | 'MONTHLY' | 'QUARTERLY' | 'HALFYEARLY' | 'YEARLY';

export interface XIRRInput {
  startDate: string;
  endDate: string;
  recurringAmount: number;
  frequency: InvestmentFrequency;
  maturityAmount: number;
}

export interface XIRRResult {
  xirr: number;
  totalInvested: number;
  totalGains: number;
  investmentCount: number;
  cashFlows: { date: string; amount: number }[];
}

export interface YearlyExpense {
  active: boolean;
  amount: number;
  event: string;
}

export interface AssetSuggestion {
  type: 'STOCK' | 'MUTUAL_FUND';
  name: string;
  ticker?: string;
  rationale: string;
  expectedReturn: string;
}

export interface RebalancerInput {
  age: number;
  targetCorpus: number;
  retirementAge: number;
  monthlySurplus: number;
  expenses: {
    year1: YearlyExpense;
    year2: YearlyExpense;
    year3: YearlyExpense;
  };
  targetAllocation: {
    indianEquity: number;
    globalEquity: number;
    debt: number;
    gold: number;
  };
  currentPortfolio: {
    indianEquity: number;
    globalEquity: number;
    debt: number;
    gold: number;
  };
  currentHoldings?: UserHolding[];
  marketSignals: {
    niftyPe: number;
    marketPhase: 'Bull' | 'Sideways' | 'Bear';
    rbiStance: 'Hawkish' | 'Neutral' | 'Dovish';
    indiaInflation: 'Rising' | 'Stable' | 'Falling';
    sp500ForwardPe: number;
    fedStance: 'Hawkish' | 'Neutral' | 'Dovish';
    dollarIndex: 'Strong' | 'Stable' | 'Weak';
  };
}

export interface RebalancerRationale {
  objective: string;
  marketDynamics: string;
  rebalancingLogic: string;
  safetyOverrides: string;
  macroEnvironment: string;
  executionLogic: string;
  assetSuggestions: AssetSuggestion[];
  debtSuggestions: AssetSuggestion[];
  globalSuggestions: AssetSuggestion[];
  goldSuggestions: AssetSuggestion[];
}

export interface RebalancerAnalysis {
  totalValue: number;
  actualAllocation: Record<string, number>;
  deviations: Record<string, number>;
  requiresRebalancing: boolean;
  marketRegimes: {
    india: 'Overvalued' | 'Fair' | 'Undervalued';
    us: 'Cautious' | 'Fair' | 'Attractive';
  };
  actions: {
    asset: string;
    action: 'Increase' | 'Decrease' | 'Maintain';
    method: 'SIP redirection' | 'Partial trim' | 'Maintain';
    timeframe: 'Immediate' | 'Gradual (3-6 months)' | 'None';
    gapAmount: number;
  }[];
  stockAudit?: ExistingPortfolioAnalysis;
}

export type View = 'home' | 'architect' | 'health-check' | 'rebalancer' | 'fire' | 'xirr-vault' | 'loan-shield' | 'plans' | 'how-it-works' | 'profile' | 'subscription';

export type AccountType = 'evaluation' | 'funded' | 'personal'

// ── Extended account dimension types ─────────────────────────────────────────
export type AccountEnvironment =
  | 'live'
  | 'demo'
  | 'prop_firm'
  | 'strategy_testing'
  | 'development'
  | 'institutional'

export type MarketType = 'forex' | 'crypto' | 'stocks' | 'futures' | 'options' | 'mixed'

export type TradingStyle = 'scalping' | 'intraday' | 'swing' | 'position'

export type RiskModel = 'fixed' | 'variable' | 'percentage' | 'discretionary'

export type AvgDuration = 'minutes' | 'hours' | 'days' | 'weeks'

export type AccountPurpose =
  | 'income_generation'
  | 'strategy_experimentation'
  | 'evaluation_challenge'
  | 'skill_development'

export interface AccountHealthBreakdown {
  consistency:       number   // 0–100
  drawdownControl:   number   // 0–100
  riskDiscipline:    number   // 0–100
  strategyAdherence: number   // 0–100
}

export interface AccountMetrics {
  totalInvested: number
  totalPayouts:  number
  net:           number
  returnPct:     number
  winRate:       number
  avgR:          number
  profitFactor:  number
  maxDrawdown:   number
  tradeCount:    number
}

export type BehavioralTrend = 'improving' | 'declining' | 'stable'

export interface BehavioralSignal {
  id:       string
  label:    string
  value:    string
  detail:   string
  severity: 'ok' | 'warning' | 'critical'
  trend?:   BehavioralTrend
}

export interface AccountPayout {
  date:   string
  amount: number
  note?:  string
}

export type AccountStatus = 'Active' | 'Passed' | 'Failed' | 'Paused' | 'Withdrawn'

export type TimelineEventType =
  | 'opened'
  | 'phase1_passed'
  | 'phase2_passed'
  | 'funded'
  | 'payout'
  | 'milestone'
  | 'custom'

export interface AccountTimelineEvent {
  id:      string
  date:    string
  type:    TimelineEventType
  label:   string
  amount?: number
  note?:   string
}

export interface Account {
  id: string
  uid: string
  name: string
  type: AccountType
  broker: string
  currency: string
  startingBalance: number
  currentBalance: number
  createdAt: string
  openedAt?: string
  phase?: string
  status?: AccountStatus
  notes?: string
  evaluation?: {
    profitTarget: number
    maxDailyDrawdown: number
    maxTotalDrawdown: number
    tradingDays: number
  }
  // Cost tracking
  accountCost?:   number           // one-time purchase / challenge fee
  monthlyFee?:    number           // recurring subscription fee
  totalPaid?:     number           // manually-entered total paid override
  payoutSplit?:   number           // payout split % (e.g. 80 = trader keeps 80%)
  payoutHistory?: AccountPayout[]       // funded account payouts
  timelineEvents?: AccountTimelineEvent[] // manual timeline entries
  // Certificates (PDFs of passing/funding letters)
  certificates?:  AccountCertificate[]
  // Extended behavioral context (Phase 1 expansion)
  environment?:   AccountEnvironment
  marketType?:    MarketType
  tradingStyle?:  TradingStyle
  riskModel?:     RiskModel
  avgDuration?:   AvgDuration
  strategies?:    string[]          // strategy tags allowed in this account
  healthScore?:   number            // cached 0–100 score
  personalityNote?: string          // generated personality observation
  purpose?:       AccountPurpose    // what is this account for
}

export interface AccountCertificate {
  name:       string
  url:        string
  uploadedAt: string
}

export type TradeDirection = 'long' | 'short'
export type TradeSession   = 'london' | 'ny' | 'asia' | 'other'
export type TradeEmotion   = 'focused' | 'neutral' | 'anxious' | 'impulsive' | 'euphoric'
export type MarketContext  = string   // fully custom (e.g. 'trending', 'ranging', user-defined)

export interface Trade {
  id: string
  accountId: string
  uid: string
  date: string
  symbol: string
  direction: TradeDirection
  entry: number
  exit: number
  stopLoss: number
  takeProfit: number
  positionSize: number
  pnl: number
  rMultiple: number
  setup: string[]
  mistakes: string[]
  notes: string
  mediaUrls: string[]
  duration: number
  session: TradeSession
  createdAt: string
  // Behavioral tracking
  emotionPre?:    TradeEmotion
  emotionPost?:   TradeEmotion
  confidence?:    1 | 2 | 3 | 4 | 5
  marketContext?: MarketContext[]
  // Risk-based trading (replaces price-based P&L)
  riskAmount?:    number
  outcome?:       'win' | 'loss' | 'scratch'
}

export type ReviewPeriod = 'daily' | 'weekly' | 'monthly'

export interface Review {
  id: string
  accountId: string
  uid: string
  period: ReviewPeriod
  date: string
  whatWorked: string
  whatToChange: string
  emotionalState: string
  notes: string
  createdAt: string
}

export interface Insight {
  id: string
  uid: string
  accountId: string
  title: string
  body: string
  icon: string
  createdAt: string
}

export interface Setup {
  id: string
  uid: string
  name: string
  description: string
  rules: string[]
  tags: string[]
  createdAt: string
}

export interface MirrorReport {
  id: string
  uid: string
  accountId: string
  period: string        // YYYY-MM
  narrative: string     // full coaching letter
  tradeCount: number
  createdAt: string
}

export interface EquityPoint {
  date: string
  value: number
}

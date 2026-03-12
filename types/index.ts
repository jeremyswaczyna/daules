export type AccountType = 'evaluation' | 'funded' | 'personal'

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

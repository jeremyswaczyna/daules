import type { Trade, EquityPoint } from '@/types'

// ── Behavioral DNA ─────────────────────────────────────────────────────────
export interface BehavioralDNA {
  patience:     number   // 0-100
  discipline:   number
  riskMgmt:     number
  setupQuality: number
  execution:    number
  resilience:   number
  adaptability: number
  consistency:  number
}

export const DNA_TRAITS: Array<{ key: keyof BehavioralDNA; label: string; desc: string }> = [
  { key: 'patience',     label: 'Patience',      desc: 'Hold & exit discipline' },
  { key: 'discipline',   label: 'Discipline',     desc: 'Setup adherence rate' },
  { key: 'riskMgmt',     label: 'Risk Mgmt',      desc: 'Stop loss consistency' },
  { key: 'setupQuality', label: 'Setup Quality',  desc: 'Edge on tagged setups' },
  { key: 'execution',    label: 'Execution',      desc: 'Entry + exit quality' },
  { key: 'resilience',   label: 'Resilience',     desc: 'Post-loss recovery' },
  { key: 'adaptability', label: 'Adaptability',   desc: 'Cross-setup performance' },
  { key: 'consistency',  label: 'Consistency',    desc: 'Day-to-day stability' },
]

export function calcBehavioralDNA(trades: Trade[]): BehavioralDNA {
  const placeholder: BehavioralDNA = { patience: 35, discipline: 35, riskMgmt: 35, setupQuality: 35, execution: 35, resilience: 35, adaptability: 35, consistency: 35 }
  if (trades.length < 3) return placeholder

  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Patience: avg R normalized (>2.0 = 100, <0 = 10)
  const avgR = calcAvgR(trades)
  const patience = Math.min(100, Math.max(10, (avgR + 0.5) * 33))

  // Discipline: % trades with setup tags
  const withSetup = trades.filter(t => t.setup?.length > 0).length
  const discipline = Math.round((withSetup / trades.length) * 100)

  // Risk Management: % trades with stop loss set
  const withSL = trades.filter(t => t.stopLoss != null && t.stopLoss > 0).length
  const riskMgmt = Math.min(100, Math.round((withSL / trades.length) * 90 + 10))

  // Setup Quality: win rate on tagged trades (or overall as fallback)
  const tagged = trades.filter(t => t.setup?.length > 0)
  const setupQuality = tagged.length >= 3 ? calcWinRate(tagged) : calcWinRate(trades) * 0.85

  // Execution: win rate × profit factor blend
  const wr = calcWinRate(trades)
  const pf = calcProfitFactor(trades)
  const execution = Math.min(100, Math.max(10, wr * 0.5 + Math.min(pf, 3) * 16.7))

  // Resilience: win rate on trades after a loss
  let bounceWins = 0, bounceTotal = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].pnl < 0) {
      bounceTotal++
      if (sorted[i].pnl > 0) bounceWins++
    }
  }
  const resilience = bounceTotal >= 3 ? Math.round((bounceWins / bounceTotal) * 100) : Math.round(wr * 0.9)

  // Adaptability: ratio of setups with positive P&L
  const setupData = calcPnLBySetup(trades)
  const adaptability = setupData.length > 0
    ? Math.min(100, Math.round((setupData.filter(s => s.pnl > 0).length / setupData.length) * 100))
    : Math.round(wr * 0.8)

  // Consistency: inverse coefficient of variation of daily P&L
  const dailyMap = new Map<string, number>()
  for (const t of trades) {
    const day = t.date.slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + t.pnl)
  }
  const vals = Array.from(dailyMap.values())
  let consistency = 50
  if (vals.length >= 3) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
    const cv   = mean !== 0 ? Math.abs(std / mean) : 2
    consistency = Math.min(100, Math.max(10, Math.round(100 - cv * 28)))
  }

  return { patience, discipline, riskMgmt, setupQuality: Math.round(setupQuality), execution: Math.round(execution), resilience, adaptability, consistency }
}

// ── Momentum Score ─────────────────────────────────────────────────────────
export function calcMomentumScore(trades: Trade[]): number {
  if (trades.length < 3) return 50

  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const recent = sorted.slice(-10)

  // Recent win rate (40%)
  const recentWR = calcWinRate(recent) / 100

  // Discipline score from DNA (20%)
  const dna = calcBehavioralDNA(trades)
  const discScore = dna.discipline / 100

  // Recent profit factor (20%)
  const recentPF = Math.min(1, calcProfitFactor(recent) / 2)

  // Streak impact (20%)
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (streak === 0) { streak = sorted[i].pnl >= 0 ? 1 : -1 }
    else if (streak > 0 && sorted[i].pnl >= 0) streak++
    else if (streak < 0 && sorted[i].pnl < 0) streak--
    else break
  }
  const streakImpact = streak > 0 ? Math.min(0.15, streak * 0.04) : Math.max(-0.25, streak * 0.05)

  const raw = recentWR * 0.4 + discScore * 0.2 + recentPF * 0.2 + 0.2 + streakImpact
  return Math.min(100, Math.max(0, Math.round(raw * 100)))
}

export function calcWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter((t) => t.pnl > 0).length
  return (wins / trades.length) * 100
}

export function calcAvgR(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const total = trades.reduce((sum, t) => sum + t.rMultiple, 0)
  return total / trades.length
}

export function calcNetPnL(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.pnl, 0)
}

export function calcAvgWin(trades: Trade[]): number {
  const wins = trades.filter((t) => t.pnl > 0)
  if (wins.length === 0) return 0
  return wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length
}

export function calcAvgLoss(trades: Trade[]): number {
  const losses = trades.filter((t) => t.pnl < 0)
  if (losses.length === 0) return 0
  return Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length)
}

export function calcProfitFactor(trades: Trade[]): number {
  const grossWin = trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(
    trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0)
  )
  if (grossLoss === 0) return grossWin > 0 ? Infinity : 0
  return grossWin / grossLoss
}

export function calcDrawdown(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  let peak = 0
  let maxDrawdown = 0
  let running = 0
  for (const trade of sorted) {
    running += trade.pnl
    if (running > peak) peak = running
    const drawdown = peak - running
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  return maxDrawdown
}

export function calcEquityCurve(trades: Trade[], startingBalance = 0): EquityPoint[] {
  if (trades.length === 0) return []
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  let running = startingBalance
  // Start point: balance before any trades
  const points: EquityPoint[] = [{ date: sorted[0].date, value: startingBalance }]
  for (const trade of sorted) {
    running += trade.pnl
    points.push({ date: trade.date, value: running })
  }
  return points
}

export function calcPnLBySetup(
  trades: Trade[]
): Array<{ setup: string; pnl: number; count: number; winRate: number }> {
  const setupMap = new Map<
    string,
    { pnl: number; count: number; wins: number }
  >()
  for (const trade of trades) {
    for (const setup of trade.setup) {
      const existing = setupMap.get(setup) ?? { pnl: 0, count: 0, wins: 0 }
      setupMap.set(setup, {
        pnl: existing.pnl + trade.pnl,
        count: existing.count + 1,
        wins: existing.wins + (trade.pnl > 0 ? 1 : 0),
      })
    }
  }
  return Array.from(setupMap.entries()).map(([setup, data]) => ({
    setup,
    pnl: data.pnl,
    count: data.count,
    winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
  }))
}

export function calcPnLByDayOfWeek(
  trades: Trade[]
): Array<{ day: string; pnl: number }> {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayMap = new Map<number, number>()
  for (const trade of trades) {
    const dayIndex = new Date(trade.date).getDay()
    dayMap.set(dayIndex, (dayMap.get(dayIndex) ?? 0) + trade.pnl)
  }
  return days.map((day, i) => ({ day, pnl: dayMap.get(i) ?? 0 }))
}

// ── Setup × Session matrix ─────────────────────────────────────────────────
export type SessionKey = 'london' | 'ny' | 'asia' | 'other'
export const SESSION_LABELS: Record<SessionKey, string> = {
  london: 'London', ny: 'New York', asia: 'Asia', other: 'Other',
}
export function calcSetupSessionMatrix(
  trades: Trade[]
): Array<{ setup: string; sessions: Record<SessionKey, { winRate: number; count: number; pnl: number }> }> {
  const setups = Array.from(new Set(trades.flatMap(t => t.setup))).filter(Boolean)
  return setups.map(setup => {
    const sessions: Record<string, { winRate: number; count: number; pnl: number }> = {}
    for (const sess of ['london', 'ny', 'asia', 'other'] as SessionKey[]) {
      const match = trades.filter(t => t.setup.includes(setup) && t.session === sess)
      sessions[sess] = {
        count:   match.length,
        pnl:     match.reduce((s, t) => s + t.pnl, 0),
        winRate: match.length > 0 ? (match.filter(t => t.pnl > 0).length / match.length) * 100 : 0,
      }
    }
    return { setup, sessions: sessions as Record<SessionKey, { winRate: number; count: number; pnl: number }> }
  })
}

// ── Time-of-day heatmap ─────────────────────────────────────────────────────
export function calcTimeOfDayHeatmap(
  trades: Trade[]
): Array<{ hour: number; label: string; pnl: number; count: number; winRate: number }> {
  // Group by session since we rarely have exact hour timestamps
  const sessionHours: Record<SessionKey, number> = { london: 8, ny: 14, asia: 2, other: 12 }
  const map = new Map<number, { pnl: number; wins: number; count: number }>()
  for (const t of trades) {
    const hour = sessionHours[t.session as SessionKey] ?? 12
    const existing = map.get(hour) ?? { pnl: 0, wins: 0, count: 0 }
    map.set(hour, {
      pnl:   existing.pnl + t.pnl,
      wins:  existing.wins + (t.pnl > 0 ? 1 : 0),
      count: existing.count + 1,
    })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, d]) => ({
      hour,
      label:   `${String(hour).padStart(2, '0')}:00`,
      pnl:     d.pnl,
      count:   d.count,
      winRate: d.count > 0 ? (d.wins / d.count) * 100 : 0,
    }))
}

// ── Streak intelligence ────────────────────────────────────────────────────
export interface StreakStats {
  currentStreak:  number    // + = wins, - = losses
  longestWin:     number
  longestLoss:    number
  avgWinStreak:   number
  avgLossStreak:  number
  winRateAfterLoss: number  // 0–100
  winRateAfterWin:  number  // 0–100
}
export function calcStreakStats(trades: Trade[]): StreakStats {
  if (trades.length === 0) return { currentStreak: 0, longestWin: 0, longestLoss: 0, avgWinStreak: 0, avgLossStreak: 0, winRateAfterLoss: 0, winRateAfterWin: 0 }
  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let current = 0, longestWin = 0, longestLoss = 0
  const winStreaks: number[] = [], lossStreaks: number[] = []
  let afterLossWins = 0, afterLossTotal = 0
  let afterWinWins  = 0, afterWinTotal  = 0

  for (let i = 0; i < sorted.length; i++) {
    const win = sorted[i].pnl > 0
    if (i === 0) { current = win ? 1 : -1; continue }
    const prevWin = sorted[i - 1].pnl > 0

    // After-loss/win tracking
    if (!prevWin) { afterLossTotal++; if (win) afterLossWins++ }
    if (prevWin)  { afterWinTotal++;  if (win) afterWinWins++ }

    if (win === prevWin) {
      current = win ? current + 1 : current - 1
    } else {
      if (current > 0) winStreaks.push(current)
      else             lossStreaks.push(Math.abs(current))
      current = win ? 1 : -1
    }
    if (current > longestWin)         longestWin  = current
    if (Math.abs(current) > longestLoss && current < 0) longestLoss = Math.abs(current)
  }
  if (current > 0) winStreaks.push(current)
  else if (current < 0) lossStreaks.push(Math.abs(current))

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  return {
    currentStreak:    current,
    longestWin:       Math.max(...winStreaks, 0),
    longestLoss:      Math.max(...lossStreaks, 0),
    avgWinStreak:     avg(winStreaks),
    avgLossStreak:    avg(lossStreaks),
    winRateAfterLoss: afterLossTotal > 0 ? (afterLossWins / afterLossTotal) * 100 : 0,
    winRateAfterWin:  afterWinTotal  > 0 ? (afterWinWins  / afterWinTotal)  * 100 : 0,
  }
}

// ── Pattern discovery ──────────────────────────────────────────────────────
export interface Pattern {
  id:          string
  title:       string
  description: string
  metric:      string
  value:       number
  baseline:    number
  sampleSize:  number
  pnlImpact:   number
  confidence:  'low' | 'medium' | 'high'
}

export function discoverPatterns(trades: Trade[]): Pattern[] {
  if (trades.length < 10) return []
  const patterns: Pattern[] = []
  const overall   = calcWinRate(trades)
  const overallPF = calcProfitFactor(trades)

  // Pattern: best performing session
  const sessions: Array<{ key: string; label: string }> = [
    { key: 'london', label: 'London session' },
    { key: 'ny',     label: 'New York session' },
    { key: 'asia',   label: 'Asia session' },
  ]
  for (const { key, label } of sessions) {
    const sessT = trades.filter(t => t.session === key)
    if (sessT.length < 4) continue
    const wr = calcWinRate(sessT)
    const pnl = calcNetPnL(sessT)
    const diff = wr - overall
    if (Math.abs(diff) >= 12 && sessT.length >= 5) {
      patterns.push({
        id: `session-${key}`,
        title: `${label} ${diff > 0 ? 'edge' : 'drag'}`,
        description: `Your ${label.toLowerCase()} trades have a ${wr.toFixed(0)}% win rate (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs overall)`,
        metric: 'Win Rate', value: wr, baseline: overall,
        sampleSize: sessT.length, pnlImpact: pnl,
        confidence: sessT.length >= 15 ? 'high' : sessT.length >= 8 ? 'medium' : 'low',
      })
    }
  }

  // Pattern: best performing setup
  const setupData = calcPnLBySetup(trades)
  for (const s of setupData) {
    if (s.count < 4) continue
    const diff = s.winRate - overall
    if (diff >= 15 && s.count >= 5) {
      patterns.push({
        id: `setup-${s.setup}`,
        title: `${s.setup} is your best edge`,
        description: `Your "${s.setup}" trades win at ${s.winRate.toFixed(0)}% (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs overall avg)`,
        metric: 'Win Rate', value: s.winRate, baseline: overall,
        sampleSize: s.count, pnlImpact: s.pnl,
        confidence: s.count >= 15 ? 'high' : s.count >= 7 ? 'medium' : 'low',
      })
    }
    if (diff <= -15 && s.count >= 5) {
      patterns.push({
        id: `setup-drag-${s.setup}`,
        title: `${s.setup} is costing you`,
        description: `Your "${s.setup}" trades win at only ${s.winRate.toFixed(0)}% (${diff.toFixed(0)}% below average). Consider reviewing or removing this setup.`,
        metric: 'Win Rate', value: s.winRate, baseline: overall,
        sampleSize: s.count, pnlImpact: s.pnl,
        confidence: s.count >= 15 ? 'high' : s.count >= 7 ? 'medium' : 'low',
      })
    }
  }

  // Pattern: direction bias
  const longs  = trades.filter(t => t.direction === 'long')
  const shorts = trades.filter(t => t.direction === 'short')
  if (longs.length >= 5 && shorts.length >= 5) {
    const longWR  = calcWinRate(longs)
    const shortWR = calcWinRate(shorts)
    if (Math.abs(longWR - shortWR) >= 15) {
      const better = longWR > shortWR ? 'Long' : 'Short'
      const worse  = longWR > shortWR ? 'Short' : 'Long'
      patterns.push({
        id: 'direction-bias',
        title: `${better}s significantly outperform ${worse.toLowerCase()}s`,
        description: `Longs: ${longWR.toFixed(0)}% WR · Shorts: ${shortWR.toFixed(0)}% WR. Bias your setups toward ${better.toLowerCase()} setups.`,
        metric: 'Win Rate delta', value: Math.abs(longWR - shortWR), baseline: 0,
        sampleSize: trades.length, pnlImpact: calcNetPnL(longWR > shortWR ? longs : shorts),
        confidence: Math.min(longs.length, shorts.length) >= 10 ? 'high' : 'medium',
      })
    }
  }

  // Pattern: day-of-week
  const dayData = calcPnLByDayOfWeek(trades)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (const { day, pnl } of dayData) {
    const dayTrades = trades.filter(t => new Date(t.date).getDay() === dayNames.indexOf(day))
    if (dayTrades.length < 4) continue
    const dayWR = calcWinRate(dayTrades)
    const diff  = dayWR - overall
    if (diff >= 18) {
      patterns.push({
        id: `day-${day}`,
        title: `${day} is your strongest trading day`,
        description: `${day} win rate: ${dayWR.toFixed(0)}% (+${diff.toFixed(0)}% vs average). Prioritize high-conviction trades on ${day}s.`,
        metric: 'Win Rate', value: dayWR, baseline: overall,
        sampleSize: dayTrades.length, pnlImpact: pnl,
        confidence: dayTrades.length >= 10 ? 'high' : 'medium',
      })
    }
    if (diff <= -18) {
      patterns.push({
        id: `day-drag-${day}`,
        title: `${day} is draining your account`,
        description: `${day} win rate: ${dayWR.toFixed(0)}% (${diff.toFixed(0)}% vs average). Consider reducing size or skipping ${day}s.`,
        metric: 'Win Rate', value: dayWR, baseline: overall,
        sampleSize: dayTrades.length, pnlImpact: pnl,
        confidence: dayTrades.length >= 10 ? 'high' : 'medium',
      })
    }
  }

  // Pattern: emotion correlation (if emotional data exists)
  const emotionTrades = trades.filter(t => t.emotionPre)
  if (emotionTrades.length >= 6) {
    for (const emotion of ['focused', 'anxious', 'impulsive', 'euphoric'] as const) {
      const emT = emotionTrades.filter(t => t.emotionPre === emotion)
      if (emT.length < 3) continue
      const emWR = calcWinRate(emT)
      const diff = emWR - overall
      if (Math.abs(diff) >= 15) {
        patterns.push({
          id: `emotion-${emotion}`,
          title: `Trading while ${emotion} ${diff > 0 ? 'boosts' : 'hurts'} performance`,
          description: `When you feel ${emotion} before a trade, win rate is ${emWR.toFixed(0)}% (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs avg). ${diff < 0 ? 'Step back when feeling this way.' : 'This is your peak state.'}`,
          metric: 'Win Rate', value: emWR, baseline: overall,
          sampleSize: emT.length, pnlImpact: calcNetPnL(emT),
          confidence: emT.length >= 10 ? 'high' : 'medium',
        })
      }
    }
  }

  // Sort by absolute impact (pnlImpact) descending
  return patterns.sort((a, b) => Math.abs(b.pnlImpact) - Math.abs(a.pnlImpact)).slice(0, 12)
}

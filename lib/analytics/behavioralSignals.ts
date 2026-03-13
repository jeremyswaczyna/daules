import type { Account, Trade, BehavioralSignal, BehavioralTrend } from '@/types'

// ── Trend computation helper ───────────────────────────────────────────────────
// Compare first half vs second half of sorted trades to get direction
function calcTrend(
  trades: Trade[],
  metricFn: (slice: Trade[]) => number,
  higherIsBetter: boolean
): BehavioralTrend {
  if (trades.length < 6) return 'stable'
  const mid   = Math.floor(trades.length / 2)
  const first = metricFn(trades.slice(0, mid))
  const last  = metricFn(trades.slice(mid))
  const delta = last - first
  const threshold = 0.05 * (first || 1)
  if (Math.abs(delta) < threshold) return 'stable'
  if (delta > 0) return higherIsBetter ? 'improving' : 'declining'
  return higherIsBetter ? 'declining' : 'improving'
}

/**
 * Derives behavioral signals from trade data for a given account.
 * Signals are empty / "ok" when there is insufficient data.
 */
export function calcBehavioralSignals(account: Account, trades: Trade[]): BehavioralSignal[] {
  if (trades.length < 3) return []

  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const signals: BehavioralSignal[] = []

  // ── Stop loss adherence ─────────────────────────────────────────────────────
  const slPctFn = (ts: Trade[]) => ts.filter(t => t.stopLoss && t.stopLoss !== 0).length / Math.max(ts.length, 1)
  const slPct   = Math.round(slPctFn(sorted) * 100)
  const slTrend = calcTrend(sorted, ts => slPctFn(ts) * 100, true)
  signals.push({
    id:       'stop_loss',
    label:    'Stop Loss Adherence',
    value:    `${slPct}%`,
    detail:   slPct >= 90
      ? 'Consistent stop placement across trades.'
      : slPct >= 70
      ? 'Occasional trades without defined stops.'
      : 'Frequent trading without stop losses detected.',
    severity: slPct >= 90 ? 'ok' : slPct >= 70 ? 'warning' : 'critical',
    trend:    slTrend,
  })

  // ── Overtrading signal ──────────────────────────────────────────────────────
  const days = new Map<string, number>()
  for (const t of sorted) {
    const day = t.date.split('T')[0]
    days.set(day, (days.get(day) ?? 0) + 1)
  }
  const maxTradesInDay  = Math.max(...days.values())
  const avgTradesPerDay = sorted.length / days.size
  const overtradingRisk = maxTradesInDay > 8 || avgTradesPerDay > 5
  signals.push({
    id:       'overtrading',
    label:    'Overtrading Signal',
    value:    `${avgTradesPerDay.toFixed(1)} trades/day avg`,
    detail:   overtradingRisk
      ? `Peak of ${maxTradesInDay} trades in a single session detected.`
      : 'Trade frequency appears controlled.',
    severity: overtradingRisk ? 'warning' : 'ok',
    trend:    calcTrend(sorted, ts => {
      const d = new Map<string, number>()
      for (const t of ts) d.set(t.date.split('T')[0], (d.get(t.date.split('T')[0]) ?? 0) + 1)
      return d.size > 0 ? ts.length / d.size : 0
    }, false),
  })

  // ── Loss chasing ────────────────────────────────────────────────────────────
  const countLossChase = (ts: Trade[]) => {
    let count = 0
    for (let i = 1; i < ts.length; i++) {
      const prev = ts[i - 1]
      const curr = ts[i]
      const prevWasLoss = prev.outcome === 'loss' || (prev.pnl ?? 0) < 0
      const gapMin = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 60_000
      if (prevWasLoss && gapMin < 30) count++
    }
    const losses = ts.filter(t => t.outcome === 'loss' || (t.pnl ?? 0) < 0).length
    return count / Math.max(losses, 1)
  }
  const lossChaseRatio = countLossChase(sorted)
  const lossChaseCount = Math.round(lossChaseRatio * sorted.filter(t => t.outcome === 'loss' || (t.pnl ?? 0) < 0).length)
  signals.push({
    id:       'loss_chasing',
    label:    'Loss Chasing',
    value:    lossChaseRatio > 0.25 ? 'Detected' : 'Not detected',
    detail:   lossChaseRatio > 0.25
      ? `${lossChaseCount} trades entered within 30 min of a loss.`
      : 'No significant pattern of revenge entries after losses.',
    severity: lossChaseRatio > 0.40 ? 'critical' : lossChaseRatio > 0.25 ? 'warning' : 'ok',
    trend:    calcTrend(sorted, countLossChase, false),
  })

  // ── Risk consistency ────────────────────────────────────────────────────────
  const riskAmounts = sorted.map(t => t.riskAmount ?? 0).filter(r => r > 0)
  if (riskAmounts.length >= 5) {
    const cvFn = (ts: Trade[]) => {
      const r = ts.map(t => t.riskAmount ?? 0).filter(x => x > 0)
      if (r.length < 2) return 0
      const mean   = r.reduce((s, x) => s + x, 0) / r.length
      const stdDev = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length)
      return mean > 0 ? (stdDev / mean) * 100 : 0
    }
    const mean   = riskAmounts.reduce((s, r) => s + r, 0) / riskAmounts.length
    const stdDev = Math.sqrt(riskAmounts.reduce((s, r) => s + (r - mean) ** 2, 0) / riskAmounts.length)
    const cvPct  = mean > 0 ? Math.round((stdDev / mean) * 100) : 0
    signals.push({
      id:       'risk_consistency',
      label:    'Risk Consistency',
      value:    `${cvPct}% variance`,
      detail:   cvPct < 20
        ? 'Risk sizing is highly consistent across trades.'
        : cvPct < 50
        ? 'Moderate variation in position sizing.'
        : 'High variance in risk amounts — sizing appears erratic.',
      severity: cvPct < 20 ? 'ok' : cvPct < 50 ? 'warning' : 'critical',
      trend:    calcTrend(sorted, cvFn, false),
    })
  }

  // ── Win rate ────────────────────────────────────────────────────────────────
  const winRateFn = (ts: Trade[]) => ts.filter(t => t.outcome === 'win' || (t.pnl ?? 0) > 0).length / Math.max(ts.length, 1) * 100
  const winRate   = Math.round(winRateFn(sorted))
  signals.push({
    id:       'win_rate',
    label:    'Win Rate',
    value:    `${winRate}%`,
    detail:   winRate >= 55
      ? 'Solid win rate for this account.'
      : winRate >= 40
      ? 'Acceptable win rate — focus on R:R quality.'
      : 'Low win rate. Ensure R:R compensates.',
    severity: winRate >= 50 ? 'ok' : winRate >= 35 ? 'warning' : 'critical',
    trend:    calcTrend(sorted, winRateFn, true),
  })

  // ── Evaluation drawdown proximity ───────────────────────────────────────────
  if (account.evaluation) {
    const { maxTotalDrawdown } = account.evaluation
    const ddPct        = account.startingBalance > 0
      ? ((account.startingBalance - account.currentBalance) / account.startingBalance) * 100
      : 0
    const usedFraction = maxTotalDrawdown > 0 ? ddPct / maxTotalDrawdown : 0
    signals.push({
      id:       'drawdown_proximity',
      label:    'Drawdown Proximity',
      value:    `${(usedFraction * 100).toFixed(0)}% of limit used`,
      detail:   usedFraction < 0.5
        ? `${ddPct.toFixed(1)}% drawdown used of ${maxTotalDrawdown}% limit.`
        : usedFraction < 0.80
        ? 'Approaching drawdown limit — exercise caution.'
        : 'Critical: very close to max drawdown breach.',
      severity: usedFraction < 0.5 ? 'ok' : usedFraction < 0.8 ? 'warning' : 'critical',
      trend:    'stable',
    })
  }

  return signals
}

/**
 * Aggregates a 0–100 behavior stability score across all accounts.
 * Weighs stop loss adherence, loss chasing, and risk consistency.
 */
export function calcBehaviorStabilityScore(
  accounts: Account[],
  tradesByAccount: Map<string, Trade[]>
): { score: number; label: string } {
  if (accounts.length === 0) return { score: 0, label: 'No data' }

  const scores: number[] = []

  for (const account of accounts) {
    const trades = tradesByAccount.get(account.id) ?? []
    if (trades.length < 3) continue

    const withSL    = trades.filter(t => t.stopLoss && t.stopLoss !== 0).length
    const slScore   = Math.min(100, (withSL / trades.length) * 100)

    const sorted    = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let lossChase   = 0
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const wasLoss = prev.outcome === 'loss' || (prev.pnl ?? 0) < 0
      const gapMin  = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 60_000
      if (wasLoss && gapMin < 30) lossChase++
    }
    const losses         = trades.filter(t => (t.pnl ?? 0) < 0).length
    const lossChaseRatio = lossChase / Math.max(losses, 1)
    const chaseScore     = Math.max(0, 100 - lossChaseRatio * 200)

    const rAmounts = trades.map(t => t.riskAmount ?? 0).filter(r => r > 0)
    let   cvScore  = 80
    if (rAmounts.length >= 5) {
      const mean   = rAmounts.reduce((s, r) => s + r, 0) / rAmounts.length
      const std    = Math.sqrt(rAmounts.reduce((s, r) => s + (r - mean) ** 2, 0) / rAmounts.length)
      const cvPct  = mean > 0 ? (std / mean) * 100 : 0
      cvScore      = Math.max(0, 100 - cvPct)
    }

    scores.push((slScore * 0.35) + (chaseScore * 0.35) + (cvScore * 0.30))
  }

  if (scores.length === 0) return { score: 0, label: 'Insufficient data' }

  const avg = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length)
  const label = avg >= 80 ? 'Stable' : avg >= 60 ? 'Mixed' : avg >= 40 ? 'Volatile' : 'Erratic'
  return { score: avg, label }
}

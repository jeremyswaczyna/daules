import type { Account, Trade, BehavioralSignal } from '@/types'

/**
 * Derives behavioral signals from trade data for a given account.
 * Signals are empty / "ok" when there is insufficient data.
 */
export function calcBehavioralSignals(account: Account, trades: Trade[]): BehavioralSignal[] {
  if (trades.length < 3) return []

  const signals: BehavioralSignal[] = []

  // ── Stop loss adherence ────────────────────────────────────────────────────
  const withSL   = trades.filter(t => t.stopLoss && t.stopLoss !== 0).length
  const slPct    = Math.round((withSL / trades.length) * 100)
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
  })

  // ── Overtrading signal ─────────────────────────────────────────────────────
  const days = new Map<string, number>()
  for (const t of trades) {
    const day = t.date.split('T')[0]
    days.set(day, (days.get(day) ?? 0) + 1)
  }
  const maxTradesInDay = Math.max(...days.values())
  const avgTradesPerDay = trades.length / days.size
  const overtradingRisk = maxTradesInDay > 8 || avgTradesPerDay > 5
  signals.push({
    id:       'overtrading',
    label:    'Overtrading Signal',
    value:    `${avgTradesPerDay.toFixed(1)} trades/day avg`,
    detail:   overtradingRisk
      ? `Peak of ${maxTradesInDay} trades in a single session detected.`
      : 'Trade frequency appears controlled.',
    severity: overtradingRisk ? 'warning' : 'ok',
  })

  // ── Loss chasing: trades taken immediately after a losing trade ────────────
  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let lossChaseCount = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const prevWasLoss = prev.outcome === 'loss' || (prev.pnl ?? 0) < 0
    const gapMs = new Date(curr.date).getTime() - new Date(prev.date).getTime()
    const gapMin = gapMs / 60_000
    if (prevWasLoss && gapMin < 30) lossChaseCount++
  }
  const lossChaseRatio = lossChaseCount / Math.max(trades.filter(t => t.outcome === 'loss' || (t.pnl ?? 0) < 0).length, 1)
  signals.push({
    id:       'loss_chasing',
    label:    'Loss Chasing',
    value:    lossChaseRatio > 0.25 ? 'Detected' : 'Not detected',
    detail:   lossChaseRatio > 0.25
      ? `${lossChaseCount} trades entered within 30 min of a loss.`
      : 'No significant pattern of revenge entries after losses.',
    severity: lossChaseRatio > 0.40 ? 'critical' : lossChaseRatio > 0.25 ? 'warning' : 'ok',
  })

  // ── Risk consistency: std dev of risk amounts ──────────────────────────────
  const riskAmounts = trades.map(t => t.riskAmount ?? 0).filter(r => r > 0)
  if (riskAmounts.length >= 5) {
    const mean    = riskAmounts.reduce((s, r) => s + r, 0) / riskAmounts.length
    const stdDev  = Math.sqrt(riskAmounts.reduce((s, r) => s + (r - mean) ** 2, 0) / riskAmounts.length)
    const cvPct   = mean > 0 ? Math.round((stdDev / mean) * 100) : 0
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
    })
  }

  // ── Win rate ───────────────────────────────────────────────────────────────
  const wins    = trades.filter(t => t.outcome === 'win' || (t.pnl ?? 0) > 0).length
  const winRate = Math.round((wins / trades.length) * 100)
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
  })

  // ── Evaluation rule proximity (if available) ───────────────────────────────
  if (account.evaluation) {
    const { maxTotalDrawdown } = account.evaluation
    const ddPct = account.startingBalance > 0
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
        ? `Approaching drawdown limit — exercise caution.`
        : `Critical: very close to max drawdown breach.`,
      severity: usedFraction < 0.5 ? 'ok' : usedFraction < 0.8 ? 'warning' : 'critical',
    })
  }

  return signals
}

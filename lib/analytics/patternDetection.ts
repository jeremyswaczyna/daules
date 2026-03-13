import type { Trade } from '@/types'

export interface TradePattern {
  id:     string
  text:   string
  weight: number   // 0–1, confidence
}

/**
 * Detects behavioral patterns in a sorted trade sequence.
 */
export function detectTradePatterns(trades: Trade[]): TradePattern[] {
  if (trades.length < 8) return []

  const sorted  = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const patterns: TradePattern[] = []

  // ── Pattern 1: Position sizing after consecutive wins ────────────────────────
  let winsBeforeSize: number[] = []
  let streakWins = 0
  for (let i = 0; i < sorted.length; i++) {
    const isWin = sorted[i].outcome === 'win' || (sorted[i].pnl ?? 0) > 0
    if (isWin) {
      streakWins++
    } else {
      streakWins = 0
    }
    if (streakWins >= 2 && i + 1 < sorted.length) {
      const nextSize = sorted[i + 1].riskAmount ?? sorted[i + 1].positionSize ?? 0
      const prevSize = sorted[i].riskAmount ?? sorted[i].positionSize ?? 0
      if (prevSize > 0) winsBeforeSize.push(nextSize / prevSize)
    }
  }
  if (winsBeforeSize.length >= 3) {
    const avgIncrease = winsBeforeSize.reduce((s, x) => s + x, 0) / winsBeforeSize.length
    if (avgIncrease > 1.25) {
      patterns.push({
        id:     'size_after_wins',
        text:   `You increase position size after consecutive wins — by ${Math.round((avgIncrease - 1) * 100)}% on average. This may reflect overconfidence.`,
        weight: Math.min(0.9, winsBeforeSize.length / 10),
      })
    }
  }

  // ── Pattern 2: Risk reduction after large losses ─────────────────────────────
  const pnlValues = sorted.map(t => t.pnl ?? 0)
  const avgLoss   = pnlValues.filter(p => p < 0).reduce((s, p) => s + p, 0) / Math.max(pnlValues.filter(p => p < 0).length, 1)
  let   riskAfterBigLoss: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const wasLarge = (prev.pnl ?? 0) < avgLoss * 1.5
    if (wasLarge) {
      const prevRisk = prev.riskAmount ?? prev.positionSize ?? 0
      const currRisk = curr.riskAmount ?? curr.positionSize ?? 0
      if (prevRisk > 0) riskAfterBigLoss.push(currRisk / prevRisk)
    }
  }
  if (riskAfterBigLoss.length >= 3) {
    const avgRatio = riskAfterBigLoss.reduce((s, x) => s + x, 0) / riskAfterBigLoss.length
    if (avgRatio < 0.75) {
      patterns.push({
        id:     'risk_reduction_after_loss',
        text:   `You reduce risk by ~${Math.round((1 - avgRatio) * 100)}% after large losses. This reflects self-regulation — a healthy response.`,
        weight: Math.min(0.85, riskAfterBigLoss.length / 8),
      })
    }
  }

  // ── Pattern 3: Late session aggression ───────────────────────────────────────
  const lateHourTrades  = sorted.filter(t => {
    try {
      const h = new Date(t.date).getHours()
      return h >= 14 && h <= 17
    } catch { return false }
  })
  const earlyHourTrades = sorted.filter(t => {
    try {
      const h = new Date(t.date).getHours()
      return h >= 9 && h <= 12
    } catch { return false }
  })
  if (lateHourTrades.length >= 4 && earlyHourTrades.length >= 4) {
    const lateRisk  = lateHourTrades.map(t => t.riskAmount ?? 0).filter(r => r > 0)
    const earlyRisk = earlyHourTrades.map(t => t.riskAmount ?? 0).filter(r => r > 0)
    if (lateRisk.length >= 3 && earlyRisk.length >= 3) {
      const lateAvg  = lateRisk.reduce((s, r) => s + r, 0) / lateRisk.length
      const earlyAvg = earlyRisk.reduce((s, r) => s + r, 0) / earlyRisk.length
      if (lateAvg > earlyAvg * 1.3) {
        patterns.push({
          id:     'late_session_aggression',
          text:   `You trade more aggressively in the afternoon session. Average risk is ${Math.round((lateAvg / earlyAvg - 1) * 100)}% higher than the morning.`,
          weight: 0.7,
        })
      }
    }
  }

  // ── Pattern 4: Win cluster behavior ─────────────────────────────────────────
  let winStreaks: number[] = []
  let curStreak = 0
  for (const t of sorted) {
    const isWin = t.outcome === 'win' || (t.pnl ?? 0) > 0
    if (isWin) { curStreak++ } else { if (curStreak >= 2) winStreaks.push(curStreak); curStreak = 0 }
  }
  if (curStreak >= 2) winStreaks.push(curStreak)
  const avgStreak = winStreaks.length > 0 ? winStreaks.reduce((s, x) => s + x, 0) / winStreaks.length : 0
  if (avgStreak >= 3 && winStreaks.length >= 2) {
    patterns.push({
      id:     'win_clustering',
      text:   `Wins tend to cluster — average streak of ${avgStreak.toFixed(1)} consecutive wins. Your performance has distinct momentum phases.`,
      weight: 0.65,
    })
  }

  return patterns.sort((a, b) => b.weight - a.weight).slice(0, 3)
}

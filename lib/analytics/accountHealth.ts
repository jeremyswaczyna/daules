import type { Account, Trade, AccountHealthBreakdown } from '@/types'

export interface HealthScore {
  score:     number
  breakdown: AccountHealthBreakdown
  label:     string
  basis:     number   // trade count used for calculation
}

/**
 * Calculate a 0–100 health score for an account based on its trade history.
 * Returns null when there is insufficient data (< 5 trades).
 */
export function calcHealthScore(account: Account, trades: Trade[]): HealthScore | null {
  if (trades.length < 5) return null

  // ── Consistency: low variance in R multiples ───────────────────────────────
  const rValues = trades.map(t => t.rMultiple).filter(r => !isNaN(r))
  let consistency = 0
  if (rValues.length >= 3) {
    const mean = rValues.reduce((s, r) => s + r, 0) / rValues.length
    const variance = rValues.reduce((s, r) => s + (r - mean) ** 2, 0) / rValues.length
    const stdDev = Math.sqrt(variance)
    // stdDev of 0 = perfect consistency (100), stdDev of 3+ = poor (0)
    consistency = Math.max(0, Math.min(100, 100 - (stdDev / 3) * 100))
  }

  // ── Drawdown control: how far from the max drawdown limit ────────────────────
  let drawdownControl = 100
  if (account.evaluation?.maxTotalDrawdown && account.startingBalance > 0) {
    const maxDDPct   = account.evaluation.maxTotalDrawdown
    const actualDDPct = account.startingBalance > 0
      ? Math.max(0, ((account.startingBalance - account.currentBalance) / account.startingBalance) * 100)
      : 0
    const usedFraction = actualDDPct / maxDDPct
    drawdownControl = Math.max(0, Math.min(100, (1 - usedFraction) * 100))
  }

  // ── Risk discipline: % of trades that used a stop loss ─────────────────────
  const tradesWithSL   = trades.filter(t => t.stopLoss && t.stopLoss !== 0).length
  const riskDiscipline = Math.round((tradesWithSL / trades.length) * 100)

  // ── Strategy adherence: % of trades tagged to an allowed strategy ──────────
  let strategyAdherence = 100
  if (account.strategies && account.strategies.length > 0) {
    const allowedSet = new Set(account.strategies.map(s => s.toLowerCase()))
    const tagged = trades.filter(t =>
      t.setup && t.setup.some(s => allowedSet.has(s.toLowerCase()))
    ).length
    strategyAdherence = Math.round((tagged / trades.length) * 100)
  }

  const score = Math.round(
    consistency       * 0.30 +
    drawdownControl   * 0.30 +
    riskDiscipline    * 0.25 +
    strategyAdherence * 0.15
  )

  const label =
    score >= 80 ? 'Excellent' :
    score >= 65 ? 'Good'      :
    score >= 50 ? 'Fair'      :
    score >= 35 ? 'Weak'      :
    'Critical'

  return {
    score,
    breakdown: { consistency: Math.round(consistency), drawdownControl: Math.round(drawdownControl), riskDiscipline, strategyAdherence },
    label,
    basis: trades.length,
  }
}

export function healthScoreColor(score: number): string {
  if (score >= 75) return '#4ade80'
  if (score >= 50) return '#fbbf24'
  return 'var(--red)'
}

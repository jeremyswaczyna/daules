import type { Account, Trade } from '@/types'

export interface PortfolioInsight {
  id:   string
  text: string
}

/**
 * Generates cross-account behavioral observations.
 * Requires at least 2 accounts with trade data.
 */
export function calcPortfolioInsights(
  accounts: Account[],
  tradesByAccount: Map<string, Trade[]>
): PortfolioInsight[] {
  const insights: PortfolioInsight[] = []

  const accountsWithTrades = accounts.filter(a => (tradesByAccount.get(a.id) ?? []).length >= 3)
  if (accountsWithTrades.length < 2) return []

  // ── 1. Compare avg R across environments ────────────────────────────────────
  const propFirmAccs  = accountsWithTrades.filter(a => a.environment === 'prop_firm')
  const personalAccs  = accountsWithTrades.filter(a => a.environment === 'live' || a.environment === 'demo')

  const avgR = (accs: Account[]) => {
    const all = accs.flatMap(a => tradesByAccount.get(a.id) ?? [])
    const rs  = all.map(t => t.rMultiple ?? 0).filter(r => !isNaN(r))
    return rs.length > 0 ? rs.reduce((s, r) => s + r, 0) / rs.length : null
  }

  const propR  = avgR(propFirmAccs)
  const liveR  = avgR(personalAccs)
  if (propR !== null && liveR !== null && Math.abs(propR - liveR) > 0.2) {
    const better  = propR > liveR ? 'prop firm' : 'live/demo'
    const worse   = propR > liveR ? 'live/demo' : 'prop firm'
    insights.push({
      id:   'r_by_env',
      text: `Your R-multiple is higher in ${better} accounts. Something about ${worse} environments changes your decision-making.`,
    })
  }

  // ── 2. Win rate across styles ────────────────────────────────────────────────
  const byStyle = new Map<string, Trade[]>()
  for (const acc of accountsWithTrades) {
    if (!acc.tradingStyle) continue
    const existing = byStyle.get(acc.tradingStyle) ?? []
    byStyle.set(acc.tradingStyle, [...existing, ...(tradesByAccount.get(acc.id) ?? [])])
  }
  if (byStyle.size >= 2) {
    const styleRates = [...byStyle.entries()].map(([style, ts]) => {
      const wins = ts.filter(t => t.outcome === 'win' || (t.pnl ?? 0) > 0).length
      return { style, rate: wins / ts.length }
    }).sort((a, b) => b.rate - a.rate)
    if (styleRates.length >= 2) {
      const best  = styleRates[0]
      const worst = styleRates[styleRates.length - 1]
      if (best.rate - worst.rate > 0.15) {
        insights.push({
          id:   'win_by_style',
          text: `Your win rate is significantly higher in ${best.style} accounts (${Math.round(best.rate * 100)}%) than ${worst.style} (${Math.round(worst.rate * 100)}%).`,
        })
      }
    }
  }

  // ── 3. Loss chasing prevalence ───────────────────────────────────────────────
  const chaseRates: { name: string; rate: number }[] = []
  for (const acc of accountsWithTrades) {
    const ts     = [...(tradesByAccount.get(acc.id) ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let chases   = 0
    const losses = ts.filter(t => (t.pnl ?? 0) < 0).length
    for (let i = 1; i < ts.length; i++) {
      const prev = ts[i - 1]
      const curr = ts[i]
      const wasLoss = prev.outcome === 'loss' || (prev.pnl ?? 0) < 0
      const gapMin  = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 60_000
      if (wasLoss && gapMin < 30) chases++
    }
    chaseRates.push({ name: acc.name, rate: chases / Math.max(losses, 1) })
  }
  const highChase = chaseRates.filter(c => c.rate > 0.3)
  if (highChase.length > 0 && highChase.length <= 2) {
    insights.push({
      id:   'loss_chasing',
      text: `Loss chasing is concentrated in "${highChase[0].name}". Other accounts show more control after losses.`,
    })
  } else if (highChase.length > 2) {
    insights.push({
      id:   'loss_chasing_global',
      text: 'Revenge entries after losses appear across multiple accounts. This is a systemic behavioral pattern.',
    })
  }

  // ── 4. Frequency pattern ─────────────────────────────────────────────────────
  const freqByEnv = new Map<string, number>()
  for (const acc of accountsWithTrades) {
    const ts   = tradesByAccount.get(acc.id) ?? []
    const days = new Set(ts.map(t => t.date.split('T')[0])).size
    const freq = days > 0 ? ts.length / days : 0
    const env  = acc.environment ?? acc.type
    const prev = freqByEnv.get(env)
    freqByEnv.set(env, prev == null ? freq : (prev + freq) / 2)
  }
  const freqs = [...freqByEnv.entries()]
  if (freqs.length >= 2) {
    const sorted = freqs.sort((a, b) => b[1] - a[1])
    const [highEnv, highFreq] = sorted[0]
    const [lowEnv, lowFreq]   = sorted[sorted.length - 1]
    if (highFreq - lowFreq > 1.5) {
      insights.push({
        id:   'freq_by_env',
        text: `You trade ${((highFreq / lowFreq) - 1 + 1).toFixed(1)}x more frequently in ${highEnv} environments than ${lowEnv}. High frequency often signals less selectivity.`,
      })
    }
  }

  return insights.slice(0, 3)
}

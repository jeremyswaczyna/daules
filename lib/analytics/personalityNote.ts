import type { Account, Trade } from '@/types'

// ── Template pools ─────────────────────────────────────────────────────────────

const CAUTIOUS = [
  'You trade this account far more cautiously than your others. That discipline is worth studying.',
  'This account shows unusually tight risk management. Whatever pressure you feel here is shaping you well.',
  'Your entries in this account are more deliberate. The patience is visible in the data.',
  'You slow down here. Whether that is fear or wisdom, the results suggest it is working.',
]

const IMPULSIVE = [
  'This account shows more impulsive trades after losses. The pattern is clear — and so is the opportunity to fix it.',
  'Revenge entries appear here more than in your other accounts. Something about this environment triggers you.',
  'The data suggests this account carries emotional weight. Your behavior changes when this balance moves.',
  'You trade this account carefully until the first loss. After that, the discipline disappears entirely.',
  'The numbers here are not random. They reflect a version of you that acts before thinking.',
]

const INCONSISTENT = [
  'Risk sizing varies widely in this account. You are not trading a system — you are trading a feeling.',
  'This account appears to believe position sizing is optional.',
  'Consistency is the missing ingredient here. The setups are there. The execution is not.',
  'Your position size has no relationship to your edge in this account. That means the results are noise, not skill.',
]

const SOLID = [
  'This is your most disciplined account. The data is consistent, measured, and calm.',
  'Strong rule adherence here. Whatever mindset you bring to this account — bring more of it.',
  'The behavioral patterns reflect a trader operating close to their best. Do not change what is working.',
  'This account shows what you are capable of when you follow your own rules. Study it.',
]

const BRUTAL = [
  'The first payout changed your behavior in this account. The discipline before it was not real — it was restraint.',
  'You know this account is losing. The data says you are trading more aggressively anyway. That is not a strategy.',
  'Every large loss here is followed by a pattern. You already know what it is. The only question is when you stop.',
  'This account would be profitable if you closed it at 2pm. You are not a morning trader who accepts that yet.',
]

const INSUFFICIENT = [
  'Not enough trades yet to read the patterns in this account. The data will tell its story soon.',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedFromId(id: string): number {
  return id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generatePersonalityNote(account: Account, trades: Trade[]): string {
  if (trades.length < 10) return pick(INSUFFICIENT, seedFromId(account.id))

  const seed = seedFromId(account.id)

  // Stop loss adherence
  const withSL   = trades.filter(t => t.stopLoss && t.stopLoss !== 0).length
  const slPct    = withSL / trades.length

  // Loss chasing
  const sorted   = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let   lossChase = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev    = sorted[i - 1]
    const curr    = sorted[i]
    const wasLoss = prev.outcome === 'loss' || (prev.pnl ?? 0) < 0
    const gapMin  = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 60_000
    if (wasLoss && gapMin < 30) lossChase++
  }
  const losses         = trades.filter(t => (t.pnl ?? 0) < 0).length
  const lossChaseRatio = lossChase / Math.max(losses, 1)

  // Risk consistency
  const rAmounts = trades.map(t => t.riskAmount ?? 0).filter(r => r > 0)
  let cvPct = 0
  if (rAmounts.length >= 5) {
    const mean = rAmounts.reduce((s, r) => s + r, 0) / rAmounts.length
    const std  = Math.sqrt(rAmounts.reduce((s, r) => s + (r - mean) ** 2, 0) / rAmounts.length)
    cvPct      = mean > 0 ? (std / mean) * 100 : 0
  }

  // Overall profitability
  const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const isLosing = totalPnl < 0 && trades.length >= 15

  // Select pool
  if (isLosing && lossChaseRatio > 0.4) {
    return pick(BRUTAL, seed)
  }
  if (lossChaseRatio > 0.35 || slPct < 0.6) {
    return pick(IMPULSIVE, seed)
  }
  if (cvPct > 50) {
    return pick(INCONSISTENT, seed)
  }
  if (slPct > 0.9 && lossChaseRatio < 0.15 && cvPct < 30) {
    return pick(SOLID, seed)
  }
  return pick(CAUTIOUS, seed)
}

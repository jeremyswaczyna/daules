import type { Account, Trade } from '@/types'

// Pool of personality templates. Placeholders: {broker}, {style}
const TEMPLATES_CAUTIOUS = [
  'You trade this account far more cautiously than your others. That discipline is worth studying.',
  'This account shows unusually tight risk management. Whatever pressure you feel here is shaping you well.',
  'Your entries in this account are more deliberate. The patience is visible in the data.',
]

const TEMPLATES_IMPULSIVE = [
  'This account shows more impulsive trades after losses. The pattern is clear — and so is the opportunity to fix it.',
  'Revenge entries appear here more than in your other accounts. Something about this environment triggers you.',
  'The data suggests this account carries emotional weight. Your behavior changes when this balance moves.',
]

const TEMPLATES_INCONSISTENT = [
  'Risk sizing varies widely in this account. You\'re not trading a system here — you\'re trading a feeling.',
  'This account appears to believe position sizing is optional.',
  'Consistency is the missing ingredient in this account. The setups are there — the execution is not.',
]

const TEMPLATES_SOLID = [
  'This is your most disciplined account. The data is consistent, measured, and calm.',
  'Strong rule adherence here. Whatever mindset you bring to this account — bring more of it.',
  'The behavioral patterns in this account reflect a trader operating close to their best.',
]

const TEMPLATES_INSUFFICIENT = [
  'Not enough trades yet to read the patterns in this account. The data will tell its story soon.',
]

// Deterministic seed from account ID for stable selection
function seedFromId(id: string): number {
  return id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

export function generatePersonalityNote(account: Account, trades: Trade[]): string {
  if (trades.length < 10) return pick(TEMPLATES_INSUFFICIENT, seedFromId(account.id))

  const seed = seedFromId(account.id)

  // Compute behavioral signals
  const withSL = trades.filter(t => t.stopLoss && t.stopLoss !== 0).length
  const slPct  = withSL / trades.length

  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let lossChase = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const wasLoss = prev.outcome === 'loss' || (prev.pnl ?? 0) < 0
    const gapMin  = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 60_000
    if (wasLoss && gapMin < 30) lossChase++
  }
  const lossChaseRatio = lossChase / Math.max(trades.filter(t => (t.pnl ?? 0) < 0).length, 1)

  const rAmounts = trades.map(t => t.riskAmount ?? 0).filter(r => r > 0)
  let cvPct = 0
  if (rAmounts.length >= 5) {
    const mean = rAmounts.reduce((s, r) => s + r, 0) / rAmounts.length
    const std  = Math.sqrt(rAmounts.reduce((s, r) => s + (r - mean) ** 2, 0) / rAmounts.length)
    cvPct = mean > 0 ? (std / mean) * 100 : 0
  }

  // Classify dominant pattern
  if (lossChaseRatio > 0.35 || slPct < 0.6) {
    return pick(TEMPLATES_IMPULSIVE, seed)
  }
  if (cvPct > 50) {
    return pick(TEMPLATES_INCONSISTENT, seed)
  }
  if (slPct > 0.9 && lossChaseRatio < 0.15 && cvPct < 30) {
    return pick(TEMPLATES_SOLID, seed)
  }
  return pick(TEMPLATES_CAUTIOUS, seed)
}

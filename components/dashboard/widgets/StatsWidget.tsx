'use client'

import type { Trade } from '@/types'
import { calcWinRate, calcAvgR, calcNetPnL } from '@/lib/calculations'

interface Props { trades: Trade[] }

export default function StatsWidget({ trades }: Props) {
  const netPnL   = calcNetPnL(trades)
  const winRate  = calcWinRate(trades)
  const avgR     = calcAvgR(trades)
  const total    = trades.length

  const stats = [
    {
      label: 'Net P&L',
      value: `${netPnL >= 0 ? '+' : ''}$${Math.abs(netPnL) >= 1000 ? `${(netPnL / 1000).toFixed(1)}k` : netPnL.toFixed(2)}`,
      color: netPnL > 0 ? 'var(--green)' : netPnL < 0 ? 'var(--red)' : 'var(--fg)',
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      color: winRate >= 50 ? 'var(--green)' : winRate === 0 ? 'var(--fg)' : 'var(--red)',
    },
    {
      label: 'Avg R:R',
      value: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`,
      color: avgR > 0 ? 'var(--green)' : avgR < 0 ? 'var(--red)' : 'var(--fg)',
    },
    {
      label: 'Trades',
      value: String(total),
      color: 'var(--fg)',
    },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 1, background: 'var(--border)',
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ background: 'var(--bg-card)', padding: '20px 22px' }}>
          <span style={{
            display: 'block',
            fontSize: '0.5625rem', fontWeight: 600,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: 'var(--fg-dim)', marginBottom: 10,
          }}>
            {s.label}
          </span>
          <span style={{
            fontSize: '1.5rem', fontWeight: 500,
            letterSpacing: '-0.05em', lineHeight: 1,
            color: s.color,
          }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}

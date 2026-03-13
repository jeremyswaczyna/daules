'use client'

import { useEffect, useRef, useState } from 'react'
import type { Account, Trade } from '@/types'
import { calcTotalInvested } from '../AccountCard'
import { calcHealthScore, healthScoreColor } from '@/lib/analytics/accountHealth'

interface Props {
  account: Account
  trades:  Trade[]
}

interface Metric {
  label: string
  value: string
  sub?:  string
  color: string
}

function calcMetrics(account: Account, trades: Trade[]): Metric[] {
  const invested  = calcTotalInvested(account)
  const payouts   = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const net       = payouts - invested
  const retPct    = invested > 0 ? ((net / invested) * 100) : 0

  const wins      = trades.filter(t => t.outcome === 'win' || (t.pnl ?? 0) > 0).length
  const winRate   = trades.length > 0 ? Math.round((wins / trades.length) * 100) : null

  const rVals     = trades.map(t => t.rMultiple).filter(r => !isNaN(r))
  const avgR      = rVals.length > 0 ? rVals.reduce((s, r) => s + r, 0) / rVals.length : null

  const gross     = trades.filter(t => (t.pnl ?? 0) > 0).reduce((s, t) => s + (t.pnl ?? 0), 0)
  const lossTotal = Math.abs(trades.filter(t => (t.pnl ?? 0) < 0).reduce((s, t) => s + (t.pnl ?? 0), 0))
  const pf        = lossTotal > 0 ? gross / lossTotal : gross > 0 ? 99 : null

  const ddPct     = account.startingBalance > 0
    ? Math.max(0, ((account.startingBalance - account.currentBalance) / account.startingBalance) * 100)
    : 0

  const health    = calcHealthScore(account, trades)

  return [
    {
      label: 'Net P&L',
      value: invested > 0 ? `${net >= 0 ? '+' : ''}$${Math.abs(net).toLocaleString()}` : '—',
      sub:   invested > 0 ? `${retPct >= 0 ? '+' : ''}${retPct.toFixed(1)}% return` : undefined,
      color: invested > 0 ? (net >= 0 ? '#4ade80' : 'var(--red)') : 'var(--fg-muted)',
    },
    {
      label: 'Win Rate',
      value: winRate != null ? `${winRate}%` : '—',
      sub:   trades.length > 0 ? `${wins}W / ${trades.length - wins}L / ${trades.length} total` : undefined,
      color: winRate != null ? (winRate >= 55 ? '#4ade80' : winRate >= 40 ? '#fbbf24' : 'var(--red)') : 'var(--fg-muted)',
    },
    {
      label: 'Avg R',
      value: avgR != null ? `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R` : '—',
      sub:   pf != null ? `${pf === 99 ? '∞' : pf.toFixed(2)} profit factor` : undefined,
      color: avgR != null ? (avgR >= 0 ? '#4ade80' : 'var(--red)') : 'var(--fg-muted)',
    },
    {
      label: 'Max Drawdown',
      value: `${ddPct.toFixed(1)}%`,
      sub:   account.evaluation?.maxTotalDrawdown ? `of ${account.evaluation.maxTotalDrawdown}% limit` : undefined,
      color: ddPct > 8 ? 'var(--red)' : ddPct > 4 ? '#fbbf24' : 'var(--fg-muted)',
    },
    {
      label: 'Health Score',
      value: health ? `${health.score}` : trades.length < 5 ? '—' : '—',
      sub:   health ? health.label : trades.length < 5 ? 'Need 5+ trades' : undefined,
      color: health ? healthScoreColor(health.score) : 'var(--fg-muted)',
    },
  ]
}

// Count-up animation hook
function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

function MetricCard({ label, value, sub, color }: Metric) {
  // Try to extract a numeric part for count-up
  const numericMatch = value.match(/[\d.]+/)
  const numericVal   = numericMatch ? parseFloat(numericMatch[0]) : null
  const animated     = useCountUp(numericVal ?? 0, 700)

  const displayValue = numericVal != null && value !== '—'
    ? value.replace(numericMatch![0], animated.toString())
    : value

  return (
    <div style={{
      padding: '16px 18px', borderRadius: 12,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-xdim)' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color, letterSpacing: '-0.05em', lineHeight: 1 }}>
        {displayValue}
      </p>
      {sub && (
        <p style={{ margin: '5px 0 0', fontSize: '0.6875rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function AccountMetricCards({ account, trades }: Props) {
  const metrics = calcMetrics(account, trades)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
      {metrics.map(m => <MetricCard key={m.label} {...m} />)}
    </div>
  )
}

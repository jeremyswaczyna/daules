'use client'

import { useMemo } from 'react'
import type { Account, Trade } from '@/types'

interface Props {
  account: Account
  trades:  Trade[]
}

interface StrategyStats {
  name:        string
  count:       number
  wins:        number
  winRate:     number
  avgR:        number
  totalPnl:    number
  profitFactor: number
}

function calcStrategyStats(trades: Trade[]): StrategyStats[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const tags = t.setup && t.setup.length > 0 ? t.setup : ['Untagged']
    for (const tag of tags) {
      const prev = map.get(tag) ?? []
      map.set(tag, [...prev, t])
    }
  }

  return [...map.entries()]
    .map(([name, ts]) => {
      const wins   = ts.filter(t => t.outcome === 'win' || (t.pnl ?? 0) > 0).length
      const rVals  = ts.map(t => t.rMultiple).filter(r => !isNaN(r))
      const avgR   = rVals.length > 0 ? rVals.reduce((s, r) => s + r, 0) / rVals.length : 0
      const gross  = ts.filter(t => (t.pnl ?? 0) > 0).reduce((s, t) => s + (t.pnl ?? 0), 0)
      const loss   = Math.abs(ts.filter(t => (t.pnl ?? 0) < 0).reduce((s, t) => s + (t.pnl ?? 0), 0))
      return {
        name,
        count:        ts.length,
        wins,
        winRate:      Math.round((wins / ts.length) * 100),
        avgR:         Math.round(avgR * 100) / 100,
        totalPnl:     ts.reduce((s, t) => s + (t.pnl ?? 0), 0),
        profitFactor: loss > 0 ? Math.round((gross / loss) * 100) / 100 : gross > 0 ? 99 : 0,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export default function AccountStrategiesTab({ account, trades }: Props) {
  const stats = useMemo(() => calcStrategyStats(trades), [trades])
  const maxCount = Math.max(...stats.map(s => s.count), 1)

  if (trades.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
          No trades yet
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          Tag your trades with strategies to see performance breakdowns here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Allowed strategies from account config */}
      {account.strategies && account.strategies.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
            Allowed in this account
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {account.strategies.map(s => (
              <span key={s} style={{
                padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 500,
                background: 'rgba(255,255,255,0.06)', color: 'var(--fg-muted)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strategy performance table */}
      <div>
        <p style={{ margin: '0 0 12px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
          Performance by Strategy
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stats.map(s => {
            const barWidth = (s.count / maxCount) * 100
            const pnlColor = s.totalPnl >= 0 ? '#4ade80' : 'var(--red)'
            const wrColor  = s.winRate >= 55 ? '#4ade80' : s.winRate >= 40 ? '#fbbf24' : 'var(--red)'

            return (
              <div key={s.name} style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fg-xdim)' }}>
                      {s.count} trade{s.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: pnlColor, letterSpacing: '-0.03em' }}>
                    {s.totalPnl >= 0 ? '+' : ''}${s.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* Bar */}
                <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, width: `${barWidth}%`,
                    background: 'rgba(255,255,255,0.18)', transition: 'width 0.6s ease',
                  }} />
                </div>

                {/* Metric pills */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <MetricPill label="Win Rate"  value={`${s.winRate}%`}  color={wrColor} />
                  <MetricPill label="Avg R"     value={`${s.avgR >= 0 ? '+' : ''}${s.avgR}R`}   color={s.avgR >= 0 ? '#4ade80' : 'var(--red)'} />
                  <MetricPill label="Profit Factor" value={s.profitFactor === 99 ? '∞' : `${s.profitFactor}`} color={s.profitFactor >= 1 ? '#4ade80' : 'var(--red)'} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 1px', fontSize: '0.5625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color, letterSpacing: '-0.03em' }}>{value}</p>
    </div>
  )
}

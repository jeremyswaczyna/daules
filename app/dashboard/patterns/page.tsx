'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAccount } from '@/lib/account-context'
import { getTrades } from '@/lib/firestore/trades'
import { discoverPatterns, type Pattern } from '@/lib/calculations'
import type { Trade } from '@/types'

const CONFIDENCE_META: Record<Pattern['confidence'], { label: string; color: string; bg: string }> = {
  high:   { label: 'High confidence',   color: '#6ee7a0', bg: 'rgba(110,231,160,0.1)'  },
  medium: { label: 'Medium confidence', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  low:    { label: 'Low confidence',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const conf = CONFIDENCE_META[pattern.confidence]
  const isPositive = pattern.pnlImpact >= 0
  const diff = pattern.value - pattern.baseline

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'border-color 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = conf.color + '44'
        el.style.boxShadow = `0 0 0 1px ${conf.color}22, 0 4px 20px rgba(0,0,0,0.06)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{
            margin: 0,
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.025em',
            color: 'var(--fg)',
            lineHeight: 1.35,
          }}>
            {pattern.title}
          </p>
          <p style={{
            margin: '6px 0 0',
            fontSize: '0.8125rem',
            color: 'var(--fg-muted)',
            lineHeight: 1.55,
            letterSpacing: '-0.01em',
          }}>
            {pattern.description}
          </p>
        </div>
        <div style={{
          flexShrink: 0,
          padding: '3px 9px',
          borderRadius: 20,
          background: conf.bg,
          border: `1px solid ${conf.color}33`,
        }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: conf.color, whiteSpace: 'nowrap' }}>
            {conf.label}
          </span>
        </div>
      </div>

      {/* Metric bar */}
      <div style={{
        display: 'flex', gap: 0,
        background: 'var(--bg-sub,rgba(0,0,0,0.03))',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <MetricCell label={pattern.metric} value={`${pattern.value.toFixed(1)}%`} color={diff >= 0 ? 'var(--green)' : 'var(--red)'} />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <MetricCell label="vs baseline" value={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`} color={diff >= 0 ? 'var(--green)' : 'var(--red)'} />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <MetricCell label="P&L impact" value={`${isPositive ? '+' : ''}$${Math.abs(pattern.pnlImpact).toFixed(0)}`} color={isPositive ? 'var(--green)' : 'var(--red)'} />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <MetricCell label="Sample" value={`${pattern.sampleSize}t`} color="var(--fg)" />
      </div>

      {/* Win rate bar visual */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>Win rate</span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>Baseline {pattern.baseline.toFixed(0)}%</span>
        </div>
        <div style={{ position: 'relative', height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {/* Baseline marker */}
          <div style={{
            position: 'absolute',
            left: `${Math.min(100, pattern.baseline)}%`,
            top: 0, bottom: 0, width: 2,
            background: 'var(--fg-muted)',
            borderRadius: 2,
            opacity: 0.5,
          }} />
          {/* Value bar */}
          <div style={{
            height: '100%',
            width: `${Math.min(100, pattern.value)}%`,
            background: diff >= 0 ? '#16a34a' : '#dc2626',
            borderRadius: 4,
            opacity: 0.7,
            transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      </div>
    </div>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, padding: '8px 10px', textAlign: 'center', minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: '0.5625rem', color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color }}>{value}</p>
    </div>
  )
}

function EmptyState({ tradeCount }: { tradeCount: number }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 24px', gap: 12, textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--bg-sub,rgba(0,0,0,0.04))',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.25rem', marginBottom: 4,
      }}>
        🔍
      </div>
      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.025em' }}>
        {tradeCount < 10 ? 'Not enough data yet' : 'No patterns found'}
      </p>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', maxWidth: 340, lineHeight: 1.6 }}>
        {tradeCount < 10
          ? `Log ${10 - tradeCount} more ${10 - tradeCount === 1 ? 'trade' : 'trades'} to start discovering behavioral patterns in your trading.`
          : 'Your trades are evenly distributed — keep logging to surface edge-defining patterns.'}
      </p>
    </div>
  )
}

export default function PatternsPage() {
  const { selectedAccount, user } = useAccount()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Pattern['confidence'] | 'all'>('all')

  useEffect(() => {
    if (!user || !selectedAccount) { setLoading(false); return }
    setLoading(true)
    getTrades(user.uid, selectedAccount.id)
      .then(setTrades)
      .catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [user, selectedAccount])

  const allPatterns = useMemo(() => discoverPatterns(trades), [trades])
  const patterns = useMemo(
    () => filter === 'all' ? allPatterns : allPatterns.filter(p => p.confidence === filter),
    [allPatterns, filter]
  )

  const counts = useMemo(() => ({
    all:    allPatterns.length,
    high:   allPatterns.filter(p => p.confidence === 'high').length,
    medium: allPatterns.filter(p => p.confidence === 'medium').length,
    low:    allPatterns.filter(p => p.confidence === 'low').length,
  }), [allPatterns])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
            Pattern Vault
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            Statistically significant edges and drags discovered in your trading data
          </p>
        </div>

        {/* Confidence filter */}
        {allPatterns.length > 0 && (
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map(f => {
              const color = f === 'all' ? 'var(--fg)' : CONFIDENCE_META[f as Pattern['confidence']].color
              const count = counts[f]
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: `1px solid ${filter === f ? color + '66' : 'var(--border)'}`,
                    background: filter === f ? (f === 'all' ? 'var(--nav-active-bg)' : CONFIDENCE_META[f as Pattern['confidence']].bg) : 'transparent',
                    color: filter === f ? color : 'var(--fg-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '-0.01em',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{f}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%',
                    background: filter === f ? (f === 'all' ? 'var(--fg)' : color) : 'var(--border)',
                    color: filter === f ? 'var(--bg)' : 'var(--fg-dim)',
                    fontSize: '0.5625rem', fontWeight: 700,
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          {allPatterns.length > 0 && (
            <div
              className="rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden' }}
            >
              <div className="flex">
                {[
                  { label: 'Patterns found', value: allPatterns.length, color: 'var(--fg)' },
                  { label: 'High confidence', value: counts.high, color: '#6ee7a0' },
                  { label: 'P&L from edges', value: `$${allPatterns.filter(p => p.pnlImpact > 0).reduce((s, p) => s + p.pnlImpact, 0).toFixed(0)}`, color: 'var(--green)' },
                  { label: 'P&L from drags', value: `$${Math.abs(allPatterns.filter(p => p.pnlImpact < 0).reduce((s, p) => s + p.pnlImpact, 0)).toFixed(0)}`, color: 'var(--red)' },
                ].map((stat, i) => (
                  <div key={stat.label} style={{
                    flex: 1, padding: '14px 0', textAlign: 'center',
                    borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                  }}>
                    <p style={{ margin: 0, fontSize: '0.5625rem', color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{stat.label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.035em', color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pattern grid */}
          <div className="grid lg:grid-cols-2 gap-4">
            {patterns.length === 0
              ? <EmptyState tradeCount={trades.length} />
              : patterns.map(p => <PatternCard key={p.id} pattern={p} />)
            }
          </div>

          {/* Footer note */}
          {trades.length >= 10 && (
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--fg-dim)', letterSpacing: '-0.01em' }}>
              Patterns require ≥5 sample trades per segment and ≥12–18% edge vs your baseline win rate of {(trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(0)}%.
            </p>
          )}
        </>
      )}
    </div>
  )
}

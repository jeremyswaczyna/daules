'use client'

import { useMemo } from 'react'
import { calcBehavioralSignals } from '@/lib/analytics/behavioralSignals'
import { generatePersonalityNote } from '@/lib/analytics/personalityNote'
import { detectTradePatterns } from '@/lib/analytics/patternDetection'
import type { Account, Trade, BehavioralSignal, BehavioralTrend } from '@/types'

interface Props {
  account: Account
  trades:  Trade[]
}

const SEV_STYLES: Record<BehavioralSignal['severity'], { bg: string; border: string; dot: string }> = {
  ok:       { bg: 'var(--green-bg)',  border: 'var(--green-bd)',  dot: 'var(--green)'  },
  warning:  { bg: 'var(--amber-bg)',  border: 'var(--amber-bd)',  dot: 'var(--amber)'  },
  critical: { bg: 'var(--red-bg)',    border: 'var(--red-bd)',    dot: 'var(--red)'    },
}

const TREND_ICON: Record<BehavioralTrend, { icon: string; color: string }> = {
  improving: { icon: '▲', color: 'var(--green)'    },
  declining: { icon: '▼', color: 'var(--red)'      },
  stable:    { icon: '→', color: 'var(--fg-xdim)'  },
}

export default function AccountBehaviorTab({ account, trades }: Props) {
  const signals  = useMemo(() => calcBehavioralSignals(account, trades), [account, trades])
  const note     = useMemo(() => {
    if (trades.length < 10) return null
    return generatePersonalityNote(account, trades)
  }, [account, trades])
  const patterns = useMemo(() => detectTradePatterns(trades), [trades])

  if (trades.length < 3) {
    return <EmptyBehavior />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Personality note */}
      {note && (
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-xdim)' }}>
            Daules Observes
          </p>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.55, letterSpacing: '-0.01em', fontStyle: 'italic' }}>
            &ldquo;{note}&rdquo;
          </p>
        </div>
      )}

      {/* Signal cards */}
      <div>
        <p style={{ margin: '0 0 12px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
          Behavioral Signals
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {signals.map(sig => {
            const s     = SEV_STYLES[sig.severity]
            const trend = sig.trend ? TREND_ICON[sig.trend] : null
            return (
              <div key={sig.id} style={{
                padding: '14px 16px', borderRadius: 12,
                background: s.bg, border: `1px solid ${s.border}`,
                transition: `border-color var(--dur-fast)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: '-0.01em', flex: 1 }}>
                    {sig.label}
                  </span>
                  {trend && (
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, color: trend.color,
                      letterSpacing: '0.02em',
                    }}>
                      {trend.icon}
                    </span>
                  )}
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.04em' }}>
                  {sig.value}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.45 }}>
                  {sig.detail}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pattern detection */}
      {patterns.length > 0 && (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
            Detected Patterns
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map(p => (
              <div key={p.id} style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  background: 'var(--bg-sub)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  <span style={{ fontSize: '0.5625rem', color: 'var(--fg-dim)' }}>⚡</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade basis note */}
      <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-xdim)', letterSpacing: '-0.01em' }}>
        Based on {trades.length} trades in this account.
        {trades.length < 20 && ' Signals improve with more data.'}
      </p>
    </div>
  )
}

function EmptyBehavior() {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
        Not enough data yet
      </p>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
        Add at least 3 trades to this account to unlock behavioral signals.
        Daules watches for patterns in risk, timing, and discipline.
      </p>
    </div>
  )
}

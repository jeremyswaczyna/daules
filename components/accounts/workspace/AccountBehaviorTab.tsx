'use client'

import { useMemo } from 'react'
import { calcBehavioralSignals } from '@/lib/analytics/behavioralSignals'
import { generatePersonalityNote } from '@/lib/analytics/personalityNote'
import type { Account, Trade, BehavioralSignal } from '@/types'

interface Props {
  account: Account
  trades:  Trade[]
}

const SEV_STYLES: Record<BehavioralSignal['severity'], { bg: string; border: string; dot: string }> = {
  ok:       { bg: 'rgba(74,222,128,0.05)',  border: 'rgba(74,222,128,0.15)',  dot: '#4ade80'        },
  warning:  { bg: 'rgba(251,191,36,0.05)',  border: 'rgba(251,191,36,0.15)',  dot: '#fbbf24'        },
  critical: { bg: 'rgba(239,68,68,0.05)',   border: 'rgba(239,68,68,0.15)',   dot: 'var(--red)'     },
}

export default function AccountBehaviorTab({ account, trades }: Props) {
  const signals = useMemo(() => calcBehavioralSignals(account, trades), [account, trades])
  const note    = useMemo(() => {
    if (trades.length < 10) return null
    return generatePersonalityNote(account, trades)
  }, [account, trades])

  if (trades.length < 3) {
    return (
      <EmptyBehavior />
    )
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
            "{note}"
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
            const s = SEV_STYLES[sig.severity]
            return (
              <div key={sig.id} style={{
                padding: '14px 16px', borderRadius: 12,
                background: s.bg, border: `1px solid ${s.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                    {sig.label}
                  </span>
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

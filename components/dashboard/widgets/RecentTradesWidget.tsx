'use client'

import { useState } from 'react'
import { Plus, TrendingDown } from 'lucide-react'
import type { Trade } from '@/types'
import DirectionBadge from '@/components/ui/DirectionBadge'
import { format } from 'date-fns'

interface Props {
  trades: Trade[]
  loading: boolean
  onLogTrade: () => void
}

export default function RecentTradesWidget({ trades, loading, onLogTrade }: Props) {
  const recent = trades.slice(0, 8)

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
          Recent trades
        </span>
        {trades.length > 0 && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>
            {trades.length} total
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 6, background: 'var(--bg-sub)', animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <TrendingDown size={26} style={{ color: 'var(--fg-xdim)' }} />
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fg-muted)' }}>No trades logged yet</p>
          <button
            onClick={onLogTrade}
            className="btn-press"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 9999,
              background: 'var(--fg)', color: 'var(--bg)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em',
            }}
          >
            <Plus size={13} /> Log first trade
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Symbol', 'Direction', 'Setup', 'P&L', 'R'].map(h => (
                  <th key={h} style={{
                    padding: '9px 20px', textAlign: 'left',
                    fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em',
                    textTransform: 'uppercase', color: 'var(--fg-dim)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((t, i) => (
                <TradeRow key={t.id} trade={t} last={i === recent.length - 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade: t, last }: { trade: Trade; last: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: !last ? '1px solid var(--border)' : 'none',
        background: hov ? 'var(--nav-hover-bg)' : 'transparent',
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}
    >
      <td style={{ padding: '10px 20px', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
        {(() => { try { return format(new Date(t.date), 'MMM d, yyyy') } catch { return t.date } })()}
      </td>
      <td style={{ padding: '10px 20px', fontWeight: 500, color: 'var(--fg)' }}>{t.symbol}</td>
      <td style={{ padding: '10px 20px' }}><DirectionBadge direction={t.direction} /></td>
      <td style={{ padding: '10px 20px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {t.setup.slice(0, 2).map(s => (
            <span key={s} style={{
              fontSize: '0.6875rem', padding: '2px 7px', borderRadius: 9999,
              background: 'var(--bg-sub)', color: 'var(--fg-muted)',
            }}>{s}</span>
          ))}
        </div>
      </td>
      <td style={{ padding: '10px 20px', fontWeight: 500, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
      </td>
      <td style={{ padding: '10px 20px', color: t.rMultiple >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {t.rMultiple >= 0 ? '+' : ''}{t.rMultiple.toFixed(2)}R
      </td>
    </tr>
  )
}

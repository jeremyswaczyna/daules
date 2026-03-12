'use client'

import type { Account } from '@/types'

interface Props {
  accounts: Account[]
}

interface Row {
  account: Account
  totalCost: number
  totalPayouts: number
  net: number
  breakEvenPayouts: number
  days: number
}

export default function ProfitabilityTracker({ accounts }: Props) {
  const rows: Row[] = accounts.map(acc => {
    const days = Math.floor((Date.now() - new Date(acc.createdAt).getTime()) / 86_400_000)
    const monthsRunning = Math.max(1, Math.ceil(days / 30))
    const totalCost = (acc.accountCost ?? 0) + (acc.monthlyFee ?? 0) * monthsRunning
    const totalPayouts = (acc.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
    const net = totalPayouts - totalCost
    // Break-even = how many more same-size payouts needed to cover remaining cost
    const avgPayout = acc.payoutHistory?.length
      ? totalPayouts / acc.payoutHistory.length
      : 0
    const breakEvenPayouts = net < 0 && avgPayout > 0
      ? Math.ceil(Math.abs(net) / avgPayout)
      : 0
    return { account: acc, totalCost, totalPayouts, net, breakEvenPayouts, days }
  })

  const grandTotalCost     = rows.reduce((s, r) => s + r.totalCost, 0)
  const grandTotalPayouts  = rows.reduce((s, r) => s + r.totalPayouts, 0)
  const grandNet           = grandTotalPayouts - grandTotalCost

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {[
          { label: 'Total Invested', value: `$${grandTotalCost.toFixed(2)}`, color: 'var(--amber)' },
          { label: 'Total Payouts',  value: `$${grandTotalPayouts.toFixed(2)}`, color: 'var(--green)' },
          { label: 'Net Profit',     value: `${grandNet >= 0 ? '+' : ''}$${grandNet.toFixed(2)}`, color: grandNet >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: '16px 20px',
            borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
          }}>
            <p style={{ margin: 0, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
              {s.label}
            </p>
            <p style={{ margin: '5px 0 0', fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.04em', color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Per-account table */}
      {rows.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              Per-Account Breakdown
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  {['Account', 'Days', 'Cost', 'Payouts', 'Net', 'Break-even'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 18px', textAlign: i === 0 ? 'left' : 'right',
                      fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em',
                      textTransform: 'uppercase', color: 'var(--fg-dim)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.account.id} style={{ borderTop: ri > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <p style={{ margin: 0, fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>{r.account.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--fg-dim)', textTransform: 'capitalize' }}>{r.account.type}</p>
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--fg-muted)' }}>
                      {r.days}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--amber)', fontWeight: 500 }}>
                      ${r.totalCost.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--green)', fontWeight: 500 }}>
                      ${r.totalPayouts.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 600 }}>
                      <span style={{ color: r.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {r.net >= 0 ? '+' : ''}${r.net.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--fg-muted)', fontSize: '0.75rem' }}>
                      {r.net >= 0
                        ? <span style={{ color: 'var(--green)' }}>✓ Profitable</span>
                        : r.breakEvenPayouts > 0
                        ? `${r.breakEvenPayouts} more payout${r.breakEvenPayouts !== 1 ? 's' : ''}`
                        : 'No payout history'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
          Add accounts in Settings to see profitability data.
        </div>
      )}
    </div>
  )
}

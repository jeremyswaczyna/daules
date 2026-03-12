'use client'

import { useState } from 'react'
import { Edit2, Plus } from 'lucide-react'
import type { Account, Trade } from '@/types'
import AccountModal from '@/components/settings/AccountModal'

const TYPE_COLORS = {
  funded:     { bg: 'var(--green-bg)', color: 'var(--green)',    border: 'var(--green-bd)' },
  evaluation: { bg: 'var(--amber-bg)', color: 'var(--amber)',    border: 'var(--amber-bd)' },
  personal:   { bg: 'var(--bg-sub)',   color: 'var(--fg-muted)', border: 'var(--border)'   },
} as const

interface AccountWithTrades extends Account {
  trades: Trade[]
}

interface Props {
  uid: string
  accounts: Account[]
  tradesMap: Record<string, Trade[]>
  onAccountUpdated: (account: Account) => void
}

function netPnL(trades: Trade[]) {
  return trades.reduce((sum, t) => sum + t.pnl, 0)
}

function winRate(trades: Trade[]) {
  if (!trades.length) return 0
  return (trades.filter(t => t.pnl > 0).length / trades.length) * 100
}

export default function AccountsTab({ uid, accounts, tradesMap, onAccountUpdated }: Props) {
  const [editing, setEditing]           = useState<Account | null>(null)
  const [showPayoutFor, setShowPayoutFor] = useState<string | null>(null)

  const rows: AccountWithTrades[] = accounts.map(a => ({
    ...a,
    trades: tradesMap[a.id] ?? [],
  }))

  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10 }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>No accounts yet.</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--fg-dim)' }}>Add one in Settings to start tracking.</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map(acc => {
          const pnl   = netPnL(acc.trades)
          const wr    = winRate(acc.trades)
          const colors = TYPE_COLORS[acc.type]
          const days  = Math.floor((Date.now() - new Date(acc.createdAt).getTime()) / 86_400_000)
          const totalCost = (acc.accountCost ?? 0) + (acc.monthlyFee ?? 0) * Math.ceil(days / 30)
          const totalPayouts = (acc.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
          const net   = totalPayouts - totalCost

          return (
            <div key={acc.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Account header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
                        {acc.name}
                      </span>
                      <span style={{
                        fontSize: '0.625rem', padding: '2px 8px', borderRadius: 9999,
                        background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`,
                        textTransform: 'capitalize', fontWeight: 500,
                      }}>
                        {acc.type}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)', marginTop: 2 }}>
                      {acc.broker} · {acc.currency} {acc.startingBalance.toLocaleString()}
                      {days > 0 ? ` · running ${days} day${days !== 1 ? 's' : ''}` : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(acc)}
                  style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <Edit2 size={14} />
                </button>
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'Net P&L',   value: `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`,  color: pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--fg-muted)' },
                  { label: 'Win Rate',  value: `${wr.toFixed(1)}%`,                                    color: wr >= 50 ? 'var(--green)' : acc.trades.length === 0 ? 'var(--fg-muted)' : 'var(--red)' },
                  { label: 'Trades',    value: acc.trades.length.toString(),                            color: 'var(--fg)' },
                  { label: 'Balance',   value: `$${acc.currentBalance.toLocaleString()}`,               color: 'var(--fg)' },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: '12px 16px',
                    borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                  }}>
                    <p style={{ margin: 0, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
                      {s.label}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.03em', color: s.color }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Cost / payout summary */}
              {(acc.accountCost != null || acc.monthlyFee != null || (acc.payoutHistory?.length ?? 0) > 0) && (
                <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {acc.accountCost != null && (
                      <Kpi label={acc.type === 'evaluation' ? 'Challenge Fee' : 'Purchase Price'} value={`$${acc.accountCost}`} color="var(--amber)" />
                    )}
                    {acc.monthlyFee != null && (
                      <Kpi label="Monthly Fee" value={`$${acc.monthlyFee}/mo`} color="var(--fg-muted)" />
                    )}
                    <Kpi label="Total Cost" value={`$${totalCost.toFixed(2)}`} color="var(--red)" />
                    <Kpi label="Total Payouts" value={`$${totalPayouts.toFixed(2)}`} color="var(--green)" />
                    <Kpi label="Net" value={`${net >= 0 ? '+' : ''}$${net.toFixed(2)}`} color={net >= 0 ? 'var(--green)' : 'var(--red)'} />
                  </div>

                  {/* Payout history toggle */}
                  {(acc.payoutHistory?.length ?? 0) > 0 && (
                    <button
                      onClick={() => setShowPayoutFor(showPayoutFor === acc.id ? null : acc.id)}
                      style={{
                        fontSize: '0.6875rem', color: 'var(--fg-dim)', background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {showPayoutFor === acc.id ? 'Hide' : 'Show'} payouts ({acc.payoutHistory?.length})
                    </button>
                  )}
                </div>
              )}

              {/* Payout history */}
              {showPayoutFor === acc.id && acc.payoutHistory && acc.payoutHistory.length > 0 && (
                <div style={{ padding: '0 18px 14px', animation: 'fadeIn 0.15s ease both' }}>
                  <div style={{ background: 'var(--bg-sub)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {acc.payoutHistory.map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--fg)', fontWeight: 500 }}>
                            {p.date}
                          </span>
                          {p.note && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)', marginLeft: 8 }}>{p.note}</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--green)' }}>
                          +${p.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <AccountModal
          account={editing}
          uid={uid}
          onSave={updated => { onAccountUpdated(updated); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }`}</style>
    </>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
        {label}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.03em', color }}>
        {value}
      </p>
    </div>
  )
}

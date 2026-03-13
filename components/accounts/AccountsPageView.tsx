'use client'

import { useMemo, useState } from 'react'
import { Plus, Wallet, ChevronDown, ChevronUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Account, AccountStatus } from '@/types'
import AccountCard, { calcTotalInvested } from './AccountCard'
import AccountGridCard from './AccountGridCard'
import AccountForm from './AccountForm'
import AccountComparison from './AccountComparison'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { deleteAccount } from '@/lib/firestore/accounts'
import { calcBehaviorStabilityScore } from '@/lib/analytics/behavioralSignals'
import { calcPortfolioInsights } from '@/lib/analytics/portfolioInsights'

interface Props {
  accounts:         Account[]
  uid:              string
  onAccountsChange: (accounts: Account[]) => void
}

const STATUS_BADGE: Record<AccountStatus, { bg: string; color: string; border: string }> = {
  Active:    { bg: 'var(--green-bg)',  color: 'var(--green)',    border: 'var(--green-bd)' },
  Passed:    { bg: 'var(--green-bg)',  color: 'var(--green)',    border: 'var(--green-bd)' },
  Failed:    { bg: 'var(--red-bg)',    color: 'var(--red)',      border: 'var(--red-bd)'   },
  Paused:    { bg: 'var(--amber-bg)',  color: 'var(--amber)',    border: 'var(--amber-bd)' },
  Withdrawn: { bg: 'var(--bg-sub)',    color: 'var(--fg-muted)', border: 'var(--border)'   },
}

const TYPE_BADGE = {
  funded:     { bg: 'var(--green-bg)',  color: 'var(--green)',    border: 'var(--green-bd)' },
  evaluation: { bg: 'var(--amber-bg)',  color: 'var(--amber)',    border: 'var(--amber-bd)' },
  personal:   { bg: 'var(--bg-sub)',    color: 'var(--fg-muted)', border: 'var(--border)'   },
}

// Empty trade map — trades not loaded at overview level
const EMPTY_TRADE_MAP = new Map<string, import('@/types').Trade[]>()

export default function AccountsPageView({ accounts, uid, onAccountsChange }: Props) {
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [historyOpen,  setHistoryOpen]  = useState(true)
  const [compareMode,  setCompareMode]  = useState(false)
  const [viewMode,     setViewMode]     = useState<'compact' | 'insight'>('compact')

  const handleSave = (account: Account) => {
    const exists = accounts.find(a => a.id === account.id)
    const next   = exists
      ? accounts.map(a => a.id === account.id ? account : a)
      : [...accounts, account]
    onAccountsChange(next)
    setShowModal(false)
    setEditing(null)
  }

  const handleEdit = (account: Account) => {
    setEditing(account)
    setShowModal(true)
  }

  const handleUpdated = (updated: Account) => {
    onAccountsChange(accounts.map(a => a.id === updated.id ? updated : a))
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAccount(uid, deleteTarget)
      onAccountsChange(accounts.filter(a => a.id !== deleteTarget))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const active = accounts.filter(a => !a.status || a.status === 'Active')

  // ── Portfolio aggregates ─────────────────────────────────────────────────────
  const totalInvested = useMemo(() =>
    accounts.reduce((s, a) => s + calcTotalInvested(a), 0), [accounts])

  const totalPayouts = useMemo(() =>
    accounts.reduce((s, a) => s + (a.payoutHistory ?? []).reduce((x, p) => x + p.amount, 0), 0), [accounts])

  const net        = totalPayouts - totalInvested
  const bePercent  = totalInvested > 0 ? Math.min(100, (totalPayouts / totalInvested) * 100) : 0
  const houseMoney = totalInvested > 0 && totalPayouts >= totalInvested

  // Confidence: payout consistency — how regularly payouts arrive
  const confidencePercent = useMemo(() => {
    const allPayouts = accounts.flatMap(a => a.payoutHistory ?? [])
    if (allPayouts.length < 2) return 0
    // Score based on count relative to accounts with payouts
    const accsWithPayouts = accounts.filter(a => (a.payoutHistory ?? []).length > 0).length
    const payoutsPerAcc   = allPayouts.length / Math.max(accsWithPayouts, 1)
    return Math.min(100, payoutsPerAcc * 25)
  }, [accounts])

  // ── Behavior stability ───────────────────────────────────────────────────────
  const behaviorStability = useMemo(() =>
    calcBehaviorStabilityScore(active, EMPTY_TRADE_MAP), [active])

  // ── Portfolio insights ───────────────────────────────────────────────────────
  const portfolioInsights = useMemo(() =>
    calcPortfolioInsights(accounts, EMPTY_TRADE_MAP), [accounts])

  // ── Broker exposure ──────────────────────────────────────────────────────────
  const totalCapital = useMemo(() =>
    active.reduce((s, a) => s + a.startingBalance, 0), [active])

  const brokerGroups = useMemo(() => {
    const map = new Map<string, { display: string; count: number; capital: number }>()
    for (const a of active) {
      const key     = (a.broker || 'unknown').toLowerCase().trim()
      const display = a.broker || 'Unknown'
      const prev    = map.get(key)
      map.set(key, prev
        ? { ...prev, count: prev.count + 1, capital: prev.capital + a.startingBalance }
        : { display, count: 1, capital: a.startingBalance }
      )
    }
    return [...map.values()].filter(g => g.count > 1)
  }, [active])

  // ── Mood tint ────────────────────────────────────────────────────────────────
  const moodGradient = useMemo(() => {
    if (accounts.length === 0) return 'transparent'
    if (houseMoney || net > 0) return 'radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.03) 0%, transparent 70%)'
    const ddPct = active.reduce((sum, a) => {
      if (!a.startingBalance) return sum
      return sum + Math.max(0, (a.startingBalance - a.currentBalance) / a.startingBalance)
    }, 0) / Math.max(active.length, 1)
    if (ddPct > 0.05) return 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.03) 0%, transparent 70%)'
    return 'transparent'
  }, [accounts, houseMoney, net, active])

  return (
    <div style={{ maxWidth: 860, backgroundImage: moodGradient, borderRadius: 16, transition: 'background-image var(--dur-slow)' }}>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 28, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-sub)', border: '1px solid var(--border)', flexShrink: 0,
          }}>
            <Wallet size={16} style={{ color: 'var(--fg-muted)' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.04em' }}>
              Accounts
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
              {accounts.length === 0
                ? 'Every account is a different trading environment.'
                : `${active.length} active · ${accounts.length} total`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {accounts.length > 0 && (
            <>
              <button
                onClick={() => setCompareMode(c => !c)}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: compareMode ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${compareMode ? 'rgba(255,255,255,0.18)' : 'var(--border)'}`,
                  color: compareMode ? 'var(--fg)' : 'var(--fg-muted)',
                  fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                  transition: `all var(--dur-fast)`,
                }}
              >
                Compare
              </button>
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            </>
          )}
          <AddAccountButton onClick={() => { setEditing(null); setShowModal(true) }} />
        </div>
      </div>

      {/* ── Portfolio card ────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: `1px solid ${houseMoney ? 'var(--green-bd)' : 'var(--border)'}`,
          borderRadius: 14, overflow: 'hidden', marginBottom: 28,
        }}>

          {/* Financial stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: 'Total Invested', value: totalInvested > 0 ? `$${totalInvested.toLocaleString()}` : '—', color: 'var(--amber)' },
              { label: 'Total Payouts',  value: totalPayouts  > 0 ? `$${totalPayouts.toLocaleString()}`  : '—', color: 'var(--green)' },
              {
                label: 'Net P&L',
                value: totalInvested > 0 ? `${net >= 0 ? '+' : ''}$${net.toLocaleString()}` : '—',
                color: net >= 0 ? 'var(--green)' : 'var(--red)',
              },
              { label: 'Accounts', value: String(accounts.length), color: 'var(--fg-muted)' },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '16px 18px',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              }}>
                <p style={{
                  margin: 0, fontSize: '0.5625rem', color: 'var(--fg-xdim)',
                  textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 5,
                }}>
                  {s.label}
                </p>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: s.color, letterSpacing: '-0.04em' }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Behavior stability strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            borderTop: '1px solid var(--border)',
          }}>
            <BehaviorStrip
              label="Behavior Stability"
              value={behaviorStability.score > 0 ? `${behaviorStability.score}` : '—'}
              sub={behaviorStability.label}
              color={
                behaviorStability.score >= 80 ? 'var(--green)'
                : behaviorStability.score >= 55 ? 'var(--amber)'
                : 'var(--red)'
              }
              isLast={false}
            />
            <BehaviorStrip
              label="Risk Consistency"
              value={active.length > 0 ? `${active.filter(a => a.riskModel === 'fixed' || a.riskModel === 'percentage').length}/${active.length}` : '—'}
              sub="fixed or % risk"
              color="var(--fg-muted)"
              isLast={false}
            />
            <BehaviorStrip
              label="Avg Health"
              value={active.filter(a => a.healthScore != null).length > 0
                ? `${Math.round(active.filter(a => a.healthScore != null).reduce((s, a) => s + (a.healthScore ?? 0), 0) / active.filter(a => a.healthScore != null).length)}`
                : '—'}
              sub="across active accs"
              color="var(--fg-muted)"
              isLast
            />
          </div>

          {/* Split break-even bar */}
          {totalInvested > 0 && (
            <div style={{ padding: '12px 18px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-xdim)' }}>
                    Break-even
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1, background: houseMoney ? 'var(--green)' : 'var(--amber)', display: 'inline-block' }} />
                      Recovery {bePercent.toFixed(0)}%
                    </span>
                    <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1, background: 'var(--fg-xdim)', display: 'inline-block' }} />
                      Confidence {confidencePercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                    ${totalPayouts.toLocaleString()} of ${totalInvested.toLocaleString()}
                  </span>
                  {houseMoney ? (
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99,
                      background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-bd)',
                    }}>House Money</span>
                  ) : (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)' }}>
                      {bePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              {/* Double-layer bar */}
              <div style={{ height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                {/* Confidence layer (underneath) */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 99,
                  width: `${Math.min(confidencePercent, 100)}%`,
                  background: 'rgba(255,255,255,0.06)',
                  transition: 'width var(--dur-slow) var(--ease-out)',
                }} />
                {/* Recovery layer (on top) */}
                <div style={{
                  height: '100%', borderRadius: 99, width: `${bePercent}%`,
                  background: houseMoney
                    ? 'var(--green)'
                    : bePercent > 75 ? 'var(--amber)'
                    : bePercent > 40 ? 'var(--amber)'
                    : 'var(--red)',
                  opacity: 0.7,
                  transition: 'width var(--dur-slow) var(--ease-out)',
                }} />
              </div>
            </div>
          )}

          {/* Broker exposure chips */}
          {brokerGroups.length > 0 && (
            <div style={{ padding: '10px 18px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-xdim)', flexShrink: 0 }}>
                Exposure
              </span>
              {brokerGroups.map(g => {
                const pct = totalCapital > 0 ? Math.round((g.capital / totalCapital) * 100) : 0
                return (
                  <BrokerChip key={g.display} display={g.display} count={g.count} capital={g.capital} pct={pct} />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Portfolio Observations ────────────────────────────────── */}
      {portfolioInsights.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel text="Portfolio Observations" count={portfolioInsights.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {portfolioInsights.map(insight => (
              <div key={insight.id} style={{
                padding: '13px 16px', borderRadius: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-xdim)', marginTop: 5, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.55, letterSpacing: '-0.01em' }}>
                  {insight.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Compare panel ────────────────────────────────────────── */}
      {compareMode && accounts.length >= 2 && (
        <div style={{ marginBottom: 28 }}>
          <AccountComparison accounts={accounts} />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {accounts.length === 0 && (
        <EmptyState onAdd={() => setShowModal(true)} />
      )}

      {/* ── Active accounts ──────────────────────────────────────── */}
      {active.length > 0 && (
        <>
          <SectionLabel text="Active" count={active.length} />

          {viewMode === 'compact' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14, marginBottom: 32,
            }}>
              {active.map(acc => (
                <AccountGridCard
                  key={acc.id}
                  account={acc}
                  healthScore={acc.healthScore ?? null}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {active.map(acc => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  onEdit={handleEdit}
                  onDelete={id => setDeleteTarget(id)}
                  onUpdated={handleUpdated}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── All Accounts ledger ──────────────────────────────────── */}
      {accounts.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            style={{
              width: '100%', padding: '13px 18px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: historyOpen ? '1px solid var(--border)' : 'none',
              transition: `background var(--dur-fast)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-sub)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)', flex: 1, textAlign: 'left' }}>
              All Accounts
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', marginRight: 6 }}>
              {accounts.length}
            </span>
            {historyOpen
              ? <ChevronUp   size={12} style={{ color: 'var(--fg-dim)' }} />
              : <ChevronDown size={12} style={{ color: 'var(--fg-dim)' }} />
            }
          </button>

          <div style={{
            overflow: 'hidden',
            maxHeight: historyOpen ? accounts.length * 64 + 8 : 0,
            transition: `max-height var(--dur-med) var(--ease-out)`,
          }}>
            {accounts.map((acc, i) => (
              <AccountHistoryRow
                key={acc.id}
                account={acc}
                isLast={i === accounts.length - 1}
                onEdit={() => handleEdit(acc)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showModal && (
        <AccountForm
          account={editing}
          uid={uid}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete account?"
          message="All data for this account will be permanently removed. This cannot be undone."
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          variant="destructive"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ── Behavior strip cell ───────────────────────────────────────────────────────
function BehaviorStrip({ label, value, sub, color, isLast }: {
  label: string; value: string; sub: string; color: string; isLast: boolean
}) {
  return (
    <div style={{
      padding: '11px 18px',
      borderRight: isLast ? 'none' : '1px solid var(--border)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      <p style={{ margin: 0, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-xdim)', marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color, letterSpacing: '-0.04em' }}>
        {value}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '0.5625rem', color: 'var(--fg-xdim)', letterSpacing: '-0.01em' }}>
        {sub}
      </p>
    </div>
  )
}

// ── Broker chip with hover insight ───────────────────────────────────────────
function BrokerChip({ display, count, capital, pct }: {
  display: string; count: number; capital: number; pct: number
}) {
  const [hov, setHov] = useState(false)

  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
        borderRadius: 99, background: 'var(--bg-sub)', border: '1px solid var(--border)',
        cursor: 'default',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>{display}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>×{count}</span>
        <span style={{ width: 1, height: 10, background: 'var(--border)', display: 'inline-block' }} />
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
          ${(capital / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Hover insight tooltip */}
      {hov && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 9, padding: '8px 12px', whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10, pointerEvents: 'none',
          animation: 'wsIn 0.12s ease both',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg)', letterSpacing: '-0.01em', fontWeight: 500 }}>
            {pct}% of capital depends on this firm.
          </p>
          {pct > 50 && (
            <p style={{ margin: '3px 0 0', fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>
              Failure here would reduce portfolio capacity significantly.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: '0.625rem', color: 'var(--fg-xdim)', fontWeight: 600 }}>{count}</span>
    </div>
  )
}

// ── View toggle (Compact / Insight) ──────────────────────────────────────────
function ViewToggle({ mode, onChange }: { mode: 'compact' | 'insight'; onChange: (m: 'compact' | 'insight') => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-sub)', borderRadius: 8, border: '1px solid var(--border)', padding: 2, gap: 2 }}>
      {(['compact', 'insight'] as const).map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '5px 10px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 500,
          background: mode === m ? 'var(--bg-card)' : 'transparent',
          border: `1px solid ${mode === m ? 'var(--border)' : 'transparent'}`,
          color: mode === m ? 'var(--fg)' : 'var(--fg-muted)',
          cursor: 'pointer', fontFamily: 'inherit', transition: `all var(--dur-fast)`,
          letterSpacing: '-0.01em', textTransform: 'capitalize',
        }}>
          {m}
        </button>
      ))}
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────
function AccountHistoryRow({ account, isLast, onEdit }: { account: Account; isLast: boolean; onEdit: () => void }) {
  const [hov, setHov] = useState(false)

  const status   = (account.status ?? 'Active') as AccountStatus
  const sBadge   = STATUS_BADGE[status] ?? STATUS_BADGE.Active
  const tBadge   = TYPE_BADGE[account.type]
  const invested = calcTotalInvested(account)
  const payouts  = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const net      = payouts - invested

  const isFailed    = status === 'Failed'
  const isWithdrawn = status === 'Withdrawn'
  const netPositive = net > 0

  const rowOpacity    = isWithdrawn ? 0.55 : isFailed ? 0.78 : 1
  const netColor      = invested === 0 ? 'var(--fg-muted)'
    : isFailed && !netPositive ? 'var(--fg-xdim)'
    : net >= 0 ? 'var(--green)' : 'var(--red)'
  const netDecoration = isFailed && netPositive ? 'line-through' as const : 'none' as const

  const opened  = account.openedAt ?? account.createdAt
  const dateStr = (() => {
    try { return format(parseISO(opened), 'MMM d, yyyy') } catch { return opened.split('T')[0] }
  })()

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 18px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        background: hov ? 'var(--bg-sub)' : 'transparent',
        cursor: 'pointer',
        transition: `background var(--dur-fast), opacity var(--dur-fast)`,
        opacity: rowOpacity,
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: sBadge.color, boxShadow: status === 'Active' ? `0 0 6px ${sBadge.color}80` : 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account.name}
        </p>
        <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
          {account.broker && `${account.broker} · `}{dateStr}{account.phase && ` · ${account.phase}`}
        </p>
      </div>
      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99, flexShrink: 0, background: tBadge.bg, color: tBadge.color, border: `1px solid ${tBadge.border}` }}>
        {account.type}
      </span>
      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99, flexShrink: 0, background: sBadge.bg, color: sBadge.color, border: `1px solid ${sBadge.border}` }}>
        {status}
      </span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.02em', color: netColor, textDecoration: netDecoration, flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
        {invested === 0 ? '—' : `${net >= 0 ? '+' : ''}$${net.toLocaleString()}`}
      </span>
    </div>
  )
}

// ── Add Account button ────────────────────────────────────────────────────────
function AddAccountButton({ onClick }: { onClick: () => void }) {
  const [hov,     setHov]     = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 18px', borderRadius: 9999,
        background: hov ? 'var(--fg)' : 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: hov ? 'var(--bg)' : 'var(--fg)',
        fontSize: '0.8125rem', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: `background var(--dur-fast), color var(--dur-fast), transform var(--dur-fast), box-shadow var(--dur-fast)`,
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        letterSpacing: '-0.02em',
      }}
    >
      <Plus size={14} style={{ transition: `transform var(--dur-med) var(--ease-spring)`, transform: hov ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      New Account
    </button>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  const [hov, setHov] = useState(false)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '72px 24px', borderRadius: 16,
      background: 'var(--bg-card)', border: '1px dashed var(--border)',
      textAlign: 'center', gap: 20,
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-sub)', border: '1px solid var(--border)' }}>
        <Wallet size={22} style={{ color: 'var(--fg-muted)' }} />
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.03em' }}>
          No accounts yet
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', maxWidth: 320, lineHeight: 1.5 }}>
          Every account is a different trading environment. Different environments reveal different behaviors.
        </p>
      </div>
      <button onClick={onAdd} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 9999, background: hov ? 'var(--fg)' : 'var(--bg-sub)', border: '1px solid var(--border)', color: hov ? 'var(--bg)' : 'var(--fg)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: `background var(--dur-fast), color var(--dur-fast)` }}>
        <Plus size={15} />
        Add Account
      </button>
    </div>
  )
}

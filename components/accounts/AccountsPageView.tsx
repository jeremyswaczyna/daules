'use client'

import { useMemo, useState } from 'react'
import { Plus, Wallet, ChevronDown, ChevronUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Account, AccountStatus } from '@/types'
import AccountCard, { calcTotalInvested } from './AccountCard'
import AccountForm from './AccountForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { deleteAccount } from '@/lib/firestore/accounts'

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

export default function AccountsPageView({ accounts, uid, onAccountsChange }: Props) {
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [historyOpen,  setHistoryOpen]  = useState(true)

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

  // ── Portfolio aggregates ────────────────────────────────────────────────────
  const totalInvested = useMemo(() =>
    accounts.reduce((s, a) => s + calcTotalInvested(a), 0), [accounts])

  const totalPayouts = useMemo(() =>
    accounts.reduce((s, a) => s + (a.payoutHistory ?? []).reduce((x, p) => x + p.amount, 0), 0), [accounts])

  const net        = totalPayouts - totalInvested
  const bePercent  = totalInvested > 0 ? Math.min(100, (totalPayouts / totalInvested) * 100) : 0
  const houseMoney = totalInvested > 0 && totalPayouts >= totalInvested

  // ── Broker exposure (only when 2+ active accounts share a broker) ───────────
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

  const beBarColor = houseMoney
    ? 'linear-gradient(90deg, #4ade80, #86efac)'
    : bePercent > 75 ? 'linear-gradient(90deg, #fbbf24, #4ade80)'
    : bePercent > 40 ? '#fbbf24'
    : 'var(--red)'

  return (
    <div style={{ maxWidth: 760 }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-sub)', border: '1px solid var(--border)', flexShrink: 0,
          }}>
            <Wallet size={15} style={{ color: 'var(--fg-muted)' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.1875rem', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.04em' }}>
              Accounts
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
              {accounts.length === 0
                ? 'No accounts yet'
                : `${active.length} active · ${accounts.length} total`}
            </p>
          </div>
        </div>
        <AddAccountButton onClick={() => { setEditing(null); setShowModal(true) }} />
      </div>

      {/* ── Portfolio card ──────────────────────────────────── */}
      {accounts.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: `1px solid ${houseMoney ? 'rgba(74,222,128,0.22)' : 'var(--border)'}`,
          borderRadius: 14, overflow: 'hidden', marginBottom: 20,
          boxShadow: houseMoney ? '0 0 0 1px rgba(74,222,128,0.06)' : 'none',
        }}>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: 'Invested',  value: totalInvested > 0 ? `$${totalInvested.toLocaleString()}` : '—', color: '#fbbf24' },
              { label: 'Payouts',   value: totalPayouts  > 0 ? `$${totalPayouts.toLocaleString()}`  : '—', color: '#4ade80' },
              {
                label: 'Net',
                value: totalInvested > 0 ? `${net >= 0 ? '+' : ''}$${net.toLocaleString()}` : '—',
                color: net >= 0 ? '#4ade80' : 'var(--red)',
              },
              { label: 'Accounts',  value: String(accounts.length), color: 'var(--fg-muted)' },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '14px 16px',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              }}>
                <p style={{
                  margin: 0, fontSize: '0.5625rem', color: 'var(--fg-xdim)',
                  textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 4,
                }}>
                  {s.label}
                </p>
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: s.color, letterSpacing: '-0.03em' }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Break-even bar */}
          {totalInvested > 0 && (
            <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{
                  fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--fg-xdim)',
                }}>
                  Portfolio break-even
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                    ${totalPayouts.toLocaleString()} of ${totalInvested.toLocaleString()} recovered
                  </span>
                  {houseMoney ? (
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                      border: '1px solid rgba(74,222,128,0.25)',
                    }}>
                      House Money
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)' }}>
                      {bePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, width: `${bePercent}%`,
                  background: beBarColor,
                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </div>
          )}

          {/* Broker exposure chips */}
          {brokerGroups.length > 0 && (
            <div style={{
              padding: '10px 18px 14px',
              borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--fg-xdim)', flexShrink: 0,
              }}>
                Exposure
              </span>
              {brokerGroups.map(g => (
                <div key={g.display} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 99,
                  background: 'var(--bg-sub)', border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                    {g.display}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>×{g.count}</span>
                  <span style={{ width: 1, height: 10, background: 'var(--border)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                    ${(g.capital / 1000).toFixed(0)}k
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {accounts.length === 0 && (
        <EmptyState onAdd={() => setShowModal(true)} />
      )}

      {/* ── Active account cards ─────────────────────────────── */}
      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
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

      {/* ── All accounts ledger ──────────────────────────────── */}
      {accounts.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            style={{
              width: '100%', padding: '13px 18px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: historyOpen ? '1px solid var(--border)' : 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-sub)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--fg-dim)', flex: 1, textAlign: 'left',
            }}>
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
            transition: 'max-height 0.30s cubic-bezier(0.4,0,0.2,1)',
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

      {/* ── Modals ──────────────────────────────────────────── */}
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

// ── History row ───────────────────────────────────────────────────────────────
function AccountHistoryRow({
  account, isLast, onEdit,
}: {
  account: Account
  isLast:  boolean
  onEdit:  () => void
}) {
  const [hov, setHov] = useState(false)

  const status      = (account.status ?? 'Active') as AccountStatus
  const sBadge      = STATUS_BADGE[status] ?? STATUS_BADGE.Active
  const tBadge      = TYPE_BADGE[account.type]
  const invested    = calcTotalInvested(account)
  const payouts     = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const net         = payouts - invested

  const isFailed    = status === 'Failed'
  const isWithdrawn = status === 'Withdrawn'
  const netPositive = net > 0

  const rowOpacity    = isWithdrawn ? 0.55 : isFailed ? 0.78 : 1
  const netColor      = invested === 0 ? 'var(--fg-muted)'
    : isFailed && !netPositive ? 'var(--fg-xdim)'
    : net >= 0 ? '#4ade80' : 'var(--red)'
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
        transition: 'background 0.10s, opacity 0.15s',
        opacity: rowOpacity,
      }}
    >
      {/* Status dot */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: sBadge.color,
        boxShadow: status === 'Active' ? `0 0 6px ${sBadge.color}80` : 'none',
      }} />

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '0.8125rem', fontWeight: 500,
          color: 'var(--fg)', letterSpacing: '-0.02em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {account.name}
        </p>
        <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
          {account.broker && `${account.broker} · `}{dateStr}
          {account.phase && ` · ${account.phase}`}
        </p>
      </div>

      {/* Type badge */}
      <span style={{
        fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99, flexShrink: 0,
        background: tBadge.bg, color: tBadge.color, border: `1px solid ${tBadge.border}`,
      }}>
        {account.type}
      </span>

      {/* Status badge */}
      <span style={{
        fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99, flexShrink: 0,
        background: sBadge.bg, color: sBadge.color, border: `1px solid ${sBadge.border}`,
      }}>
        {status}
      </span>

      {/* Net P&L */}
      <span style={{
        fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.02em',
        color: netColor, textDecoration: netDecoration,
        flexShrink: 0, minWidth: 56, textAlign: 'right',
      }}>
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
        transition: 'background 0.18s, color 0.18s, transform 0.12s, box-shadow 0.18s',
        boxShadow: hov ? '0 4px 16px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
        letterSpacing: '-0.02em',
      }}
    >
      <Plus size={14} style={{
        transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hov ? 'rotate(90deg)' : 'rotate(0deg)',
      }} />
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
      padding: '64px 24px', borderRadius: 16,
      background: 'var(--bg-card)', border: '1px dashed var(--border)',
      textAlign: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-sub)', border: '1px solid var(--border)',
      }}>
        <Wallet size={20} style={{ color: 'var(--fg-muted)' }} />
      </div>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
          No accounts yet
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          Add your first trading account to start tracking investments and payouts
        </p>
      </div>
      <button
        onClick={onAdd}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 22px', borderRadius: 9999,
          background: hov ? 'var(--fg)' : 'var(--bg-sub)',
          border: '1px solid var(--border)',
          color: hov ? 'var(--bg)' : 'var(--fg)',
          fontSize: '0.875rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.18s, color 0.18s',
        }}
      >
        <Plus size={15} />
        Add Account
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Edit2, Trash2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import type { Account, AccountStatus } from '@/types'
import InvestmentChart from './InvestmentChart'
import AccountTimeline from './AccountTimeline'
import CertificateUpload from './CertificateUpload'

interface Props {
  account:   Account
  onEdit:    (account: Account) => void
  onDelete:  (id: string) => void
  onUpdated: (account: Account) => void
}

const TYPE_COLORS = {
  funded:     { bg: 'var(--green-bg)',  color: 'var(--green)',    border: 'var(--green-bd)' },
  evaluation: { bg: 'var(--amber-bg)',  color: 'var(--amber)',    border: 'var(--amber-bd)' },
  personal:   { bg: 'var(--bg-sub)',    color: 'var(--fg-muted)', border: 'var(--border)'   },
} as const

const STATUS_COLORS: Record<AccountStatus, { bg: string; color: string; border: string }> = {
  Active:    { bg: 'var(--green-bg)',  color: 'var(--green)',    border: 'var(--green-bd)' },
  Passed:    { bg: 'var(--green-bg)',  color: 'var(--green)',    border: 'var(--green-bd)' },
  Failed:    { bg: 'var(--red-bg)',    color: 'var(--red)',      border: 'var(--red-bd)'   },
  Paused:    { bg: 'var(--amber-bg)',  color: 'var(--amber)',    border: 'var(--amber-bd)' },
  Withdrawn: { bg: 'var(--bg-sub)',    color: 'var(--fg-muted)', border: 'var(--border)'   },
}

export function calcTotalInvested(account: Account): number {
  if (!account.accountCost && !account.monthlyFee) return 0
  const opened = new Date(account.openedAt ?? account.createdAt)
  const now    = new Date()
  const months = Math.max(0,
    (now.getFullYear() - opened.getFullYear()) * 12 +
    (now.getMonth()    - opened.getMonth()) + 1
  )
  return (account.accountCost ?? 0) + (account.monthlyFee ?? 0) * months
}

function ddBarColor(pctOfLimit: number): string {
  if (pctOfLimit >= 80) return 'var(--red)'
  if (pctOfLimit >= 60) return 'var(--amber)'
  return '#4ade80'
}

export default function AccountCard({ account, onEdit, onDelete, onUpdated }: Props) {
  const [chartOpen,     setChartOpen]     = useState(false)
  const [detailsOpen,   setDetailsOpen]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [hov,           setHov]           = useState(false)

  const typeColors    = TYPE_COLORS[account.type]
  const totalPayout   = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const totalInvested = calcTotalInvested(account)
  const net           = totalPayout - totalInvested
  const hasChart      = totalInvested > 0 || totalPayout > 0

  const status      = account.status ?? 'Active'
  const statusColor = STATUS_COLORS[status as AccountStatus] ?? STATUS_COLORS.Active

  const days = Math.floor(
    (Date.now() - new Date(account.openedAt ?? account.createdAt).getTime()) / 86_400_000
  )

  // ── Break-even ──────────────────────────────────────────────────────────────
  const bePercent  = totalInvested > 0 ? Math.min(100, (totalPayout / totalInvested) * 100) : 0
  const houseMoney = totalInvested > 0 && totalPayout >= totalInvested
  const beBarColor = houseMoney
    ? 'linear-gradient(90deg, #4ade80, #86efac)'
    : bePercent > 75
    ? 'linear-gradient(90deg, #fbbf24, #4ade80)'
    : bePercent > 40
    ? '#fbbf24'
    : 'var(--red)'

  // ── Drawdown (eval accounts with updated currentBalance) ────────────────────
  const evalRules = account.evaluation
  const ddDollars = Math.max(0, account.startingBalance - account.currentBalance)
  const ddPct     = account.startingBalance > 0 ? (ddDollars / account.startingBalance) * 100 : 0
  const maxDDPct  = evalRules?.maxTotalDrawdown ?? 0
  const ddOfLimit = maxDDPct > 0 ? Math.min(100, (ddPct / maxDDPct) * 100) : 0
  const showDD    = !!evalRules && maxDDPct > 0 && account.startingBalance > 0
                    && account.currentBalance !== account.startingBalance

  const showRisk = totalInvested > 0 || showDD

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${
          houseMoney ? 'rgba(74,222,128,0.25)' :
          hov        ? 'rgba(255,255,255,0.12)' :
          'var(--border)'
        }`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: houseMoney
          ? '0 0 0 1px rgba(74,222,128,0.07), 0 4px 24px rgba(74,222,128,0.07)'
          : hov ? '0 4px 24px rgba(0,0,0,0.12)' : '0 1px 6px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        padding: '16px 18px 14px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 style={{
              margin: 0, fontSize: '0.9375rem', fontWeight: 600,
              color: 'var(--fg)', letterSpacing: '-0.025em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {account.name}
            </h3>
            <span style={{
              fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99,
              background: typeColors.bg, color: typeColors.color, border: `1px solid ${typeColors.border}`,
              flexShrink: 0,
            }}>
              {account.type}
            </span>
            {status !== 'Active' && (
              <span style={{
                fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99,
                background: statusColor.bg, color: statusColor.color,
                border: `1px solid ${statusColor.border}`, flexShrink: 0,
              }}>
                {status}
              </span>
            )}
            {account.phase && (
              <span style={{
                fontSize: '0.5625rem', fontWeight: 500, color: 'var(--fg-dim)',
                letterSpacing: '0.04em', flexShrink: 0,
              }}>
                {account.phase}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
            {account.broker}{account.broker && ' · '}{account.currency} {account.startingBalance.toLocaleString()}
            {days > 0 ? ` · ${days}d` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <ActionBtn onClick={() => onEdit(account)} title="Edit">
            <Edit2 size={13} />
          </ActionBtn>
          {deleteConfirm ? (
            <button
              onClick={() => { onDelete(account.id); setDeleteConfirm(false) }}
              style={{
                fontSize: '0.6875rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Confirm
            </button>
          ) : (
            <ActionBtn onClick={() => setDeleteConfirm(true)} title="Delete">
              <Trash2 size={13} />
            </ActionBtn>
          )}
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Invested', value: totalInvested > 0 ? `$${totalInvested.toLocaleString()}` : '—', color: '#fbbf24' },
          { label: 'Payouts',  value: totalPayout  > 0 ? `$${totalPayout.toLocaleString()}`  : '—', color: '#4ade80' },
          {
            label: 'Net',
            value: totalInvested > 0 ? `${net >= 0 ? '+' : ''}$${net.toLocaleString()}` : '—',
            color: net >= 0 ? '#4ade80' : 'var(--red)',
          },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: '10px 14px',
            borderRight: i < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <p style={{
              margin: 0, fontSize: '0.5625rem', color: 'var(--fg-xdim)',
              textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 3,
            }}>
              {s.label}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: s.color, letterSpacing: '-0.02em' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Risk section ────────────────────────────────────── */}
      {showRisk && (
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>

          {/* Break-even bar */}
          {totalInvested > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: 'var(--fg-xdim)',
                }}>
                  Break-even
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
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                    {bePercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, width: `${bePercent}%`,
                  background: beBarColor,
                  transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </div>
          )}

          {/* Drawdown bar (eval only, when currentBalance differs) */}
          {showDD && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: 'var(--fg-xdim)',
                }}>
                  Drawdown
                </span>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '-0.01em',
                  color: ddOfLimit >= 80 ? 'var(--red)' : ddOfLimit >= 60 ? 'var(--amber)' : 'var(--fg-muted)',
                }}>
                  {ddPct.toFixed(1)}% / {maxDDPct}% limit
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, width: `${ddOfLimit}%`,
                  background: ddBarColor(ddOfLimit),
                  transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1), background 0.3s',
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Collapsible investment chart ─────────────────────── */}
      {hasChart && (
        <>
          <button
            onClick={() => setChartOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderBottom: chartOpen ? '1px solid var(--border)' : 'none',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fg-dim)', fontSize: '0.625rem', fontFamily: 'inherit',
              letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-sub)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <TrendingUp size={11} />
            <span style={{ flex: 1, textAlign: 'left' }}>Investment</span>
            {chartOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          <div style={{
            overflow: 'hidden',
            maxHeight: chartOpen ? 260 : 0,
            transition: 'max-height 0.30s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <div style={{ padding: '14px 18px 18px' }}>
              <InvestmentChart account={account} />
            </div>
          </div>
        </>
      )}

      {/* ── Expand toggle (Timeline + Certificates) ─────────── */}
      <button
        onClick={() => setDetailsOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          padding: '9px 0', borderTop: '1px solid var(--border)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fg-dim)', fontSize: '0.6875rem', fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-sub)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {detailsOpen ? 'Less' : 'Timeline & Certificates'}
      </button>

      {/* ── Expanded: Timeline + Certificates ───────────────── */}
      <div style={{
        overflow: 'hidden',
        maxHeight: detailsOpen ? 1000 : 0,
        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={{ margin: '0 0 10px', fontSize: '0.625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Timeline
            </p>
            <AccountTimeline account={account} onUpdated={onUpdated} />
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div>
            <p style={{ margin: '0 0 10px', fontSize: '0.625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Certificates
            </p>
            <CertificateUpload account={account} onUpdated={onUpdated} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, title, children }: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid transparent',
        color: 'var(--fg-dim)', cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background  = 'var(--bg-sub)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color       = 'var(--fg)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background  = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.color       = 'var(--fg-dim)'
      }}
    >
      {children}
    </button>
  )
}

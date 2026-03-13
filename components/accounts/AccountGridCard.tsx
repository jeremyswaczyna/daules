'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
import AccountSparkline from './AccountSparkline'
import { calcTotalInvested } from './AccountCard'
import { healthScoreColor } from '@/lib/analytics/accountHealth'
import type { Account, AccountStatus, BehavioralSignal } from '@/types'

interface Props {
  account: Account
  signal?: BehavioralSignal | null
  healthScore?: number | null
}

const STATUS_COLOR: Record<AccountStatus, string> = {
  Active:    '#4ade80',
  Passed:    '#4ade80',
  Failed:    'var(--red)',
  Paused:    '#fbbf24',
  Withdrawn: 'var(--fg-xdim)',
}

const ENV_LABEL: Record<string, string> = {
  live:             'Live',
  demo:             'Demo',
  prop_firm:        'Prop Firm',
  strategy_testing: 'Strategy',
  development:      'Dev',
  institutional:    'Inst.',
}

export default function AccountGridCard({ account, signal, healthScore }: Props) {
  const router  = useRouter()
  const [hov,   setHov]   = useState(false)

  const status      = (account.status ?? 'Active') as AccountStatus
  const statusColor = STATUS_COLOR[status] ?? 'var(--fg-muted)'

  const invested  = calcTotalInvested(account)
  const payouts   = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const net       = payouts - invested
  const isPos     = net >= 0
  const returnPct = invested > 0 ? ((net / invested) * 100) : 0

  // Balance sparkline: use payout history as proxy equity points
  const sparkData: number[] = (() => {
    const base   = account.startingBalance ?? 0
    const events = [...(account.payoutHistory ?? [])].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    if (events.length === 0) return [base, account.currentBalance ?? base]
    let running = base
    const pts: number[] = [base]
    for (const e of events) {
      running += e.amount
      pts.push(running)
    }
    pts.push(account.currentBalance ?? running)
    return pts
  })()

  const envLabel = account.environment ? (ENV_LABEL[account.environment] ?? account.environment) : account.type

  const hsBg     = healthScore != null ? `${healthScoreColor(healthScore)}18` : 'var(--bg-sub)'
  const hsColor  = healthScore != null ? healthScoreColor(healthScore) : 'var(--fg-muted)'

  return (
    <div
      onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.13)' : 'var(--border)'}`,
        borderRadius: 14,
        padding: '18px 20px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hov
          ? '0 8px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {/* ── Top row: name + health + arrow ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {/* Status dot */}
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: statusColor,
              boxShadow: status === 'Active' ? `0 0 6px ${statusColor}80` : 'none',
            }} />
            <span style={{
              fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'var(--fg-xdim)',
            }}>
              {envLabel}
            </span>
          </div>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600,
            color: 'var(--fg)', letterSpacing: '-0.03em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {account.name}
          </h3>
          {account.broker && (
            <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>
              {account.broker}
              {account.marketType && ` · ${account.marketType}`}
            </p>
          )}
        </div>

        {/* Health score ring */}
        {healthScore != null && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: hsBg,
            border: `1.5px solid ${hsColor}40`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: hsColor, letterSpacing: '-0.03em' }}>
              {healthScore}
            </span>
          </div>
        )}

        {/* Arrow */}
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hov ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: `1px solid ${hov ? 'rgba(255,255,255,0.14)' : 'transparent'}`,
          transition: 'all 0.15s',
        }}>
          <ArrowUpRight size={13} style={{ color: hov ? 'var(--fg)' : 'var(--fg-dim)', transition: 'color 0.15s' }} />
        </div>
      </div>

      {/* ── Sparkline ────────────────────────────────────────── */}
      <div style={{ height: 36 }}>
        <AccountSparkline data={sparkData} width={220} height={36} />
      </div>

      {/* ── Metrics row ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Stat label="Net" value={invested > 0 ? `${net >= 0 ? '+' : ''}$${Math.abs(net).toLocaleString()}` : '—'} color={invested > 0 ? (isPos ? '#4ade80' : 'var(--red)') : 'var(--fg-muted)'} />
        <Stat label="Return" value={invested > 0 ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '—'} color={invested > 0 ? (returnPct >= 0 ? '#4ade80' : 'var(--red)') : 'var(--fg-muted)'} />
        <Stat label="Balance" value={account.currentBalance > 0 ? `$${account.currentBalance.toLocaleString()}` : '—'} color="var(--fg)" />
      </div>

      {/* ── Behavioral signal footer ──────────────────────────── */}
      {signal && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: signal.severity === 'ok'
            ? 'rgba(74,222,128,0.06)'
            : signal.severity === 'warning'
            ? 'rgba(251,191,36,0.06)'
            : 'rgba(239,68,68,0.06)',
          border: `1px solid ${
            signal.severity === 'ok'      ? 'rgba(74,222,128,0.14)' :
            signal.severity === 'warning' ? 'rgba(251,191,36,0.14)' :
            'rgba(239,68,68,0.14)'
          }`,
          marginTop: -2,
        }}>
          {signal.severity === 'ok'
            ? <TrendingUp  size={10} style={{ color: '#4ade80', flexShrink: 0 }} />
            : <TrendingDown size={10} style={{ color: signal.severity === 'critical' ? 'var(--red)' : '#fbbf24', flexShrink: 0 }} />
          }
          <span style={{
            fontSize: '0.6875rem', color: 'var(--fg-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {signal.label}: {signal.value}
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.5625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color, letterSpacing: '-0.03em' }}>
        {value}
      </p>
    </div>
  )
}

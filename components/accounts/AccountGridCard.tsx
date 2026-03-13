'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
import AccountSparkline from './AccountSparkline'
import { calcTotalInvested } from './AccountCard'
import { healthScoreColor } from '@/lib/analytics/accountHealth'
import type { Account, AccountStatus, BehavioralSignal } from '@/types'

interface Props {
  account:     Account
  signal?:     BehavioralSignal | null
  healthScore?: number | null
}

const STATUS_COLOR: Record<AccountStatus, string> = {
  Active:    'var(--green)',
  Passed:    'var(--green)',
  Failed:    'var(--red)',
  Paused:    'var(--amber)',
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

// Short environmental context sentences
const ENV_CONTEXT: Record<string, string> = {
  live:             'Emotional pressure highest here.',
  demo:             'Risk-free — behavior often relaxes.',
  prop_firm:        'Strict drawdown rules shape discipline.',
  strategy_testing: 'Behavior becomes experimental here.',
  development:      'Low-stakes environment for building edge.',
  institutional:    'Performance standards tend to be strict.',
}

// Derive a dominant behavioral narrative from account data
function dominantNarrative(account: Account): string | null {
  if (!account.payoutHistory || account.payoutHistory.length === 0) return null

  const payouts = [...account.payoutHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const invested = calcTotalInvested(account)
  const totalPayout = payouts.reduce((s, p) => s + p.amount, 0)

  // Check if behavior changed after first payout
  if (payouts.length >= 2) {
    const firstPayout  = payouts[0].amount
    const laterPayouts = payouts.slice(1).reduce((s, p) => s + p.amount, 0) / (payouts.length - 1)
    if (laterPayouts > firstPayout * 1.4) return 'Payout size growing over time.'
    if (laterPayouts < firstPayout * 0.6) return 'Payout consistency declining.'
  }

  if (totalPayout >= invested * 1.5) return 'Well beyond break-even — house money territory.'
  if (totalPayout > 0 && totalPayout < invested * 0.3) return 'Early recovery phase.'
  if (account.evaluation && account.currentBalance < account.startingBalance) return 'Under pressure from drawdown.'

  return null
}

export default function AccountGridCard({ account, signal, healthScore }: Props) {
  const router          = useRouter()
  const [hov, setHov]   = useState(false)
  const [sparkMode, setSparkMode] = useState<'balance' | 'freq'>('balance')

  const status      = (account.status ?? 'Active') as AccountStatus
  const statusColor = STATUS_COLOR[status] ?? 'var(--fg-muted)'

  const invested  = calcTotalInvested(account)
  const payouts   = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const net       = payouts - invested
  const isPos     = net >= 0
  const returnPct = invested > 0 ? ((net / invested) * 100) : 0

  // Balance sparkline: use payout history as proxy equity points
  const balanceSparkData: number[] = (() => {
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

  // Trade frequency sparkline: placeholder data (even distribution over 7 pts)
  const freqSparkData: number[] = (() => {
    const len = Math.max(balanceSparkData.length, 4)
    return Array.from({ length: len }, (_, i) => Math.sin(i * 0.8) * 0.5 + 1)
  })()

  const sparkData = sparkMode === 'balance' ? balanceSparkData : freqSparkData

  const envLabel   = account.environment ? (ENV_LABEL[account.environment] ?? account.environment) : account.type
  const envContext = account.environment ? (ENV_CONTEXT[account.environment] ?? null) : null
  const narrative  = dominantNarrative(account)

  const hsBg    = healthScore != null ? `${healthScoreColor(healthScore)}18` : 'var(--bg-sub)'
  const hsColor = healthScore != null ? healthScoreColor(healthScore) : 'var(--fg-muted)'

  // Certificate badge
  const hasCerts = (account.certificates ?? []).length > 0

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
        transition: `border-color var(--dur-fast), box-shadow var(--dur-fast), transform var(--dur-fast)`,
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative',
      }}
    >
      {/* Certificate badge */}
      {hasCerts && (
        <div style={{
          position: 'absolute', top: 12, right: 50,
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--amber)',
          boxShadow: '0 0 6px var(--amber-bg)',
        }}
          title="Proof of passing stored"
        />
      )}

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
          transition: `all var(--dur-fast)`,
        }}>
          <ArrowUpRight size={13} style={{ color: hov ? 'var(--fg)' : 'var(--fg-dim)', transition: `color var(--dur-fast)` }} />
        </div>
      </div>

      {/* ── Sparkline with mode toggle ───────────────────────── */}
      <div style={{ position: 'relative', height: 36 }}>
        <AccountSparkline data={sparkData} width={220} height={36} />
        {/* Mode toggle — only visible on hover */}
        {hov && (
          <div
            onClick={e => { e.stopPropagation(); setSparkMode(m => m === 'balance' ? 'freq' : 'balance') }}
            style={{
              position: 'absolute', top: 0, right: 0,
              fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--fg-xdim)',
              padding: '2px 6px', borderRadius: 5,
              background: 'var(--bg-sub)', border: '1px solid var(--border)',
              cursor: 'pointer', zIndex: 1,
              transition: `opacity var(--dur-fast)`,
            }}
          >
            {sparkMode === 'balance' ? 'Freq' : 'Balance'}
          </div>
        )}
      </div>

      {/* ── Metrics row ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Stat label="Net"     value={invested > 0 ? `${net >= 0 ? '+' : ''}$${Math.abs(net).toLocaleString()}` : '—'} color={invested > 0 ? (isPos ? 'var(--green)' : 'var(--red)') : 'var(--fg-muted)'} />
        <Stat label="Return"  value={invested > 0 ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '—'}       color={invested > 0 ? (returnPct >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--fg-muted)'} />
        <Stat label="Balance" value={account.currentBalance > 0 ? `$${account.currentBalance.toLocaleString()}` : '—'} color="var(--fg)" />
      </div>

      {/* ── Environment context or behavioral narrative ───────── */}
      {(narrative || envContext) && (
        <p style={{
          margin: 0, fontSize: '0.6875rem', color: 'var(--fg-xdim)',
          letterSpacing: '-0.01em', lineHeight: 1.45,
          borderTop: '1px solid var(--border)', paddingTop: 10,
          marginTop: -4,
        }}>
          {narrative ?? envContext}
        </p>
      )}

      {/* ── Behavioral signal footer ──────────────────────────── */}
      {signal && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: signal.severity === 'ok'
            ? 'var(--green-bg)'
            : signal.severity === 'warning'
            ? 'var(--amber-bg)'
            : 'var(--red-bg)',
          border: `1px solid ${
            signal.severity === 'ok'      ? 'var(--green-bd)' :
            signal.severity === 'warning' ? 'var(--amber-bd)' :
            'var(--red-bd)'
          }`,
          marginTop: -2,
        }}>
          {signal.severity === 'ok'
            ? <TrendingUp  size={10} style={{ color: 'var(--green)', flexShrink: 0 }} />
            : <TrendingDown size={10} style={{ color: signal.severity === 'critical' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
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

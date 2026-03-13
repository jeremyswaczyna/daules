'use client'

import { useState } from 'react'
import { calcTotalInvested } from './AccountCard'
import type { Account, AccountStatus } from '@/types'

interface Props {
  accounts: Account[]
}

const STATUS_COLOR: Record<AccountStatus, string> = {
  Active:    'var(--green)',
  Passed:    'var(--green)',
  Failed:    'var(--red)',
  Paused:    'var(--amber)',
  Withdrawn: 'var(--fg-xdim)',
}

function generateInsights(left: Account, right: Account): string[] {
  const lm = getMetrics(left)
  const rm = getMetrics(right)
  const insights: string[] = []

  // Recovery speed comparison
  if (lm.invested > 0 && rm.invested > 0) {
    const lBePerDay = left.payoutHistory && left.payoutHistory.length > 0
      ? lm.payouts / Math.max(1, left.payoutHistory.length)
      : 0
    const rBePerDay = right.payoutHistory && right.payoutHistory.length > 0
      ? rm.payouts / Math.max(1, right.payoutHistory.length)
      : 0
    if (lBePerDay > rBePerDay * 1.4 && lBePerDay > 0) {
      insights.push(`${left.name} generates payouts faster on average.`)
    } else if (rBePerDay > lBePerDay * 1.4 && rBePerDay > 0) {
      insights.push(`${right.name} generates payouts faster on average.`)
    }
  }

  // Drawdown discipline
  if (Math.abs(lm.ddPct - rm.ddPct) > 2) {
    const worse = lm.ddPct > rm.ddPct ? left.name : right.name
    const diff  = Math.abs(lm.ddPct - rm.ddPct).toFixed(1)
    insights.push(`${worse} carries ${diff}% more drawdown — something about that environment increases pressure.`)
  }

  // Risk model difference
  if (left.riskModel && right.riskModel && left.riskModel !== right.riskModel) {
    insights.push(`Different risk models: ${left.name} uses ${left.riskModel}, ${right.name} uses ${right.riskModel}. This changes how losses compound.`)
  }

  return insights.slice(0, 3)
}

function getMetrics(account: Account) {
  const invested = calcTotalInvested(account)
  const payouts  = (account.payoutHistory ?? []).reduce((s, p) => s + p.amount, 0)
  const net      = payouts - invested
  const returnPct = invested > 0 ? ((net / invested) * 100) : 0
  const ddPct = account.startingBalance > 0
    ? Math.max(0, ((account.startingBalance - account.currentBalance) / account.startingBalance) * 100)
    : 0
  return { invested, payouts, net, returnPct, ddPct }
}

export default function AccountComparison({ accounts }: Props) {
  const [leftId,  setLeftId]  = useState<string>(accounts[0]?.id ?? '')
  const [rightId, setRightId] = useState<string>(accounts[1]?.id ?? '')

  const left  = accounts.find(a => a.id === leftId)  ?? accounts[0]
  const right = accounts.find(a => a.id === rightId) ?? accounts[1]

  if (!left || !right) return null

  const lm       = getMetrics(left)
  const rm       = getMetrics(right)
  const insights = generateInsights(left, right)

  const rows: { label: string; l: string; r: string; lColor?: string; rColor?: string }[] = [
    {
      label: 'Net P&L',
      l: lm.invested > 0 ? `${lm.net >= 0 ? '+' : ''}$${lm.net.toLocaleString()}` : '—',
      r: rm.invested > 0 ? `${rm.net >= 0 ? '+' : ''}$${rm.net.toLocaleString()}` : '—',
      lColor: lm.net >= 0 ? 'var(--green)' : 'var(--red)',
      rColor: rm.net >= 0 ? 'var(--green)' : 'var(--red)',
    },
    {
      label: 'Return',
      l: lm.invested > 0 ? `${lm.returnPct >= 0 ? '+' : ''}${lm.returnPct.toFixed(1)}%` : '—',
      r: rm.invested > 0 ? `${rm.returnPct >= 0 ? '+' : ''}${rm.returnPct.toFixed(1)}%` : '—',
      lColor: lm.returnPct >= 0 ? 'var(--green)' : 'var(--red)',
      rColor: rm.returnPct >= 0 ? 'var(--green)' : 'var(--red)',
    },
    {
      label: 'Invested',
      l: lm.invested > 0 ? `$${lm.invested.toLocaleString()}` : '—',
      r: rm.invested > 0 ? `$${rm.invested.toLocaleString()}` : '—',
    },
    {
      label: 'Payouts',
      l: lm.payouts > 0 ? `$${lm.payouts.toLocaleString()}` : '—',
      r: rm.payouts > 0 ? `$${rm.payouts.toLocaleString()}` : '—',
      lColor: 'var(--green)',
      rColor: 'var(--green)',
    },
    {
      label: 'Balance',
      l: left.currentBalance > 0  ? `$${left.currentBalance.toLocaleString()}`  : '—',
      r: right.currentBalance > 0 ? `$${right.currentBalance.toLocaleString()}` : '—',
    },
    {
      label: 'Drawdown',
      l: `${lm.ddPct.toFixed(1)}%`,
      r: `${rm.ddPct.toFixed(1)}%`,
      lColor: lm.ddPct > 8 ? 'var(--red)' : lm.ddPct > 4 ? 'var(--amber)' : 'var(--fg-muted)',
      rColor: rm.ddPct > 8 ? 'var(--red)' : rm.ddPct > 4 ? 'var(--amber)' : 'var(--fg-muted)',
    },
    {
      label: 'Market',
      l: left.marketType  ?? '—',
      r: right.marketType ?? '—',
    },
    {
      label: 'Style',
      l: left.tradingStyle  ?? '—',
      r: right.tradingStyle ?? '—',
    },
    {
      label: 'Risk Model',
      l: left.riskModel  ?? '—',
      r: right.riskModel ?? '—',
    },
  ]

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px', gap: 12, alignItems: 'center',
      }}>
        <AccountSelector accounts={accounts} value={leftId} onChange={setLeftId} exclude={rightId} />
        <span style={{ fontSize: '0.625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>vs</span>
        <AccountSelector accounts={accounts} value={rightId} onChange={setRightId} exclude={leftId} align="right" />
      </div>

      {/* Account headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', padding: '12px 20px 10px', borderBottom: '1px solid var(--border)' }}>
        <AccountHeader account={left} />
        <div />
        <AccountHeader account={right} align="right" />
      </div>

      {/* Comparison rows */}
      {rows.map((row, i) => (
        <div key={row.label} style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 1fr',
          padding: '9px 20px',
          borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: row.lColor ?? 'var(--fg)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
            {row.l}
          </span>
          <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, textAlign: 'center', alignSelf: 'center' }}>
            {row.label}
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: row.rColor ?? 'var(--fg)', letterSpacing: '-0.02em', textAlign: 'right', textTransform: 'capitalize' }}>
            {row.r}
          </span>
        </div>
      ))}

      {/* Insight sentences */}
      {insights.length > 0 && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-xdim)' }}>
            Insights
          </p>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--fg-xdim)', marginTop: 6, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5, letterSpacing: '-0.01em' }}>{ins}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountHeader({ account, align = 'left' }: { account: Account; align?: 'left' | 'right' }) {
  const status = (account.status ?? 'Active') as AccountStatus
  const color  = STATUS_COLOR[status] ?? 'var(--fg-muted)'

  return (
    <div style={{ textAlign: align }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
          {status}
        </span>
      </div>
      <p style={{ margin: '2px 0 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {account.name}
      </p>
      <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>
        {account.broker ?? '—'}
      </p>
    </div>
  )
}

function AccountSelector({ accounts, value, onChange, exclude, align = 'left' }: {
  accounts: Account[]
  value: string
  onChange: (id: string) => void
  exclude: string
  align?: 'left' | 'right'
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--bg-sub)', border: '1px solid var(--border)',
        color: 'var(--fg)', borderRadius: 8, padding: '6px 10px',
        fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer',
        outline: 'none', colorScheme: 'dark',
        textAlign: align,
      }}
    >
      {accounts
        .filter(a => a.id !== exclude)
        .map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
    </select>
  )
}

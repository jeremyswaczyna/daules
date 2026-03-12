'use client'

import type { Account, Trade } from '@/types'
import { calcNetPnL, calcDrawdown } from '@/lib/calculations'

interface Props {
  account: Account
  trades:  Trade[]
}

// animated progress bar
function HealthBar({ pct, color, warn }: { pct: number; color: string; warn?: boolean }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${clamped}%`,
        background: color,
        borderRadius: 4,
        boxShadow: warn ? `0 0 8px ${color}88` : 'none',
        transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  )
}

function MetricRow({
  label, current, max, pct, color, warn, fmt,
}: {
  label: string; current: number; max: number; pct: number; color: string; warn?: boolean
  fmt: (n: number) => string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>{label}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: warn ? color : 'var(--fg)', letterSpacing: '-0.025em' }}>
            {fmt(current)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-dim)' }}>
            / {fmt(max)}
          </span>
        </div>
      </div>
      <HealthBar pct={pct} color={color} warn={warn} />
    </div>
  )
}

export default function AccountHealthWidget({ account, trades }: Props) {
  if (!account.evaluation) return null   // only renders for funded/evaluation accounts

  const ev = account.evaluation
  const netPnL     = calcNetPnL(trades)
  const drawdown   = calcDrawdown(trades)
  const balance    = account.startingBalance + netPnL

  // Daily drawdown: worst single day P&L (most negative)
  const dailyMap = new Map<string, number>()
  for (const t of trades) {
    const day = t.date.slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + t.pnl)
  }
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayPnL = dailyMap.get(todayKey) ?? 0
  const dailyDDUsed = Math.max(0, -todayPnL)

  // Profit target progress
  const profitGain = netPnL
  const targetPct  = Math.min(100, (profitGain / ev.profitTarget) * 100)

  // Daily DD pct used
  const dailyDDPct = Math.min(100, (dailyDDUsed / ev.maxDailyDrawdown) * 100)

  // Total DD pct used
  const totalDDPct = Math.min(100, (drawdown / ev.maxTotalDrawdown) * 100)

  // Status color helpers
  const ddColor = (pct: number) => pct >= 85 ? '#f87171' : pct >= 60 ? '#fbbf24' : '#6ee7a0'
  const currency = account.currency === 'EUR' ? '€' : account.currency === 'GBP' ? '£' : '$'
  const fmt = (n: number) => `${currency}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  const overallStatus = totalDDPct >= 85 || dailyDDPct >= 85
    ? { label: 'At Risk', color: '#f87171' }
    : totalDDPct >= 60 || dailyDDPct >= 60
    ? { label: 'Caution', color: '#fbbf24' }
    : { label: 'Healthy', color: '#6ee7a0' }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
            Account Health
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
            {account.name} · {account.broker}
          </p>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: 20,
          background: `${overallStatus.color}18`,
          border: `1px solid ${overallStatus.color}40`,
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: overallStatus.color }}>
            {overallStatus.label}
          </span>
        </div>
      </div>

      {/* Balance */}
      <div style={{
        display: 'flex', gap: 16,
        padding: '14px 16px',
        background: 'var(--bg-sub,rgba(0,0,0,0.03))',
        borderRadius: 10,
        border: '1px solid var(--border)',
      }}>
        <BalStat label="Balance"   value={fmt(balance)} />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <BalStat label="Net P&L"   value={fmt(netPnL)}  color={netPnL >= 0 ? 'var(--green)' : 'var(--red)'} />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <BalStat label="Profit Target" value={fmtPct(targetPct)} color={targetPct >= 100 ? '#6ee7a0' : 'var(--fg)'} />
      </div>

      {/* Drawdown metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MetricRow
          label="Profit Target Progress"
          current={profitGain}
          max={ev.profitTarget}
          pct={targetPct}
          color="#6ee7a0"
          fmt={fmt}
        />
        <MetricRow
          label="Daily Drawdown Used"
          current={dailyDDUsed}
          max={ev.maxDailyDrawdown}
          pct={dailyDDPct}
          color={ddColor(dailyDDPct)}
          warn={dailyDDPct >= 70}
          fmt={fmt}
        />
        <MetricRow
          label="Total Drawdown Used"
          current={drawdown}
          max={ev.maxTotalDrawdown}
          pct={totalDDPct}
          color={ddColor(totalDDPct)}
          warn={totalDDPct >= 70}
          fmt={fmt}
        />
      </div>

      {/* Warning */}
      {(totalDDPct >= 85 || dailyDDPct >= 85) && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 8,
        }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#f87171', letterSpacing: '-0.01em' }}>
            {dailyDDPct >= 85
              ? '⚠ Daily drawdown limit nearly breached — stop trading today.'
              : '⚠ Total drawdown limit nearly breached — reduce size immediately.'}
          </p>
        </div>
      )}
    </div>
  )
}

function BalStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '3px 0 0', fontSize: '0.9375rem', fontWeight: 500, letterSpacing: '-0.03em', color: color ?? 'var(--fg)' }}>
        {value}
      </p>
    </div>
  )
}

'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { format, addMonths, startOfMonth, isBefore, parseISO } from 'date-fns'
import type { Account } from '@/types'

interface Props {
  account: Account
}

interface DataPoint {
  label: string
  invested: number
  payouts:  number
}

/**
 * Build monthly data for a single account.
 * invested = accountCost (at creation) + monthlyFee × months elapsed
 * payouts  = cumulative payoutHistory up to that month
 */
function buildData(account: Account): DataPoint[] {
  if (!account.accountCost && !account.monthlyFee && !account.payoutHistory?.length) return []

  const opened = parseISO(account.openedAt ?? account.createdAt)
  const now    = new Date()
  const points: DataPoint[] = []
  let cursor   = startOfMonth(opened)

  while (isBefore(cursor, now) || cursor.getMonth() === now.getMonth()) {
    // Cumulative invested: challenge fee once at start, then +monthlyFee each month
    const monthsElapsed = Math.max(0,
      (cursor.getFullYear() - opened.getFullYear()) * 12 +
      (cursor.getMonth()    - opened.getMonth())
    )
    const invested =
      (account.accountCost ?? 0) +
      (account.monthlyFee  ?? 0) * (monthsElapsed + 1)

    // Cumulative payouts up to end of this month
    const payouts = (account.payoutHistory ?? []).reduce((sum, p) => {
      const pd = parseISO(p.date)
      return isBefore(pd, addMonths(cursor, 1)) ? sum + p.amount : sum
    }, 0)

    points.push({ label: format(cursor, 'MMM yy'), invested, payouts })
    cursor = addMonths(cursor, 1)
  }

  return points
}

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
}

export default function InvestmentChart({ account }: Props) {
  const data = buildData(account)

  if (!data.length) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>No investment data yet</p>
      </div>
    )
  }

  // Find first month payouts exceed invested (break-even)
  const breakevenIdx = data.findIndex(d => d.payouts > 0 && d.payouts >= d.invested)

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        {[
          { color: '#fbbf24', label: 'Total Invested' },
          { color: '#4ade80', label: 'Total Payouts'  },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--fg-muted)', letterSpacing: '0.03em' }}>
              {l.label}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gi-${account.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id={`gp-${account.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            strokeOpacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'var(--fg-dim)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--fg-dim)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [
              typeof v === 'number' ? `$${v.toFixed(2)}` : String(v),
              name === 'invested' ? 'Invested' : 'Payouts',
            ]}
          />

          {breakevenIdx >= 0 && (
            <ReferenceLine
              x={data[breakevenIdx].label}
              stroke="#4ade80"
              strokeDasharray="4 3"
              strokeOpacity={0.55}
              label={{ value: 'Break-even', fill: '#4ade80', fontSize: 9, position: 'insideTopRight' }}
            />
          )}

          <Area
            type="monotone"
            dataKey="invested"
            stroke="#fbbf24"
            strokeWidth={1.5}
            fill={`url(#gi-${account.id})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: '#fbbf24' }}
          />
          <Area
            type="monotone"
            dataKey="payouts"
            stroke="#4ade80"
            strokeWidth={1.5}
            fill={`url(#gp-${account.id})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: '#4ade80' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

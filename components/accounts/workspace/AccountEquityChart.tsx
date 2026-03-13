'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Account, Trade } from '@/types'

type ChartMode = 'equity' | 'balance' | 'r'

interface Props {
  account: Account
  trades:  Trade[]
}

interface DataPoint {
  date:    string
  label:   string
  equity:  number
  balance: number
  r:       number
}

function buildChartData(account: Account, trades: Trade[]): DataPoint[] {
  const sorted = [...trades].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const openDate = account.openedAt ?? account.createdAt
  const start    = account.startingBalance ?? 0

  const pts: DataPoint[] = [{
    date:    openDate,
    label:   format(parseISO(openDate), 'MMM d'),
    equity:  start,
    balance: start,
    r:       0,
  }]

  let runningBalance = start
  let runningR       = 0

  for (const t of sorted) {
    runningBalance += t.pnl ?? 0
    runningR       += t.rMultiple ?? 0
    try {
      pts.push({
        date:    t.date,
        label:   format(parseISO(t.date.split('T')[0]), 'MMM d'),
        equity:  runningBalance,
        balance: runningBalance,
        r:       Math.round(runningR * 100) / 100,
      })
    } catch { /* skip bad dates */ }
  }

  return pts
}

const MODE_LABELS: Record<ChartMode, string> = {
  equity:  'Equity',
  balance: 'Balance',
  r:       'Cumulative R',
}

const CustomTooltip = ({ active, payload, mode }: {
  active?: boolean
  payload?: { payload: DataPoint }[]
  mode:     ChartMode
}) => {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  const val = mode === 'r' ? `${d.r >= 0 ? '+' : ''}${d.r}R` : `$${(mode === 'equity' ? d.equity : d.balance).toLocaleString()}`
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <p style={{ margin: '0 0 2px', fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>{d.label}</p>
      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.03em' }}>{val}</p>
    </div>
  )
}

export default function AccountEquityChart({ account, trades }: Props) {
  const [mode, setMode] = useState<ChartMode>('equity')
  const data  = useMemo(() => buildChartData(account, trades), [account, trades])
  const start = account.startingBalance ?? 0

  const values  = data.map(d => mode === 'r' ? d.r : mode === 'equity' ? d.equity : d.balance)
  const minVal  = Math.min(...values)
  const maxVal  = Math.max(...values)
  const isUp    = values[values.length - 1] >= values[0]
  const lineColor = isUp ? '#4ade80' : '#ef4444'

  const gradId = `eq-grad-${account.id.slice(-4)}`

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
          Performance
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['equity', 'balance', 'r'] as ChartMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '4px 10px', borderRadius: 6,
              background: mode === m ? 'rgba(255,255,255,0.10)' : 'transparent',
              border: `1px solid ${mode === m ? 'rgba(255,255,255,0.18)' : 'transparent'}`,
              color: mode === m ? 'var(--fg)' : 'var(--fg-muted)',
              fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.12s',
            }}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '8px 0 4px', height: 220 }}>
        {data.length < 2 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
              Add trades to see your equity curve.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={lineColor} stopOpacity={0.20} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--fg-xdim)', fontFamily: 'inherit' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minVal * 0.998, maxVal * 1.002]}
                tick={{ fontSize: 10, fill: 'var(--fg-xdim)', fontFamily: 'inherit' }}
                axisLine={false} tickLine={false} width={48}
                tickFormatter={v => mode === 'r' ? `${v}R` : `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip mode={mode} />} />
              {mode !== 'r' && start > 0 && (
                <ReferenceLine
                  y={start}
                  stroke="rgba(255,255,255,0.10)"
                  strokeDasharray="4 4"
                />
              )}
              {mode === 'r' && (
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)" strokeDasharray="4 4" />
              )}
              <Area
                type="monotone"
                dataKey={mode === 'r' ? 'r' : mode}
                stroke={lineColor}
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

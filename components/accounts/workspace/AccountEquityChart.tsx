'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Account, Trade } from '@/types'

type ChartMode = 'equity' | 'balance' | 'r'

interface Props {
  account: Account
  trades:  Trade[]
}

interface DataPoint {
  date:       string
  label:      string
  equity:     number
  balance:    number
  r:          number
  tradeCount: number   // number of trades on this date
}

interface DrawdownRegion {
  start: string   // label
  end:   string   // label
  depth: number   // %
  days:  number
}

function buildChartData(account: Account, trades: Trade[]): DataPoint[] {
  const sorted = [...trades].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const openDate = account.openedAt ?? account.createdAt
  const start    = account.startingBalance ?? 0

  const pts: DataPoint[] = [{
    date:       openDate,
    label:      format(parseISO(openDate), 'MMM d'),
    equity:     start,
    balance:    start,
    r:          0,
    tradeCount: 0,
  }]

  let runningBalance = start
  let runningR       = 0

  for (const t of sorted) {
    runningBalance += t.pnl ?? 0
    runningR       += t.rMultiple ?? 0
    try {
      const dayLabel = format(parseISO(t.date.split('T')[0]), 'MMM d')
      // Merge same-day trades into one point
      const last = pts[pts.length - 1]
      if (last && last.label === dayLabel) {
        pts[pts.length - 1] = {
          ...last,
          equity:     runningBalance,
          balance:    runningBalance,
          r:          Math.round(runningR * 100) / 100,
          tradeCount: last.tradeCount + 1,
        }
      } else {
        pts.push({
          date:       t.date,
          label:      dayLabel,
          equity:     runningBalance,
          balance:    runningBalance,
          r:          Math.round(runningR * 100) / 100,
          tradeCount: 1,
        })
      }
    } catch { /* skip bad dates */ }
  }

  return pts
}

function findDrawdownRegions(data: DataPoint[], mode: ChartMode): DrawdownRegion[] {
  if (data.length < 3) return []
  const values  = data.map(d => mode === 'r' ? d.r : d.equity)
  const regions: DrawdownRegion[] = []
  let peak      = values[0]
  let peakIdx   = 0
  let inDD      = false
  let ddStart   = 0

  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      if (inDD) {
        const depth = peak > 0 ? ((peak - Math.min(...values.slice(ddStart, i))) / peak * 100) : 0
        if (depth > 0.5) {
          regions.push({
            start: data[ddStart].label,
            end:   data[i].label,
            depth: Math.round(depth * 10) / 10,
            days:  i - ddStart,
          })
        }
      }
      peak    = values[i]
      peakIdx = i
      inDD    = false
      ddStart = 0
    } else if (!inDD && values[i] < peak * 0.998) {
      inDD    = true
      ddStart = peakIdx
    }
  }
  return regions
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
  const d   = payload[0].payload
  const val = mode === 'r'
    ? `${d.r >= 0 ? '+' : ''}${d.r}R`
    : `$${(mode === 'equity' ? d.equity : d.balance).toLocaleString()}`
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ margin: '0 0 2px', fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>{d.label}</p>
      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.03em' }}>{val}</p>
      {d.tradeCount > 0 && (
        <p style={{ margin: '3px 0 0', fontSize: '0.625rem', color: 'var(--fg-xdim)' }}>
          {d.tradeCount} trade{d.tradeCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// Custom dot renderer — dense trade days get a visible dot
const CustomDot = (props: {
  cx?: number; cy?: number; payload?: DataPoint; lineColor?: string
}) => {
  const { cx, cy, payload, lineColor } = props
  if (cx == null || cy == null || !payload) return null
  if (payload.tradeCount < 2) return null
  const r = Math.min(3 + payload.tradeCount * 0.5, 5)
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={lineColor ?? 'var(--green)'}
      opacity={0.5}
      stroke="none"
    />
  )
}

export default function AccountEquityChart({ account, trades }: Props) {
  const [mode,           setMode]           = useState<ChartMode>('equity')
  const [hoveredDDIndex, setHoveredDDIndex] = useState<number | null>(null)

  const data   = useMemo(() => buildChartData(account, trades), [account, trades])
  const start  = account.startingBalance ?? 0
  const ddRegs = useMemo(() => findDrawdownRegions(data, mode), [data, mode])

  const values   = data.map(d => mode === 'r' ? d.r : mode === 'equity' ? d.equity : d.balance)
  const minVal   = Math.min(...values)
  const maxVal   = Math.max(...values)
  const isUp     = values[values.length - 1] >= values[0]
  const lineColor = isUp ? 'var(--green)' : 'var(--red)'

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
            Performance
          </span>
          {hoveredDDIndex !== null && ddRegs[hoveredDDIndex] && (
            <span style={{
              fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99,
              background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-bd)',
              animation: 'wsIn 0.12s ease both',
            }}>
              ↓{ddRegs[hoveredDDIndex].depth}% · {ddRegs[hoveredDDIndex].days}d
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['equity', 'balance', 'r'] as ChartMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '4px 10px', borderRadius: 6,
              background: mode === m ? 'rgba(255,255,255,0.10)' : 'transparent',
              border: `1px solid ${mode === m ? 'rgba(255,255,255,0.18)' : 'transparent'}`,
              color: mode === m ? 'var(--fg)' : 'var(--fg-muted)',
              fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: `all var(--dur-fast)`,
            }}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Drawdown legend pills */}
      {ddRegs.length > 0 && (
        <div style={{ padding: '6px 18px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ddRegs.map((dd, i) => (
            <button
              key={i}
              onMouseEnter={() => setHoveredDDIndex(i)}
              onMouseLeave={() => setHoveredDDIndex(null)}
              style={{
                fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.05em',
                textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99,
                background: hoveredDDIndex === i ? 'var(--red-bg)' : 'var(--bg-sub)',
                color: hoveredDDIndex === i ? 'var(--red)' : 'var(--fg-xdim)',
                border: `1px solid ${hoveredDDIndex === i ? 'var(--red-bd)' : 'var(--border)'}`,
                cursor: 'default', fontFamily: 'inherit',
                transition: `all var(--dur-fast)`,
              }}
            >
              DD{i + 1} ↓{dd.depth}%
            </button>
          ))}
        </div>
      )}

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

              {/* Drawdown reference areas */}
              {ddRegs.map((dd, i) => (
                <ReferenceArea
                  key={i}
                  x1={dd.start}
                  x2={dd.end}
                  fill={hoveredDDIndex === i ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.04)'}
                  strokeOpacity={0}
                  ifOverflow="visible"
                />
              ))}

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
                dot={<CustomDot lineColor={lineColor} />}
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

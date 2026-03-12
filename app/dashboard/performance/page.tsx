'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useAccount } from '@/lib/account-context'
import { getTrades } from '@/lib/firestore/trades'
import {
  calcWinRate,
  calcAvgR,
  calcNetPnL,
  calcAvgWin,
  calcAvgLoss,
  calcProfitFactor,
  calcDrawdown,
  calcEquityCurve,
  calcPnLBySetup,
  calcPnLByDayOfWeek,
  calcSetupSessionMatrix,
  calcStreakStats,
  SESSION_LABELS,
  type SessionKey,
} from '@/lib/calculations'
import type { Trade } from '@/types'
import { subDays, isAfter } from 'date-fns'
import { format } from 'date-fns'
import StatCard from '@/components/ui/StatCard'

type Period = '7D' | '30D' | '90D' | 'All'

export default function PerformancePage() {
  const { selectedAccount, user } = useAccount()
  const [trades, setTrades]       = useState<Trade[]>([])
  const [loading, setLoading]     = useState(true)
  const [period, setPeriod]       = useState<Period>('30D')

  useEffect(() => {
    if (!user || !selectedAccount) {
      setLoading(false)
      return
    }
    setLoading(true)
    getTrades(user.uid, selectedAccount.id)
      .then(setTrades)
      .catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [user, selectedAccount])

  const filteredTrades = useMemo(() => {
    if (period === 'All') return trades
    const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
    const cutoff = subDays(new Date(), days)
    return trades.filter((t) => isAfter(new Date(t.date), cutoff))
  }, [trades, period])

  const winRate = calcWinRate(filteredTrades)
  const avgR = calcAvgR(filteredTrades)
  const netPnL = calcNetPnL(filteredTrades)
  const avgWin = calcAvgWin(filteredTrades)
  const avgLoss = calcAvgLoss(filteredTrades)
  const profitFactor = calcProfitFactor(filteredTrades)
  const maxDrawdown = calcDrawdown(filteredTrades)
  const equityCurve = calcEquityCurve(filteredTrades, selectedAccount?.startingBalance ?? 0)
  const pnlBySetup = calcPnLBySetup(filteredTrades)
  const pnlByDay = calcPnLByDayOfWeek(filteredTrades)
  const streakStats = calcStreakStats(filteredTrades)
  const setupSessionMatrix = calcSetupSessionMatrix(filteredTrades)

  const winLossData = [
    { name: 'Wins', value: filteredTrades.filter((t) => t.pnl > 0).length },
    { name: 'Losses', value: filteredTrades.filter((t) => t.pnl < 0).length },
  ]

  // Use actual hex values for recharts (CSS vars don't work in SVG fill/stroke)
  const GREEN_HEX = '#16a34a'
  const RED_HEX = '#dc2626'
  const PIE_COLORS = [GREEN_HEX, RED_HEX]

  const chartTooltipStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--fg)',
    fontSize: '12px',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
          Performance
        </h1>
        <div className="flex gap-1">
          {(['7D', '30D', '90D', 'All'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: period === p ? 'rgba(251,191,36,0.1)' : 'transparent',
                border: `1px solid ${period === p ? 'rgba(251,191,36,0.35)' : 'var(--border)'}`,
                color: period === p ? '#fbbf24' : 'var(--fg-muted)',
                boxShadow: period === p ? '0 2px 8px rgba(251,191,36,0.15)' : 'none',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Analytics ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Net P&L"
              value={`${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)}`}
              accent={netPnL > 0 ? 'green' : netPnL < 0 ? 'red' : 'default'}
            />
            <StatCard
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              accent={winRate >= 50 ? 'green' : winRate === 0 ? 'default' : 'red'}
            />
            <StatCard
              label="Avg Win"
              value={`$${avgWin.toFixed(2)}`}
              accent="green"
            />
            <StatCard
              label="Avg Loss"
              value={`$${avgLoss.toFixed(2)}`}
              accent="red"
            />
            <StatCard
              label="Profit Factor"
              value={profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
              accent={profitFactor >= 1 ? 'green' : profitFactor === 0 ? 'default' : 'red'}
            />
            <StatCard
              label="Avg R"
              value={`${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`}
              accent={avgR > 0 ? 'green' : avgR < 0 ? 'red' : 'default'}
            />
            <StatCard
              label="Max Drawdown"
              value={`$${maxDrawdown.toFixed(2)}`}
              accent="default"
            />
            <StatCard
              label="Total Trades"
              value={filteredTrades.length.toString()}
              accent="default"
            />
          </div>

          {/* Equity Curve */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg)' }}>
              Equity Curve
            </p>
            {equityCurve.length === 0 ? (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  No data for this period
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GREEN_HEX} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={GREEN_HEX} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => {
                      try { return format(new Date(v), 'MMM d') }
                      catch { return v }
                    }}
                    tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => typeof v === 'number' ? [`$${v.toFixed(2)}`, 'Equity'] : [v, 'Equity']} />
                  <Area type="monotone" dataKey="value" stroke={GREEN_HEX} strokeWidth={2} fill="url(#perfGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Charts row */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* P&L by Setup */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg)' }}>
                P&amp;L by Setup
              </p>
              {pnlBySetup.length === 0 ? (
                <div className="h-44 flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pnlBySetup}>
                    <XAxis dataKey="setup" tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => typeof v === 'number' ? [`$${v.toFixed(2)}`, 'P&L'] : [v, 'P&L']} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {pnlBySetup.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.pnl >= 0 ? GREEN_HEX : RED_HEX}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* P&L by Day of Week */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg)' }}>
                P&amp;L by Day of Week
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pnlByDay}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => typeof v === 'number' ? [`$${v.toFixed(2)}`, 'P&L'] : [v, 'P&L']} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {pnlByDay.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.pnl >= 0 ? GREEN_HEX : RED_HEX}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Win/Loss Pie */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg)' }}>
                Win / Loss Distribution
              </p>
              {filteredTrades.length === 0 ? (
                <div className="h-44 flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {winLossData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(v, name) => [v, name]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ color: 'var(--fg-muted)', fontSize: '12px' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Streak Intelligence ────────────────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg)' }}>
              Streak Intelligence
            </p>
            {filteredTrades.length < 3 ? (
              <div className="h-24 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Not enough data</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {/* Current streak */}
                <div
                  className="rounded-lg p-3 flex flex-col gap-1"
                  style={{
                    background: streakStats.currentStreak > 0
                      ? 'rgba(22,163,74,0.07)'
                      : streakStats.currentStreak < 0
                      ? 'rgba(220,38,38,0.07)'
                      : 'var(--bg-sub,rgba(0,0,0,0.03))',
                    border: `1px solid ${streakStats.currentStreak > 0 ? 'rgba(22,163,74,0.2)' : streakStats.currentStreak < 0 ? 'rgba(220,38,38,0.2)' : 'var(--border)'}`,
                  }}
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>Current Streak</span>
                  <span style={{
                    fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.04em',
                    color: streakStats.currentStreak > 0 ? 'var(--green)' : streakStats.currentStreak < 0 ? 'var(--red)' : 'var(--fg-muted)',
                  }}>
                    {streakStats.currentStreak > 0 ? `+${streakStats.currentStreak}` : streakStats.currentStreak}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>
                    {streakStats.currentStreak > 0 ? 'win streak' : streakStats.currentStreak < 0 ? 'loss streak' : 'no streak'}
                  </span>
                </div>

                {/* Best / worst */}
                <div className="rounded-lg p-3 flex flex-col gap-1" style={{ background: 'var(--bg-sub,rgba(0,0,0,0.03))', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>Best Streak</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--green)' }}>{streakStats.longestWin}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>consecutive wins</span>
                </div>

                <div className="rounded-lg p-3 flex flex-col gap-1" style={{ background: 'var(--bg-sub,rgba(0,0,0,0.03))', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>Worst Streak</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--red)' }}>{streakStats.longestLoss}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>consecutive losses</span>
                </div>

                {/* Recovery */}
                <div className="rounded-lg p-3 flex flex-col gap-1" style={{ background: 'var(--bg-sub,rgba(0,0,0,0.03))', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>After-Loss WR</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.04em', color: streakStats.winRateAfterLoss >= 50 ? 'var(--green)' : 'var(--red)' }}>
                    {streakStats.winRateAfterLoss.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>bounce-back rate</span>
                </div>
              </div>
            )}

            {/* Avg streak row */}
            {filteredTrades.length >= 3 && (
              <div className="flex gap-6 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                    Avg win run: <strong style={{ color: 'var(--fg)' }}>{streakStats.avgWinStreak.toFixed(1)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                    Avg loss run: <strong style={{ color: 'var(--fg)' }}>{streakStats.avgLossStreak.toFixed(1)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                    Win-after-win: <strong style={{ color: 'var(--fg)' }}>{streakStats.winRateAfterWin.toFixed(0)}%</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Setup × Session Matrix ─────────────────────────────────── */}
          {setupSessionMatrix.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                  Setup × Session Matrix
                </p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>Win rate by setup & session</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 12px 6px 0', textAlign: 'left', fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)', whiteSpace: 'nowrap' }}>
                        Setup
                      </th>
                      {(['london', 'ny', 'asia', 'other'] as SessionKey[]).map(sess => (
                        <th key={sess} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
                          {SESSION_LABELS[sess]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {setupSessionMatrix.map((row, ri) => (
                      <tr key={row.setup} style={{ borderTop: ri === 0 ? '1px solid var(--border)' : '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px 10px 0', fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {row.setup}
                        </td>
                        {(['london', 'ny', 'asia', 'other'] as SessionKey[]).map(sess => {
                          const cell = row.sessions[sess]
                          const hasData = cell.count > 0
                          const wr = cell.winRate
                          const intensity = hasData ? Math.max(0.06, Math.min(0.22, wr / 100 * 0.22)) : 0
                          const isGood = wr >= 55
                          const isBad  = wr < 40 && hasData
                          return (
                            <td key={sess} style={{ padding: '10px 8px', textAlign: 'center' }}>
                              {hasData ? (
                                <div
                                  style={{
                                    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                                    padding: '5px 10px', borderRadius: 8,
                                    background: isGood
                                      ? `rgba(22,163,74,${intensity})`
                                      : isBad
                                      ? `rgba(220,38,38,${intensity})`
                                      : 'var(--bg-sub,rgba(0,0,0,0.03))',
                                    border: `1px solid ${isGood ? 'rgba(22,163,74,0.18)' : isBad ? 'rgba(220,38,38,0.18)' : 'var(--border)'}`,
                                    minWidth: 52,
                                  }}
                                >
                                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.02em', color: isGood ? 'var(--green)' : isBad ? 'var(--red)' : 'var(--fg)' }}>
                                    {wr.toFixed(0)}%
                                  </span>
                                  <span style={{ fontSize: '0.5rem', color: 'var(--fg-dim)', letterSpacing: '0.04em' }}>
                                    {cell.count}t
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--fg-xdim,var(--fg-dim))', opacity: 0.35 }}>—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

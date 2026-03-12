'use client'

import { useEffect, useRef } from 'react'
import type { Trade } from '@/types'
import { calcMomentumScore, calcWinRate, calcProfitFactor } from '@/lib/calculations'

interface Props { trades: Trade[] }

// Score band → label + color
function scoreBand(score: number): { label: string; color: string; sub: string } {
  if (score >= 78) return { label: 'Peak condition',    color: '#6ee7a0', sub: 'Trade your plan with full size.' }
  if (score >= 58) return { label: 'Solid momentum',   color: '#fbbf24', sub: 'Trade normally — stay patient.' }
  if (score >= 40) return { label: 'Exercise caution', color: '#fb923c', sub: 'Consider reducing position size.' }
  return              { label: 'Sit this out',         color: '#f87171', sub: 'Protect capital — skip or minimum size.' }
}

export default function MomentumScoreWidget({ trades }: Props) {
  const ringRef = useRef<SVGCircleElement>(null)
  const score   = calcMomentumScore(trades)
  const { label, color, sub } = scoreBand(score)
  const hasData = trades.length >= 3

  // Supporting stats
  const recent10 = [...trades]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
  const recentWR = calcWinRate(recent10)
  const recentPF = calcProfitFactor(recent10)

  // Animated ring fill on mount
  useEffect(() => {
    const el = ringRef.current
    if (!el) return
    const circ       = 2 * Math.PI * 44   // r=44
    const target     = circ * (1 - score / 100)
    el.style.transition = 'none'
    el.style.strokeDashoffset = `${circ}`
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)'
        el.style.strokeDashoffset = `${target}`
      })
    })
  }, [score])

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
      <div>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
          Momentum Score
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
          Daily trading readiness
        </p>
      </div>

      {/* Ring + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        {/* SVG ring */}
        <div style={{ position: 'relative', flexShrink: 0, width: 108, height: 108 }}>
          <svg width="108" height="108" viewBox="0 0 108 108">
            {/* track */}
            <circle
              cx="54" cy="54" r="44"
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
            />
            {/* fill ring */}
            <circle
              ref={ringRef}
              cx="54" cy="54" r="44"
              fill="none"
              stroke={hasData ? color : 'var(--border)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44}`}
              transform="rotate(-90 54 54)"
              style={{
                filter: hasData ? `drop-shadow(0 0 6px ${color}88)` : 'none',
              }}
            />
          </svg>

          {/* center text */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.04em',
              color: hasData ? color : 'var(--fg-dim)',
              lineHeight: 1,
              textShadow: hasData ? `0 0 20px ${color}66` : 'none',
            }}>
              {hasData ? score : '--'}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
              /100
            </span>
          </div>
        </div>

        {/* Status + sub-stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: '0.9375rem', fontWeight: 500,
            letterSpacing: '-0.025em',
            color: hasData ? color : 'var(--fg-dim)',
          }}>
            {hasData ? label : 'Log 3+ trades'}
          </p>
          <p style={{
            margin: '0 0 14px',
            fontSize: '0.8rem', color: 'var(--fg-muted)',
            letterSpacing: '-0.01em', lineHeight: 1.4,
          }}>
            {hasData ? sub : 'to unlock your momentum score'}
          </p>

          {/* Mini stats */}
          {hasData && (
            <div style={{ display: 'flex', gap: 18 }}>
              <Stat label="Last 10 WR" value={`${recentWR.toFixed(0)}%`} />
              <Stat label="Profit Factor" value={isFinite(recentPF) ? recentPF.toFixed(2) : '∞'} />
            </div>
          )}
        </div>
      </div>

      {/* Score breakdown bar */}
      {hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Score breakdown
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden' }}>
            {/* Segmented bar: 4 bands */}
            {[
              { pct: 0.40, label: 'Win rate' },
              { pct: 0.20, label: 'Discipline' },
              { pct: 0.20, label: 'Profit factor' },
              { pct: 0.20, label: 'Base' },
            ].map((seg, i) => (
              <div
                key={i}
                title={seg.label}
                style={{
                  flex: seg.pct,
                  background: `rgba(${color.replace('#', '').match(/../g)!.map(h => parseInt(h, 16)).join(',')},${0.3 + i * 0.08})`,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--fg-xdim)' }}>
              {score < 40 ? 'Recover before sizing up' : score < 60 ? 'Reduce size 30–50%' : score < 78 ? 'Trade normally' : 'Optimal — trust the process'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '0.9375rem', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
        {value}
      </p>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Plus, TrendingUp, List } from 'lucide-react'
import type { Trade } from '@/types'
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, format, isSameMonth,
  isSameDay, isToday, addMonths, subMonths,
} from 'date-fns'

// ─── helpers ──────────────────────────────────────────────────────────────────
function buildCalDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month),     { weekStartsOn: 1 }),
  })
}
function getDayTrades(trades: Trade[], day: Date) {
  return trades.filter(t => { try { return isSameDay(new Date(t.date), day) } catch { return false } })
}
function getDayPnL(trades: Trade[], day: Date) {
  return getDayTrades(trades, day).reduce((s, t) => s + t.pnl, 0)
}

// ─── Popup ────────────────────────────────────────────────────────────────────
const PW = 216   // popup width

interface Anchor { day: Date; x: number; y: number; above: boolean }

function DayPopup({
  anchor, trades, onLogTrade, onClose,
}: {
  anchor: Anchor
  trades: Trade[]
  onLogTrade?: (date: Date) => void
  onClose: () => void
}) {
  const dayT  = getDayTrades(trades, anchor.day)
  const pnl   = dayT.reduce((s, t) => s + t.pnl, 0)
  const has   = dayT.length > 0
  const ref   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Clamp left edge inside viewport
  const vpW  = typeof window !== 'undefined' ? window.innerWidth  : 1200
  const left = Math.max(8, Math.min(vpW - PW - 8, anchor.x))

  return createPortal(
    <>
      {/* invisible backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />

      {/* card */}
      <div
        ref={ref}
        style={{
          position: 'fixed',
          left,
          ...(anchor.above ? { bottom: `calc(100vh - ${anchor.y}px)` } : { top: anchor.y }),
          width: PW,
          zIndex: 1000,
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.10), 0 24px 48px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
          transformOrigin: anchor.above ? 'bottom left' : 'top left',
          animation: 'dpIn 0.16s cubic-bezier(0.34,1.5,0.64,1) both',
        }}
      >
        <style>{`
          @keyframes dpIn {
            from { opacity:0; transform:scale(0.86) translateY(${anchor.above ? '5px' : '-5px'}); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
          .dp-row { transition: background 0.1s; }
          .dp-row:hover { background: var(--nav-hover-bg) !important; }
          .dp-row:active { transform: scale(0.98); }
        `}</style>

        {/* ── date header ─────────────────────────────────────────────── */}
        <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
              {format(anchor.day, 'EEE d')}
            </p>
            <p style={{ margin: 0, fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.01em' }}>
              {format(anchor.day, 'MMMM yyyy')}
            </p>
          </div>
          {has && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 600, letterSpacing: '-0.025em',
              color: pnl >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pnl >= 0 ? '+' : ''}${Math.abs(pnl) >= 1000 ? `${(pnl/1000).toFixed(1)}k` : Math.abs(pnl).toFixed(0)}
            </span>
          )}
        </div>

        {/* ── trade rows (if any) ─────────────────────────────────────── */}
        {has && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '4px 0' }}>
            {dayT.slice(0, 4).map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center',
                padding: '5px 12px', gap: 8,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: t.direction === 'long' ? 'var(--green)' : 'var(--red)',
                }} />
                <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                  {t.symbol}
                </span>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 500, letterSpacing: '-0.02em',
                  color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}
                </span>
                <span style={{ fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '-0.01em', minWidth: 26, textAlign: 'right' }}>
                  {t.rMultiple >= 0 ? '+' : ''}{t.rMultiple.toFixed(1)}R
                </span>
              </div>
            ))}
            {dayT.length > 4 && (
              <p style={{ margin: '2px 0 4px', padding: '0 12px', fontSize: '0.625rem', color: 'var(--fg-dim)' }}>
                +{dayT.length - 4} more
              </p>
            )}
          </div>
        )}

        {/* ── actions ─────────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '4px' }}>
          <PopupAction
            icon={<Plus size={12} />}
            label="Log trade"
            accent
            onClick={() => { onClose(); onLogTrade?.(anchor.day) }}
          />
          {has && (
            <PopupAction
              icon={<List size={12} />}
              label="All trades"
              onClick={onClose}
            />
          )}
          {has && (
            <PopupAction
              icon={<TrendingUp size={12} />}
              label="Performance"
              onClick={onClose}
            />
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

function PopupAction({
  icon, label, accent, onClick,
}: {
  icon: React.ReactNode
  label: string
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      className="dp-row"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 8px', borderRadius: 7,
        background: 'transparent', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: accent ? 'var(--green-bg)' : 'var(--bg-sub,rgba(0,0,0,0.04))',
        border: `1px solid ${accent ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`,
        color: accent ? 'var(--green)' : 'var(--fg-muted)',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: '0.8125rem', fontWeight: 400,
        color: 'var(--fg)', letterSpacing: '-0.015em',
      }}>
        {label}
      </span>
    </button>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────
interface Props {
  trades: Trade[]
  onLogTrade?: (date?: Date) => void
}

export default function CalendarWidget({ trades, onLogTrade }: Props) {
  const [month,  setMonth]  = useState(new Date())
  const [popup,  setPopup]  = useState<Anchor | null>(null)
  const calDays = buildCalDays(month)

  const handleDayClick = (e: React.MouseEvent<HTMLButtonElement>, day: Date) => {
    if (popup && isSameDay(popup.day, day)) { setPopup(null); return }
    const rect  = e.currentTarget.getBoundingClientRect()
    const below = rect.bottom + 8
    const above = below + 260 > window.innerHeight
    setPopup({
      day,
      x:     rect.left,           // align popup's left to cell's left
      y:     above ? rect.top - 4 : below,
      above,
    })
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'visible',
      position: 'relative',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0', overflow: 'hidden',
      }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
          {format(month, 'MMMM yyyy')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <CalBtn onClick={() => setMonth(m => subMonths(m, 1))}><ChevronLeft size={13} /></CalBtn>
          <CalBtn onClick={() => setMonth(new Date())} label="Today" />
          <CalBtn onClick={() => setMonth(m => addMonths(m, 1))}><ChevronRight size={13} /></CalBtn>
        </div>
      </div>

      {/* day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{
            padding: '7px 0', textAlign: 'center',
            fontSize: '0.5625rem', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-dim)',
          }}>{d}</div>
        ))}
      </div>

      {/* month summary bar */}
      {(() => {
        const mt = trades.filter(t => { try { return isSameMonth(new Date(t.date), month) } catch { return false } })
        if (mt.length === 0) return null
        const mp = mt.reduce((s, t) => s + t.pnl, 0)
        const wd = new Set(mt.filter(t => t.pnl > 0).map(t => t.date.slice(0, 10))).size
        const ld = new Set(mt.filter(t => t.pnl < 0).map(t => t.date.slice(0, 10))).size
        return (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-sub,rgba(0,0,0,0.02))' }}>
            {[
              { label: 'Net P&L',   value: `${mp >= 0 ? '+' : ''}$${Math.abs(mp) >= 1000 ? `${(mp/1000).toFixed(1)}k` : mp.toFixed(0)}`, color: mp >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Win days',  value: `${wd}`,      color: 'var(--green)' },
              { label: 'Loss days', value: `${ld}`,      color: 'var(--red)'   },
              { label: 'Trades',    value: `${mt.length}`, color: 'var(--fg)' },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, padding: '8px 0', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <p style={{ margin: 0, fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', fontWeight: 500, color: s.color, letterSpacing: '-0.025em' }}>{s.value}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
        {calDays.map((day, i) => {
          const pnl       = getDayPnL(trades, day)
          const count     = getDayTrades(trades, day).length
          const hasTrades = count > 0
          const inMonth   = isSameMonth(day, month)
          const today     = isToday(day)
          const active    = popup ? isSameDay(day, popup.day) : false
          const isLast    = i >= calDays.length - 7
          const allPnls   = calDays.filter(d => isSameMonth(d, month)).map(d => Math.abs(getDayPnL(trades, d)))
          const maxPnl    = Math.max(...allPnls, 1)
          const intensity = hasTrades ? Math.max(0.03, Math.min(0.13, (Math.abs(pnl) / maxPnl) * 0.13)) : 0
          const baseBg    = active
            ? 'var(--nav-active-bg)'
            : pnl > 0 ? `rgba(22,163,74,${intensity})`
            : pnl < 0 ? `rgba(220,38,38,${intensity})`
            : 'transparent'

          return (
            <button
              key={day.toISOString()}
              onClick={e => handleDayClick(e, day)}
              className="btn-press"
              style={{
                position: 'relative',
                padding: '9px 9px 7px', minHeight: 68,
                background: baseBg,
                border: 'none',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: !isLast ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', opacity: inMonth ? 1 : 0.25,
                outline: active ? '2px solid rgba(22,163,74,0.5)' : 'none',
                outlineOffset: -2,
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--nav-hover-bg)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = baseBg }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: today ? 'var(--fg)' : 'transparent',
                fontSize: '0.6875rem', fontWeight: today ? 600 : 400,
                color: today ? 'var(--bg)' : 'var(--fg-muted)',
                letterSpacing: '-0.01em',
              }}>
                {format(day, 'd')}
              </div>
              {hasTrades && (
                <div style={{ marginTop: 5, fontSize: '0.625rem', fontWeight: 500, letterSpacing: '-0.01em', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {pnl >= 0 ? '+' : ''}${Math.abs(pnl) >= 1000 ? `${(pnl/1000).toFixed(1)}k` : pnl.toFixed(0)}
                </div>
              )}
              {hasTrades && (
                <div style={{ position: 'absolute', bottom: 5, right: 6, fontSize: '0.5rem', color: 'var(--fg-dim)' }}>
                  {count}t
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* popup */}
      {popup && (
        <DayPopup
          anchor={popup}
          trades={trades}
          onLogTrade={onLogTrade}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}

// ─── CalBtn ───────────────────────────────────────────────────────────────────
function CalBtn({ onClick, children, label }: { onClick: () => void; children?: React.ReactNode; label?: string }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="btn-press"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: label ? '4px 10px' : '4px 7px',
        borderRadius: 6, border: '1px solid var(--border)',
        background: hov ? 'var(--nav-active-bg)' : 'transparent',
        color: 'var(--fg-muted)', cursor: 'pointer',
        fontSize: '0.75rem', fontFamily: 'inherit',
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}
    >
      {children ?? label}
    </button>
  )
}

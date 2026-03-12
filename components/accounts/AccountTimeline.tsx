'use client'

import { useMemo, useState } from 'react'
import { parseISO, format } from 'date-fns'
import { Award, DollarSign, Calendar, Plus, X, Zap, Star, Circle, Check } from 'lucide-react'
import type { Account, AccountTimelineEvent, TimelineEventType } from '@/types'
import { updateAccount } from '@/lib/firestore/accounts'

// ── Event type catalogue ─────────────────────────────────────────────────────

interface EventMeta {
  type:       TimelineEventType
  chipLabel:  string
  defaultLabel: string
  Icon:       React.FC<{ size: number }>
  color:      string
  bg:         string
  border:     string
  needsAmount:  boolean
  needsLabel:   boolean
}

const EVENT_TYPES: EventMeta[] = [
  {
    type: 'phase1_passed', chipLabel: 'Phase 1 Passed', defaultLabel: 'Phase 1 Passed',
    Icon: Award, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.20)',
    needsAmount: false, needsLabel: false,
  },
  {
    type: 'phase2_passed', chipLabel: 'Phase 2 Passed', defaultLabel: 'Phase 2 Passed',
    Icon: Award, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.20)',
    needsAmount: false, needsLabel: false,
  },
  {
    type: 'funded', chipLabel: 'Funded', defaultLabel: 'Account funded',
    Icon: Zap, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)',
    needsAmount: false, needsLabel: false,
  },
  {
    type: 'payout', chipLabel: 'Payout', defaultLabel: 'Payout received',
    Icon: DollarSign, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.20)',
    needsAmount: true, needsLabel: false,
  },
  {
    type: 'milestone', chipLabel: 'Milestone', defaultLabel: '',
    Icon: Star, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)',
    needsAmount: false, needsLabel: true,
  },
  {
    type: 'custom', chipLabel: 'Custom', defaultLabel: '',
    Icon: Circle, color: 'var(--fg-dim)', bg: 'var(--bg-sub)', border: 'var(--border)',
    needsAmount: false, needsLabel: true,
  },
]

const metaFor = (type: TimelineEventType): EventMeta => {
  if (type === 'opened') return {
    type: 'opened', chipLabel: 'Opened', defaultLabel: 'Account opened',
    Icon: Calendar, color: 'var(--fg-dim)', bg: 'var(--bg-sub)', border: 'var(--border)',
    needsAmount: false, needsLabel: false,
  }
  return EVENT_TYPES.find(e => e.type === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1]
}

// ── Displayed event (merged from sources) ────────────────────────────────────

interface DisplayEvent {
  key:    string
  date:   Date
  type:   TimelineEventType
  label:  string
  amount?: number
  note?:  string
  id?:    string   // present for timelineEvents (deletable)
}

interface Props {
  account:   Account
  onUpdated: (account: Account) => void
}

// ── Status map: which event type updates account status ──────────────────────
const STATUS_FOR_EVENT: Partial<Record<TimelineEventType, Account['status']>> = {
  phase1_passed: 'Passed',
  phase2_passed: 'Passed',
  funded:        'Active',   // funded = still active (promoted)
}

export default function AccountTimeline({ account, onUpdated }: Props) {
  const today = new Date().toISOString().split('T')[0]

  // ── Add-event state machine ──────────────────────────────────────────────
  const [step,      setStep]      = useState<'idle' | 'picking' | 'filling'>('idle')
  const [selMeta,   setSelMeta]   = useState<EventMeta | null>(null)
  const [newDate,   setNewDate]   = useState(today)
  const [newAmount, setNewAmount] = useState('')
  const [newLabel,  setNewLabel]  = useState('')
  const [newNote,   setNewNote]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  // ── Build display events ──────────────────────────────────────────────────
  const events = useMemo<DisplayEvent[]>(() => {
    const list: DisplayEvent[] = []

    // Auto: account opened
    list.push({
      key: '__opened',
      date: parseISO(account.openedAt ?? account.createdAt),
      type: 'opened',
      label: 'Account opened',
    })

    // Manual timeline events
    for (const ev of account.timelineEvents ?? []) {
      list.push({
        key: ev.id,
        date: parseISO(ev.date),
        type: ev.type,
        label: ev.label,
        amount: ev.amount,
        note: ev.note,
        id: ev.id,
      })
    }

    // Legacy payout history (if not already tracked in timelineEvents)
    const tlPayoutDates = new Set(
      (account.timelineEvents ?? [])
        .filter(e => e.type === 'payout')
        .map(e => e.date.split('T')[0])
    )
    for (const p of account.payoutHistory ?? []) {
      const d = p.date.split('T')[0]
      if (!tlPayoutDates.has(d)) {
        list.push({
          key: `payout-${p.date}`,
          date: parseISO(p.date),
          type: 'payout',
          label: 'Payout received',
          amount: p.amount,
          note: p.note,
        })
      }
    }

    return list.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [account])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const reset = () => {
    setStep('idle'); setSelMeta(null)
    setNewDate(today); setNewAmount(''); setNewLabel(''); setNewNote('')
  }

  const selectChip = (meta: EventMeta) => {
    setSelMeta(meta)
    setNewLabel(meta.defaultLabel)
    setStep('filling')
  }

  const handleAdd = async () => {
    if (!selMeta) return
    const label = (selMeta.needsLabel ? newLabel.trim() : selMeta.defaultLabel) || selMeta.defaultLabel
    if (selMeta.needsLabel && !newLabel.trim()) return

    setSaving(true)
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const dateISO = new Date(newDate).toISOString()
      const amount  = selMeta.needsAmount && newAmount ? parseFloat(newAmount) : undefined

      const newEvent: AccountTimelineEvent = {
        id, date: dateISO, type: selMeta.type, label,
        ...(amount !== undefined ? { amount } : {}),
        ...(newNote.trim() ? { note: newNote.trim() } : {}),
      }

      const updatedTimeline = [...(account.timelineEvents ?? []), newEvent]

      // Also sync payout to payoutHistory for chart compatibility
      const updatedPayouts = selMeta.type === 'payout' && amount
        ? [...(account.payoutHistory ?? []), { date: dateISO, amount, ...(newNote.trim() ? { note: newNote.trim() } : {}) }]
        : account.payoutHistory

      // Auto-update status for certain event types
      const newStatus = STATUS_FOR_EVENT[selMeta.type]

      const updates: Partial<Omit<Account, 'id'>> = {
        timelineEvents: updatedTimeline,
        ...(updatedPayouts !== account.payoutHistory ? { payoutHistory: updatedPayouts } : {}),
        ...(newStatus ? { status: newStatus } : {}),
      }

      await updateAccount(account.uid, account.id, updates)
      onUpdated({ ...account, ...updates })
      reset()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    setDeleting(eventId)
    try {
      const updatedTimeline = (account.timelineEvents ?? []).filter(e => e.id !== eventId)
      await updateAccount(account.uid, account.id, { timelineEvents: updatedTimeline })
      onUpdated({ ...account, timelineEvents: updatedTimeline })
    } finally {
      setDeleting(null)
    }
  }

  // ── Input base style ──────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--fg)', borderRadius: 8, padding: '7px 11px',
    fontSize: 12, outline: 'none', fontFamily: 'inherit',
    colorScheme: 'dark', transition: 'border-color 0.12s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Event list ────────────────────────────────────────── */}
      {events.map((ev, i) => {
        const meta    = metaFor(ev.type)
        const isLast  = i === events.length - 1 && step === 'idle'
        const isDel   = deleting === ev.id

        return (
          <div
            key={ev.key}
            style={{ display: 'flex', gap: 12, alignItems: 'stretch', position: 'relative' }}
          >
            {/* Left: dot + line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: meta.bg, border: `1px solid ${meta.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: meta.color, transition: 'opacity 0.15s',
                opacity: isDel ? 0.4 : 1,
              }}>
                <meta.Icon size={10} />
              </div>
              {!isLast && (
                <div style={{
                  flex: 1, width: 1, background: 'var(--border)',
                  minHeight: 10, margin: '3px 0',
                }} />
              )}
            </div>

            {/* Right: content */}
            <div style={{
              paddingBottom: isLast ? 2 : 14, minWidth: 0, flex: 1,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                    {ev.label}
                  </span>
                  {ev.amount != null && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#4ade80' }}>
                      +${ev.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--fg-xdim, var(--fg-dim))' }}>
                    {format(ev.date, 'MMM d, yyyy')}
                  </span>
                  {ev.note && (
                    <span style={{ fontSize: '0.625rem', color: 'var(--fg-muted)', fontStyle: 'italic' }}>
                      · {ev.note}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button (only for manual events) */}
              {ev.id && (
                <button
                  onClick={() => handleDelete(ev.id!)}
                  disabled={isDel}
                  style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: '1px solid transparent',
                    color: 'var(--fg-xdim)', cursor: isDel ? 'not-allowed' : 'pointer',
                    transition: 'all 0.12s', opacity: isDel ? 0.4 : 1,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--red-bg)'
                    e.currentTarget.style.borderColor = 'var(--red-bd)'
                    e.currentTarget.style.color = 'var(--red)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.color = 'var(--fg-xdim)'
                  }}
                >
                  <X size={9} />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* ── Time-in-phase label ───────────────────────────────── */}
      {step === 'idle' && (() => {
        const last = events.length > 0 ? events[events.length - 1] : null
        const since = last ? last.date : parseISO(account.openedAt ?? account.createdAt)
        const daysInPhase = Math.floor((Date.now() - since.getTime()) / 86_400_000)
        if (daysInPhase < 1) return null
        return (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 22, flexShrink: 0 }} />
            <p style={{
              margin: '2px 0 6px', fontSize: '0.625rem',
              color: 'var(--fg-xdim)', letterSpacing: '0.04em',
              fontStyle: 'italic',
            }}>
              {daysInPhase}d in current phase
            </p>
          </div>
        )
      })()}

      {/* ── Connector to add area ─────────────────────────────── */}
      {step !== 'idle' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
            <div style={{ flex: 1, width: 1, background: 'var(--border)', minHeight: 10, margin: '0 0 3px' }} />
          </div>
          <div style={{ flex: 1 }} />
        </div>
      )}

      {/* ── Add event area ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Left column — dot placeholder for add button */}
        <div style={{ width: 22, flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: step === 'idle' ? 0 : 2 }}>
          {step === 'idle' ? (
            <button
              onClick={() => setStep('picking')}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent',
                border: '1px dashed var(--border)',
                color: 'var(--fg-dim)', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-sub)'
                e.currentTarget.style.borderColor = 'var(--fg-dim)'
                e.currentTarget.style.borderStyle = 'solid'
                e.currentTarget.style.color = 'var(--fg)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.borderStyle = 'dashed'
                e.currentTarget.style.color = 'var(--fg-dim)'
              }}
            >
              <Plus size={10} />
            </button>
          ) : (
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: selMeta ? selMeta.bg : 'var(--bg-sub)',
              border: `1px solid ${selMeta ? selMeta.border : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: selMeta ? selMeta.color : 'var(--fg-dim)',
              transition: 'all 0.18s',
            }}>
              {selMeta ? <selMeta.Icon size={10} /> : <Plus size={10} />}
            </div>
          )}
        </div>

        {/* Right column — add form */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Step 1: Chip picker */}
          {(step === 'picking' || step === 'filling') && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: step === 'filling' ? 12 : 4,
            }}>
              {EVENT_TYPES.map(meta => {
                const active = selMeta?.type === meta.type
                return (
                  <button
                    key={meta.type}
                    onClick={() => selectChip(meta)}
                    style={{
                      padding: '5px 11px', borderRadius: 99, fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: active ? 600 : 400,
                      border: `1px solid ${active ? meta.border : 'var(--border)'}`,
                      background: active ? meta.bg : 'transparent',
                      color: active ? meta.color : 'var(--fg-muted)',
                      transition: 'all 0.12s',
                      letterSpacing: '-0.01em',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.borderColor = meta.border
                        e.currentTarget.style.color = meta.color
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.color = 'var(--fg-muted)'
                      }
                    }}
                  >
                    {meta.chipLabel}
                  </button>
                )
              })}
              <button
                onClick={reset}
                style={{
                  padding: '5px 8px', borderRadius: 99, fontSize: '0.75rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid transparent',
                  background: 'transparent', color: 'var(--fg-dim)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-dim)' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Step 2: Fill in details */}
          {step === 'filling' && selMeta && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              paddingBottom: 4,
              animation: 'tlSlideIn 0.18s ease both',
            }}>
              <style>{`@keyframes tlSlideIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>

              {/* Date + amount row */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Date</p>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                {selMeta.needsAmount && (
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Amount ($)</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      placeholder="0.00"
                      style={{ ...inp, width: '100%' }}
                    />
                  </div>
                )}
              </div>

              {/* Label (for custom/milestone) */}
              {selMeta.needsLabel && (
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Label</p>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    placeholder={selMeta.type === 'milestone' ? 'e.g. New personal best' : 'Describe this event'}
                    style={{ ...inp, width: '100%' }}
                    autoFocus
                  />
                </div>
              )}

              {/* Note (optional for all) */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </p>
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Any additional context…"
                  style={{ ...inp, width: '100%' }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                <button
                  onClick={handleAdd}
                  disabled={saving || (selMeta.needsLabel && !newLabel.trim())}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 9999, fontSize: '0.75rem',
                    fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                    background: 'var(--fg)', border: 'none', color: 'var(--bg)',
                    fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
                    transition: 'opacity 0.12s', letterSpacing: '-0.01em',
                  }}
                >
                  <Check size={11} />
                  {saving ? 'Saving…' : 'Add'}
                </button>
                <button
                  onClick={reset}
                  disabled={saving}
                  style={{
                    padding: '6px 12px', borderRadius: 9999, fontSize: '0.75rem',
                    cursor: 'pointer', background: 'transparent',
                    border: '1px solid var(--border)', color: 'var(--fg-muted)',
                    fontFamily: 'inherit', transition: 'all 0.12s', letterSpacing: '-0.01em',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Idle add label */}
          {step === 'idle' && (
            <button
              onClick={() => setStep('picking')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.6875rem', color: 'var(--fg-dim)', fontFamily: 'inherit',
                padding: '3px 0', transition: 'color 0.12s', letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-dim)' }}
            >
              Add event
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

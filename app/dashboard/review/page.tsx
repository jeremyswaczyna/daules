'use client'

import React, { useEffect, useState } from 'react'
import { Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useAccount } from '@/lib/account-context'
import { getReviews, addReview } from '@/lib/firestore/reviews'
import type { Review, ReviewPeriod } from '@/types'
import { format, subWeeks, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'

function HeatmapCalendar({ reviewDates }: { reviewDates: Set<string> }) {
  const today = new Date()
  const startDate = subWeeks(startOfWeek(today), 51)
  const endDate = endOfWeek(today)
  const allDays = eachDayOfInterval({ start: startDate, end: endDate })
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const hasReview = reviewDates.has(dateStr)
              const isToday = dateStr === format(today, 'yyyy-MM-dd')
              return (
                <div
                  key={dateStr}
                  title={`${format(day, 'MMM d, yyyy')}${hasReview ? ' — Review logged' : ''}`}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    background: hasReview
                      ? 'var(--fg)'
                      : isToday
                      ? 'var(--bg-sub)'
                      : 'var(--bg-sub)',
                    border: isToday ? '1px solid var(--fg-xdim)' : '1px solid var(--border)',
                    opacity: day > today ? 0.3 : 1,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <button
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setExpanded(!expanded)}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xs px-2 py-0.5 rounded capitalize"
            style={{
              background: 'var(--bg-sub)',
              color: 'var(--fg-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {review.period}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
            {(() => {
              try { return format(new Date(review.date), 'MMMM d, yyyy') }
              catch { return review.date }
            })()}
          </span>
          {review.emotionalState && (
            <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              {review.emotionalState}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} style={{ color: 'var(--fg-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--fg-muted)' }} />}
      </button>
      {expanded && (
        <div
          className="px-5 pb-5 space-y-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="pt-4">
            {review.whatWorked && (
              <div className="mb-3">
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--fg-muted)' }}>
                  What worked
                </p>
                <p className="text-sm" style={{ color: 'var(--fg)' }}>
                  {review.whatWorked}
                </p>
              </div>
            )}
            {review.whatToChange && (
              <div className="mb-3">
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--red)' }}>
                  What to change
                </p>
                <p className="text-sm" style={{ color: 'var(--fg)' }}>
                  {review.whatToChange}
                </p>
              </div>
            )}
            {review.notes && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--fg-muted)' }}>
                  Notes
                </p>
                <p className="text-sm" style={{ color: 'var(--fg)' }}>
                  {review.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ReviewFormData {
  period: ReviewPeriod
  date: string
  whatWorked: string
  whatToChange: string
  emotionalState: string
  notes: string
}

const EMOTIONAL_STATES = [
  'Focused', 'Calm', 'Anxious', 'Overconfident', 'Fearful', 'FOMO', 'Neutral', 'Disciplined',
]

function ReviewModal({
  accountId,
  uid,
  onSave,
  onClose,
}: {
  accountId: string
  uid: string
  onSave: (review: Review) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ReviewFormData>({
    period: 'daily',
    date: new Date().toISOString().split('T')[0],
    whatWorked: '',
    whatToChange: '',
    emotionalState: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof ReviewFormData>(key: K, value: ReviewFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const reviewData: Omit<Review, 'id'> = {
        accountId,
        uid,
        period: form.period,
        date: form.date,
        whatWorked: form.whatWorked,
        whatToChange: form.whatToChange,
        emotionalState: form.emotionalState,
        notes: form.notes,
        createdAt: new Date().toISOString(),
      }
      const saved = await addReview(uid, accountId, reviewData)
      onSave(saved)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-sub)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    transition: 'border-color var(--dur-fast) var(--ease-out)',
  } as React.CSSProperties

  const fieldLabel = {
    display: 'block',
    fontSize: '0.625rem', fontWeight: 500,
    letterSpacing: '0.09em', textTransform: 'uppercase',
    color: 'var(--fg-dim)', marginBottom: 7,
  } as React.CSSProperties

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.48)',
        padding: '20px 16px',
        overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-card"
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.625rem', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--fg-dim)', fontWeight: 500 }}>
              Trading review
            </p>
            <h2 style={{ margin: '5px 0 0', fontSize: '1.125rem', fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--fg)' }}>
              Write Review
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-press"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-sub)', border: '1px solid var(--border)',
              color: 'var(--fg-muted)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Period</label>
              <select value={form.period} onChange={(e) => update('period', e.target.value as ReviewPeriod)} style={inputStyle}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Date</label>
              <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={fieldLabel}>Emotional State</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOTIONAL_STATES.map((state) => (
                <button
                  key={state}
                  onClick={() => update('emotionalState', state === form.emotionalState ? '' : state)}
                  className="btn-press"
                  style={{
                    padding: '5px 11px', borderRadius: 9999,
                    fontSize: '0.75rem', fontWeight: form.emotionalState === state ? 500 : 400,
                    background: form.emotionalState === state ? 'var(--nav-active-bg)' : 'var(--bg-sub)',
                    border: `1px solid ${form.emotionalState === state ? 'var(--border)' : 'var(--border)'}`,
                    color: form.emotionalState === state ? 'var(--nav-active-text)' : 'var(--fg-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast)',
                  }}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={fieldLabel}>What worked?</label>
            <textarea value={form.whatWorked} onChange={(e) => update('whatWorked', e.target.value)}
              placeholder="What setups, decisions, or behaviors went well today?"
              rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }} />
          </div>

          <div>
            <label style={{ ...fieldLabel, color: 'var(--red)' }}>What to change?</label>
            <textarea value={form.whatToChange} onChange={(e) => update('whatToChange', e.target.value)}
              placeholder="What mistakes did you make? What would you do differently?"
              rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }} />
          </div>

          <div>
            <label style={fieldLabel}>Additional Notes</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)}
              placeholder="Any other observations, market conditions, mindset notes…"
              rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 24px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn-press"
            style={{ flex: 1, padding: '10px 0', borderRadius: 9999, background: 'var(--bg-sub)', border: '1px solid var(--border)', color: 'var(--fg-muted)', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.02em', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-press"
            style={{ flex: 1, padding: '10px 0', borderRadius: 9999, background: 'var(--fg)', color: 'var(--bg)', border: 'none', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.02em', opacity: saving ? 0.65 : 1, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save Review'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { selectedAccount, user } = useAccount()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!user || !selectedAccount) {
      setLoading(false)
      return
    }
    getReviews(user.uid, selectedAccount.id)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false))
  }, [user, selectedAccount])

  const reviewDates = new Set(reviews.map((r) => r.date))
  const recentReviews = reviews.slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
          Review
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--fg)', color: 'var(--bg)', borderRadius: 9999, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={16} />
          Write Review
        </button>
      </div>

      {/* Heatmap */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
            Review History
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} logged
          </p>
        </div>
        <HeatmapCalendar reviewDates={reviewDates} />
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--bg-sub)', border: '1px solid var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>No review</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--fg)', opacity: 0.6 }} />
            <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Reviewed</span>
          </div>
        </div>
      </div>

      {/* Review list */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--fg)' }}>
          Recent Reviews
        </p>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl animate-pulse"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        ) : recentReviews.length === 0 ? (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--fg)' }}>No reviews yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
              Regular review is the fastest way to improve
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>

      {showModal && user && selectedAccount && (
        <ReviewModal
          accountId={selectedAccount.id}
          uid={user.uid}
          onSave={(review) => setReviews([review, ...reviews])}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

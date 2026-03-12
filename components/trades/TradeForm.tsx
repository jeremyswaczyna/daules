'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Plus, ChevronDown } from 'lucide-react'
import type { Trade, Account, TradeDirection, TradeSession, TradeEmotion } from '@/types'
import DaulesLogo from '@/components/ui/DaulesLogo'
import ParticleCanvas from '@/components/ParticleCanvas'
import TradeImageUpload from '@/components/trades/TradeImageUpload'
import { getTagSet, saveTagSet, type TagSet } from '@/lib/firestore/tagsets'

const LOADING_MSGS = [
  'Checking your setup…',
  'Calculating R-multiple…',
  'Logging to journal…',
  'Cross-referencing your DNA…',
  'Almost there…',
]

const PRESET_SETUP    = ['Breakout', 'Trend Follow', 'Reversal', 'Range', 'News']
const PRESET_MISTAKES = ['FOMO', 'Revenge', 'Oversize', 'Early Exit', 'Late Entry', 'No Setup']
const PRESET_MARKET   = ['Trending', 'Ranging', 'Volatile', 'News-driven']

const SESSIONS: { value: TradeSession; label: string }[] = [
  { value: 'london', label: 'London' },
  { value: 'ny',     label: 'New York' },
  { value: 'asia',   label: 'Asia' },
  { value: 'other',  label: 'Other' },
]

const EMOTIONS: { value: TradeEmotion; label: string; icon: string; color: string }[] = [
  { value: 'focused',   label: 'Focused',   icon: '◎', color: '#6ee7a0' },
  { value: 'neutral',   label: 'Neutral',   icon: '◌', color: 'var(--fg-muted)' },
  { value: 'anxious',   label: 'Anxious',   icon: '◐', color: '#fbbf24' },
  { value: 'impulsive', label: 'Impulsive', icon: '▲', color: '#fb923c' },
  { value: 'euphoric',  label: 'Euphoric',  icon: '★', color: '#f472b6' },
]

const ACCOUNT_COLORS: Record<string, string> = {
  funded:     '#6ee7a0',
  evaluation: '#fbbf24',
  personal:   'var(--fg-dim)',
}

type Outcome = 'win' | 'loss' | 'scratch'

interface TradeFormProps {
  trade?:           Trade | null
  accounts:         Account[]
  defaultAccountId: string | null
  uid:              string
  initialDate?:     string
  onSave:           (trade: Omit<Trade, 'id'>, accountIds: string[]) => Promise<void>
  onClose:          () => void
}

export default function TradeForm({
  trade, accounts, defaultAccountId, uid, initialDate, onSave, onClose,
}: TradeFormProps) {

  // ── Account selection ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>(
    defaultAccountId ? [defaultAccountId] : []
  )

  // ── Core ───────────────────────────────────────────────────────────────────
  const [date,      setDate]      = useState(trade?.date ?? initialDate ?? new Date().toISOString().split('T')[0])
  const [symbol,    setSymbol]    = useState(trade?.symbol ?? '')
  const [direction, setDirection] = useState<TradeDirection>(trade?.direction ?? 'long')

  // ── Risk / R:R ─────────────────────────────────────────────────────────────
  const [risk, setRisk] = useState(trade?.riskAmount?.toString() ?? '')
  // Single source of truth for R:R ratio
  const [rr,     setRr]     = useState(trade?.rMultiple && trade.rMultiple > 0 ? trade.rMultiple : 2)
  // String buffers so inputs don't jump while typing
  const [rrStr,      setRrStr]      = useState(trade?.rMultiple && trade.rMultiple > 0 ? trade.rMultiple.toFixed(2) : '2.00')
  const [profitStr,  setProfitStr]  = useState('')
  const rrFocused     = useRef(false)
  const profitFocused = useRef(false)

  const riskVal  = parseFloat(risk) || 0
  const profitVal = parseFloat(profitStr) || 0

  // Keep rrStr in sync with rr when slider moves and input isn't focused
  useEffect(() => {
    if (!rrFocused.current) setRrStr(rr.toFixed(2))
  }, [rr])

  // Keep profitStr in sync when rr or risk changes (if profit field not focused)
  useEffect(() => {
    if (!profitFocused.current && riskVal > 0) {
      setProfitStr((riskVal * rr).toFixed(2))
    }
  }, [rr, riskVal])

  const handleRrInputChange = (raw: string) => {
    setRrStr(raw)
    const v = parseFloat(raw)
    if (!isNaN(v) && v > 0) setRr(Math.min(10, v))
  }

  const handleProfitChange = (raw: string) => {
    setProfitStr(raw)
    const v = parseFloat(raw)
    if (!isNaN(v) && v > 0 && riskVal > 0) setRr(Math.min(10, v / riskVal))
  }

  // ── Outcome ────────────────────────────────────────────────────────────────
  const [outcome,      setOutcome]      = useState<Outcome | null>(trade?.outcome ?? null)
  const [positionSize, setPositionSize] = useState(trade?.positionSize ? trade.positionSize.toString() : '')
  const [showLotSize,  setShowLotSize]  = useState(false)

  // Live P&L
  const pnl       = outcome === 'win' ? riskVal * rr : outcome === 'loss' ? -riskVal : 0
  const rMultiple = outcome === 'win' ? rr : outcome === 'loss' ? -1 : 0

  // ── Session + tags ─────────────────────────────────────────────────────────
  const [session,   setSession]   = useState<TradeSession>(trade?.session ?? 'ny')
  const [setup,     setSetup]     = useState<string[]>(trade?.setup ?? [])
  const [mistakes,  setMistakes]  = useState<string[]>(trade?.mistakes ?? [])
  const [marketCtx, setMarketCtx] = useState<string[]>(trade?.marketContext ?? [])
  const [notes,     setNotes]     = useState(trade?.notes ?? '')
  const [mediaUrls, setMediaUrls] = useState<string[]>(trade?.mediaUrls ?? [])

  // ── Tag library ────────────────────────────────────────────────────────────
  const [tagSet,     setTagSet]     = useState<TagSet>({ setup: [], mistakes: [], marketContext: [] })
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [customSetup,   setCustomSetup]   = useState('')
  const [customMistake, setCustomMistake] = useState('')
  const [customMarket,  setCustomMarket]  = useState('')

  // ── Mindset ────────────────────────────────────────────────────────────────
  const [emotionPre,  setEmotionPre]  = useState<TradeEmotion | undefined>(trade?.emotionPre)
  const [emotionPost, setEmotionPost] = useState<TradeEmotion | undefined>(trade?.emotionPost)
  const [confidence,  setConfidence]  = useState<number>(trade?.confidence ?? 0)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [msgIdx,    setMsgIdx]    = useState(0)
  const [error,     setError]     = useState('')
  const [closing,   setClosing]   = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = () => {
    if (closing) return
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      onClose()
    }, 260)
  }

  // Load tag library
  useEffect(() => {
    if (!uid) return
    getTagSet(uid)
      .then(ts => { setTagSet(ts); setTagsLoaded(true) })
      .catch(() => setTagsLoaded(true))
  }, [uid])

  // Loading message cycle
  useEffect(() => {
    if (saving) {
      intervalRef.current = setInterval(() => setMsgIdx(i => i + 1), 900)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setMsgIdx(0)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [saving])

  // ── Tag helpers ────────────────────────────────────────────────────────────
  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag])

  const addCustomTag = async (
    val: string,
    list: string[], setter: (v: string[]) => void,
    tsKey: keyof TagSet, clearFn: () => void,
  ) => {
    const t = val.trim()
    if (!t) return
    setter(list.includes(t) ? list : [...list, t])
    if (!tagSet[tsKey].includes(t)) {
      const next: TagSet = { ...tagSet, [tsKey]: [...tagSet[tsKey], t] }
      setTagSet(next)
      saveTagSet(uid, next).catch(() => {})
    }
    clearFn()
  }

  const activateGhost = async (
    tag: string,
    list: string[], setter: (v: string[]) => void,
    tsKey: keyof TagSet,
  ) => {
    setter(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag])
    if (!tagSet[tsKey].includes(tag)) {
      const next: TagSet = { ...tagSet, [tsKey]: [...tagSet[tsKey], tag] }
      setTagSet(next)
      saveTagSet(uid, next).catch(() => {})
    }
  }

  // ── Account toggle (min 1 selected) ───────────────────────────────────────
  const toggleAccount = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev   // keep at least one
        return prev.filter(x => x !== id)
      }
      return [...prev, id]
    })
  }

  const noAccount    = accounts.length === 0
  const noneSelected = selectedIds.length === 0

  // Compute what's missing for the validation popover
  const missingFields: string[] = []
  if (!symbol.trim())            missingFields.push('Symbol (e.g. EURUSD)')
  if (!risk || riskVal <= 0)     missingFields.push('Risk amount ($)')
  if (!outcome)                  missingFields.push('Outcome (Win / Loss / Scratch)')
  if (noAccount)                 missingFields.push('At least one trading account (add in Accounts)')
  else if (noneSelected)         missingFields.push('Select an account above')

  const canSubmit = !saving && !submitted && missingFields.length === 0

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (missingFields.length > 0) {
      setShowValidation(true)
      setTimeout(() => setShowValidation(false), 4000)
      return
    }
    setError(''); setSaving(true)
    try {
      await onSave({
        accountId: selectedIds[0],
        uid, date,
        symbol: symbol.toUpperCase(), direction,
        entry: 0, exit: 0, stopLoss: 0, takeProfit: 0,
        positionSize: parseFloat(positionSize) || 0,
        pnl, rMultiple,
        riskAmount: riskVal,
        outcome: outcome ?? undefined,
        setup, mistakes, notes,
        mediaUrls,
        duration: 0, session,
        createdAt: trade?.createdAt ?? new Date().toISOString(),
        ...(emotionPre  && { emotionPre }),
        ...(emotionPost && { emotionPost }),
        ...(confidence  && { confidence: confidence as 1|2|3|4|5 }),
        ...(marketCtx.length && { marketContext: marketCtx }),
      }, selectedIds)
      setSaving(false)
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch {
      setError('Failed to save trade. Please try again.')
      setSaving(false)
    }
  }

  // ── Slider fill % ──────────────────────────────────────────────────────────
  const sliderFill = Math.min(100, ((Math.min(rr, 5) - 0.5) / (5 - 0.5)) * 100)

  // ── Render ─────────────────────────────────────────────────────────────────
  const content = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px', overflow: 'hidden',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      {/* Blurred dashboard backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'none',
        animation: closing ? 'tfBdOut 0.26s ease forwards' : 'tfBdIn 0.22s ease both',
      }} />

      {/* Neural network particles */}
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none', opacity: 0.18,
        animation: closing ? 'tfBdOut 0.26s ease forwards' : 'tfBdIn 0.40s ease both',
      }}>
        <ParticleCanvas />
      </div>

      {/* Soft edge vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 30%, rgba(0,0,0,0.28) 100%)',
      }} />

      {/* Modal card */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 520,
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 18,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 40px 100px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        overflow: 'hidden',
        animation: closing
          ? 'tfCardOut 0.26s cubic-bezier(0.4,0,1,1) forwards'
          : 'tfCardIn 0.38s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>

        {/* Top shimmer line */}
        <div style={{
          height: 1, flexShrink: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, transparent)',
        }} />

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.5625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', fontWeight: 600 }}>
                {trade ? 'Edit trade' : 'Log trade'}
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.1875rem', fontWeight: 500, letterSpacing: '-0.05em', color: 'var(--fg)' }}>
                {trade ? trade.symbol : 'New position'}
              </h2>
            </div>
            <button onClick={handleClose} className="btn-press" style={{
              width: 30, height: 30, borderRadius: 7, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-sub)', border: '1px solid var(--border)',
              color: 'var(--fg-dim)', cursor: 'pointer',
            }}>
              <X size={13} />
            </button>
          </div>

          {/* Account pill strip */}
          {noAccount ? (
            <div style={{ paddingBottom: 14 }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-dim)', letterSpacing: '-0.01em' }}>
                No accounts yet —{' '}
                <Link
                  href="/dashboard/accounts"
                  style={{ color: 'var(--fg)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  add one in Accounts
                </Link>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 14, overflowX: 'auto' }}>
              {accounts.map(acc => {
                const active  = selectedIds.includes(acc.id)
                const dotClr  = ACCOUNT_COLORS[acc.type] ?? 'var(--fg-dim)'
                return (
                  <button
                    key={acc.id}
                    onClick={() => toggleAccount(acc.id)}
                    className="btn-press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 9999,
                      background: active ? 'rgba(255,255,255,0.07)' : 'var(--bg-sub)',
                      border: `1px solid ${active ? 'rgba(255,255,255,0.16)' : 'var(--border)'}`,
                      color: active ? 'var(--fg)' : 'var(--fg-muted)',
                      fontSize: '0.75rem', fontWeight: active ? 500 : 400, letterSpacing: '-0.01em',
                      cursor: 'pointer', fontFamily: 'inherit',
                      opacity: !active && selectedIds.length > 0 ? 0.6 : 1,
                      transition: 'all var(--dur-fast) var(--ease-out)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: active ? dotClr : 'var(--fg-xdim)',
                      boxShadow: active ? `0 0 6px ${dotClr}80` : 'none',
                      transition: 'all var(--dur-fast)',
                    }} />
                    {acc.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div
          className="tf-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}
        >

          {/* Date + Symbol */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Date">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Symbol">
              <input
                type="text" value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                placeholder="EURUSD" style={inputStyle}
              />
            </FormField>
          </div>

          {/* Direction */}
          <FormField label="Direction">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['long', 'short'] as TradeDirection[]).map(d => (
                <button key={d} onClick={() => setDirection(d)} className="btn-press" style={{
                  flex: 1, padding: '9px 0', borderRadius: 9,
                  fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: direction === d
                    ? d === 'long' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'
                    : 'var(--bg-sub)',
                  border: `1px solid ${direction === d
                    ? d === 'long' ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.35)'
                    : 'var(--border)'}`,
                  color: direction === d
                    ? d === 'long' ? '#4ade80' : '#f87171'
                    : 'var(--fg-muted)',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}>
                  {d === 'long' ? '↑ Long' : '↓ Short'}
                </button>
              ))}
            </div>
          </FormField>

          <Divider />

          {/* ── Risk section ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={sectionLabel}>Risk</p>

            <FormField label="Risk amount ($)">
              <input
                type="number" value={risk}
                onChange={e => setRisk(e.target.value)}
                placeholder="200" min="0" step="any"
                className="tf-input"
                style={inputStyle}
              />
            </FormField>

            {/* R:R slider + direct input */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
                  Risk-to-reward
                </label>
                {/* Direct R:R number input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={rrStr}
                    onChange={e => handleRrInputChange(e.target.value)}
                    onFocus={() => { rrFocused.current = true }}
                    onBlur={() => { rrFocused.current = false; setRrStr(rr.toFixed(2)) }}
                    min="0.5" max="10" step="0.25"
                    className="tf-input"
                    style={{
                      ...inputStyle,
                      width: 64, padding: '5px 8px',
                      fontSize: '0.8125rem', fontWeight: 600,
                      letterSpacing: '-0.02em', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em', userSelect: 'none' }}>×</span>
                </div>
              </div>

              {/* Slider with gradient fill */}
              <div style={{ position: 'relative' }}>
                <input
                  type="range" min="0.5" max="5" step="0.25"
                  value={Math.min(rr, 5)}
                  onChange={e => { setRr(parseFloat(e.target.value)); }}
                  className="tf-slider"
                  style={{
                    width: '100%',
                    background: `linear-gradient(to right, rgba(110,231,160,0.45) 0%, rgba(110,231,160,0.20) ${sliderFill}%, rgba(255,255,255,0.08) ${sliderFill}%, rgba(255,255,255,0.08) 100%)`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)' }}>0.5×</span>
                <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)' }}>5×</span>
              </div>
            </div>

            {/* Profit input — synced with R:R */}
            <FormField label={`Profit ($)${riskVal > 0 && !profitFocused.current ? ` · = risk × ${rr.toFixed(2)}R` : ''}`}>
              <input
                type="number"
                value={profitStr}
                onChange={e => handleProfitChange(e.target.value)}
                onFocus={() => { profitFocused.current = true }}
                onBlur={() => {
                  profitFocused.current = false
                  if (riskVal > 0) setProfitStr((riskVal * rr).toFixed(2))
                }}
                placeholder={riskVal > 0 ? (riskVal * rr).toFixed(2) : '400'}
                min="0" step="any"
                className="tf-input"
                style={inputStyle}
              />
            </FormField>
          </div>

          {/* ── Outcome ── */}
          <FormField label="Outcome">
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { val: 'win',     label: 'Win',     icon: '↑', bg: 'rgba(22,163,74,0.12)',  bd: 'rgba(22,163,74,0.35)',  clr: '#4ade80' },
                { val: 'loss',    label: 'Loss',    icon: '↓', bg: 'rgba(220,38,38,0.12)', bd: 'rgba(220,38,38,0.35)', clr: '#f87171' },
                { val: 'scratch', label: 'Scratch', icon: '—', bg: 'rgba(255,255,255,0.06)', bd: 'rgba(255,255,255,0.14)', clr: 'var(--fg)' },
              ] as const).map(o => (
                <button
                  key={o.val}
                  onClick={() => setOutcome(outcome === o.val ? null : o.val)}
                  className="btn-press"
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 9,
                    fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em',
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: outcome === o.val ? o.bg : 'var(--bg-sub)',
                    border: `1px solid ${outcome === o.val ? o.bd : 'var(--border)'}`,
                    color: outcome === o.val ? o.clr : 'var(--fg-muted)',
                    transition: 'all var(--dur-fast) var(--ease-out)',
                  }}
                >
                  <span style={{ opacity: 0.7, marginRight: 4 }}>{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </FormField>

          {/* Live P&L preview */}
          {riskVal > 0 && outcome && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              borderRadius: 11, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
              background: pnl > 0
                ? 'linear-gradient(135deg, rgba(22,163,74,0.10), rgba(22,163,74,0.04))'
                : pnl < 0
                ? 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(220,38,38,0.04))'
                : 'var(--bg-sub)',
              animation: 'tfFadeIn 0.18s ease both',
            }}>
              {[
                {
                  label: 'P&L',
                  value: `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`,
                  color: pnl > 0 ? '#4ade80' : pnl < 0 ? '#f87171' : 'var(--fg-muted)',
                },
                {
                  label: 'R-Multiple',
                  value: `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R`,
                  color: rMultiple > 0 ? '#4ade80' : rMultiple < 0 ? '#f87171' : 'var(--fg-muted)',
                },
              ].map((c, ci) => (
                <div key={c.label} style={{
                  padding: '14px 18px',
                  borderLeft: ci > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <p style={{ margin: 0, fontSize: '0.5625rem', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)', fontWeight: 600 }}>
                    {c.label}
                  </p>
                  <p
                    key={c.value}
                    style={{ margin: '5px 0 0', fontSize: '1.5rem', fontWeight: 500, letterSpacing: '-0.04em', color: c.color, fontVariantNumeric: 'tabular-nums', animation: 'tfPulse 0.25s ease' }}
                  >
                    {c.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Optional lot size */}
          <div>
            <button
              onClick={() => setShowLotSize(v => !v)}
              className="btn-press"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--fg-xdim)', fontSize: '0.5625rem', padding: '2px 0',
                letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              <ChevronDown size={9} style={{ transform: showLotSize ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
              {showLotSize ? 'Hide' : 'Add'} lot size
            </button>
            {showLotSize && (
              <div style={{ marginTop: 8, animation: 'tfFadeIn 0.15s ease both' }}>
                <input
                  type="number" value={positionSize}
                  onChange={e => setPositionSize(e.target.value)}
                  placeholder="Lots / units" min="0" step="any"
                  className="tf-input" style={inputStyle}
                />
              </div>
            )}
          </div>

          <Divider />

          {/* Session */}
          <FormField label="Session">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SESSIONS.map(({ value, label }) => (
                <Tag key={value} label={label} active={session === value} onClick={() => setSession(value)} />
              ))}
            </div>
          </FormField>

          {/* Setup */}
          <TagSection
            label="Setup"
            selectedTags={setup}
            customTags={tagSet.setup}
            presetTags={PRESET_SETUP}
            tagsLoaded={tagsLoaded}
            onToggle={tag => toggleTag(tag, setup, setSetup)}
            onActivateGhost={tag => activateGhost(tag, setup, setSetup, 'setup')}
            customInput={customSetup}
            onCustomChange={setCustomSetup}
            onCustomAdd={() => addCustomTag(customSetup, setup, setSetup, 'setup', () => setCustomSetup(''))}
            placeholder="Add setup…"
          />

          {/* Mistakes */}
          <TagSection
            label="Mistakes"
            selectedTags={mistakes}
            customTags={tagSet.mistakes}
            presetTags={PRESET_MISTAKES}
            tagsLoaded={tagsLoaded}
            variant="red"
            onToggle={tag => toggleTag(tag, mistakes, setMistakes)}
            onActivateGhost={tag => activateGhost(tag, mistakes, setMistakes, 'mistakes')}
            customInput={customMistake}
            onCustomChange={setCustomMistake}
            onCustomAdd={() => addCustomTag(customMistake, mistakes, setMistakes, 'mistakes', () => setCustomMistake(''))}
            placeholder="Add mistake…"
          />

          <Divider />

          {/* Mindset */}
          <div>
            <p style={sectionLabel}>Mindset &amp; Context</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <FormField label="Pre-trade emotion">
                <EmotionRow value={emotionPre} onChange={v => setEmotionPre(emotionPre === v ? undefined : v)} />
              </FormField>

              <FormField label="Post-trade emotion">
                <EmotionRow value={emotionPost} onChange={v => setEmotionPost(emotionPost === v ? undefined : v)} />
              </FormField>

              <FormField label={`Confidence${confidence > 0 ? ` · ${confidence}/5` : ''}`}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setConfidence(confidence === n ? 0 : n)} className="btn-press" style={{
                      flex: 1, height: 32, borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: n <= confidence ? 'rgba(255,255,255,0.09)' : 'var(--bg-sub)',
                      color: n <= confidence ? 'var(--fg)' : 'var(--fg-xdim)',
                      fontSize: '0.75rem', cursor: 'pointer',
                      transition: 'all var(--dur-fast)',
                    }}>●</button>
                  ))}
                </div>
              </FormField>

              <TagSection
                label="Market context"
                selectedTags={marketCtx}
                customTags={tagSet.marketContext}
                presetTags={PRESET_MARKET}
                tagsLoaded={tagsLoaded}
                onToggle={tag => toggleTag(tag, marketCtx, setMarketCtx)}
                onActivateGhost={tag => activateGhost(tag, marketCtx, setMarketCtx, 'marketContext')}
                customInput={customMarket}
                onCustomChange={setCustomMarket}
                onCustomAdd={() => addCustomTag(customMarket, marketCtx, setMarketCtx, 'marketContext', () => setCustomMarket(''))}
                placeholder="Add market context…"
              />

            </div>
          </div>

          {/* Notes */}
          <FormField label="Notes">
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Trade context, observations, mindset…"
              rows={3}
              className="tf-input"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
            />
          </FormField>

          {/* Screenshots */}
          <FormField label="Screenshots">
            <TradeImageUpload uid={uid} urls={mediaUrls} onChange={setMediaUrls} />
          </FormField>

          {error && (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#f87171', letterSpacing: '-0.01em', animation: 'tfFadeIn 0.15s ease both' }}>
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 24px 20px',
          borderTop: '1px solid var(--border)',
          position: 'relative',
        }}>
          {/* Validation popover */}
          {showValidation && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 24, right: 24,
              background: 'rgba(18,18,20,0.96)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10, padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              animation: 'tfValidIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both',
              zIndex: 20,
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f87171' }}>
                To log this trade, fill in:
              </p>
              <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                {missingFields.map(f => (
                  <li key={f} style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.72)', letterSpacing: '-0.01em', marginBottom: 2 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={handleClose} className="btn-press" style={{
            flex: 1, padding: '10px 0', borderRadius: 9999,
            background: 'var(--bg-sub)', border: '1px solid var(--border)',
            color: 'var(--fg-muted)', fontSize: '0.875rem', fontWeight: 500,
            letterSpacing: '-0.02em', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || submitted}
            className={submitted ? '' : 'btn-press'}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9999,
              background: submitted ? '#22c55e' : missingFields.length > 0 ? 'rgba(255,255,255,0.05)' : 'var(--fg)',
              color: submitted ? '#fff' : missingFields.length > 0 ? 'var(--fg-dim)' : 'var(--bg)',
              border: missingFields.length > 0 ? '1px solid var(--border)' : 'none',
              fontSize: '0.875rem', fontWeight: 500,
              letterSpacing: '-0.02em',
              cursor: saving || submitted ? 'default' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              overflow: 'hidden',
              transition: 'background 0.4s cubic-bezier(0.22,1,0.36,1), transform 0.25s cubic-bezier(0.34,1.5,0.64,1)',
              transform: submitted ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {submitted ? (
              <>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2.5 8L6 11.5L12.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ strokeDasharray: 22, strokeDashoffset: 0, animation: 'tfCheckDraw 0.42s cubic-bezier(0.22,1,0.36,1) both' }} />
                </svg>
                <span style={{ animation: 'tfFadeUp 0.3s ease both 0.12s', opacity: 0 }}>Trade logged</span>
              </>
            ) : saving ? (
              <>
                <DaulesLogo loading size={15} color="var(--bg)" />
                <span style={{ animation: 'tfFadeIn 0.22s ease both' }}>
                  {LOADING_MSGS[msgIdx % LOADING_MSGS.length]}
                </span>
              </>
            ) : (
              trade ? 'Update trade' : 'Add trade'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tfCheckDraw {
          from { stroke-dashoffset: 22; } to { stroke-dashoffset: 0; }
        }
        @keyframes tfFadeUp {
          from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tfFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes tfCardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.96); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes tfBdIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes tfBdOut {
          from { opacity: 1; } to { opacity: 0; }
        }
        @keyframes tfCardOut {
          from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          to   { opacity: 0; transform: translateY(14px) scale(0.97); filter: blur(3px); }
        }
        @keyframes tfValidIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tfPulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .tf-scroll::-webkit-scrollbar { width: 3px; }
        .tf-scroll::-webkit-scrollbar-track { background: transparent; }
        .tf-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.15); border-radius: 99px; }
        .tf-scroll::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.30); }
        .tf-input:focus {
          outline: none;
          border-color: rgba(255,255,255,0.18) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.04), 0 0 14px rgba(255,255,255,0.03);
        }
        .tf-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          width: 100%;
        }
        .tf-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 17px; height: 17px;
          border-radius: 50%;
          background: var(--fg);
          cursor: pointer;
          box-shadow: 0 0 0 2.5px var(--bg-card), 0 2px 8px rgba(0,0,0,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .tf-slider::-webkit-slider-thumb:hover {
          transform: scale(1.18);
          box-shadow: 0 0 0 2.5px var(--bg-card), 0 3px 12px rgba(0,0,0,0.45);
        }
        .tf-slider::-moz-range-thumb {
          width: 17px; height: 17px;
          border-radius: 50%;
          background: var(--fg);
          cursor: pointer;
          border: 2.5px solid var(--bg-card);
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  )

  return createPortal(content, document.body)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 9,
  color: 'var(--fg)',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  outline: 'none',
  letterSpacing: '-0.01em',
  transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
  colorScheme: 'light dark',
}

const sectionLabel: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: '0.5625rem',
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--fg-dim)',
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '0.5625rem', fontWeight: 600,
        letterSpacing: '0.09em', textTransform: 'uppercase',
        color: 'var(--fg-dim)', marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Tag({ label, active, onClick, variant = 'neutral' }: {
  label: string; active: boolean; onClick: () => void; variant?: 'neutral' | 'red'
}) {
  return (
    <button onClick={onClick} className="btn-press" style={{
      padding: '5px 11px', borderRadius: 9999,
      fontSize: '0.75rem', fontWeight: active ? 500 : 400,
      letterSpacing: '-0.01em', cursor: 'pointer', fontFamily: 'inherit',
      background: active
        ? variant === 'red' ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active
        ? variant === 'red' ? 'rgba(220,38,38,0.35)' : 'rgba(255,255,255,0.16)'
        : 'rgba(255,255,255,0.07)'}`,
      color: active
        ? variant === 'red' ? '#f87171' : 'var(--fg)'
        : 'var(--fg-muted)',
      transition: 'all var(--dur-fast) var(--ease-out)',
    }}>
      {label}
    </button>
  )
}

function GhostTag({ label, active, variant = 'neutral', onClick }: {
  label: string; active: boolean; variant?: 'neutral' | 'red'; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title="Example — click to add to your library"
      style={{
        padding: '5px 11px', borderRadius: 9999,
        fontSize: '0.75rem', letterSpacing: '-0.01em',
        cursor: 'pointer', fontFamily: 'inherit',
        fontStyle: 'italic', fontWeight: 400,
        background: 'transparent',
        border: `1px dashed ${variant === 'red' ? 'rgba(220,38,38,0.18)' : 'rgba(255,255,255,0.10)'}`,
        color: variant === 'red' ? 'rgba(248,113,113,0.35)' : 'var(--fg-xdim)',
        opacity: active ? 1 : 0.5,
        filter: active ? 'none' : 'blur(0.4px)',
        transition: 'all var(--dur-fast) var(--ease-out)',
      }}
    >
      {label}
    </button>
  )
}

function TagSection({
  label, selectedTags, customTags, presetTags, tagsLoaded, variant,
  onToggle, onActivateGhost, customInput, onCustomChange, onCustomAdd, placeholder,
}: {
  label: string
  selectedTags: string[]
  customTags: string[]
  presetTags: string[]
  tagsLoaded: boolean
  variant?: 'neutral' | 'red'
  onToggle: (tag: string) => void
  onActivateGhost: (tag: string) => void
  customInput: string
  onCustomChange: (v: string) => void
  onCustomAdd: () => void
  placeholder: string
}) {
  const hasCustom = customTags.length > 0
  return (
    <div>
      <p style={sectionLabel}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {hasCustom
          ? customTags.map(tag => (
              <Tag key={tag} label={tag} active={selectedTags.includes(tag)} onClick={() => onToggle(tag)} variant={variant} />
            ))
          : tagsLoaded
          ? presetTags.map(tag => (
              <GhostTag
                key={tag} label={tag}
                active={selectedTags.includes(tag)}
                variant={variant}
                onClick={() => onActivateGhost(tag)}
              />
            ))
          : null}
        {selectedTags.filter(t => !customTags.includes(t) && !presetTags.includes(t)).map(tag => (
          <Tag key={tag} label={`${tag} ×`} active onClick={() => onToggle(tag)} variant={variant} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text" value={customInput}
          onChange={e => onCustomChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onCustomAdd()}
          placeholder={placeholder}
          className="tf-input"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={onCustomAdd} className="btn-press" style={{
          padding: '0 12px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9,
          color: 'var(--fg-muted)', cursor: 'pointer',
        }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

function EmotionRow({ value, onChange }: { value: TradeEmotion | undefined; onChange: (v: TradeEmotion) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {EMOTIONS.map(e => (
        <button
          key={e.value} onClick={() => onChange(e.value)}
          title={e.label} className="btn-press"
          style={{
            flex: 1, padding: '7px 0',
            borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)',
            background: value === e.value ? `${e.color}18` : 'rgba(255,255,255,0.03)',
            color: value === e.value ? e.color : 'var(--fg-dim)',
            cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
            boxShadow: value === e.value ? `0 0 0 1px ${e.color}40` : 'none',
            transition: 'all var(--dur-fast)',
          }}
        >
          <div style={{ fontSize: '1rem' }}>{e.icon}</div>
          <div style={{ fontSize: '0.5rem', marginTop: 3, letterSpacing: '0.04em' }}>{e.label}</div>
        </button>
      ))}
    </div>
  )
}

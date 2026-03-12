'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown } from 'lucide-react'
import { addAccount, updateAccount } from '@/lib/firestore/accounts'
import DaulesLogo from '@/components/ui/DaulesLogo'
import ParticleCanvas from '@/components/ParticleCanvas'
import type { Account, AccountType } from '@/types'

// ── Constants ────────────────────────────────────────────────────────────────

const BROKERS = [
  'FTMO', 'MyFundedFx', 'The5ers', 'Topstep', 'Apex Trader Funding',
  'DAWAS', 'E8 Funding', 'Funded Engineer', 'True Forex Funds',
  'FundedNext', 'Lux Trading Firm', 'IC Funded', 'Hola Prime',
  'Alpha Capital', 'Goat Funded Trader', 'Other',
]

const PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Verification', 'KYC', 'Funded']
const STATUSES = ['Active', 'Passed', 'Failed', 'Paused', 'Withdrawn']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CAD', 'CHF']

const SAVE_MSGS = [
  'Connecting to Firestore…',
  'Verifying account details…',
  'Syncing your account…',
  'Almost there…',
]

const TYPE_COLORS: Record<AccountType, { bg: string; color: string; border: string }> = {
  funded:     { bg: 'var(--green-bg)', color: 'var(--green)',    border: 'var(--green-bd)' },
  evaluation: { bg: 'var(--amber-bg)', color: 'var(--amber)',    border: 'var(--amber-bd)' },
  personal:   { bg: 'var(--bg-sub)',   color: 'var(--fg-muted)', border: 'var(--border)'   },
}

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name:             string
  type:             AccountType
  broker:           string
  currency:         string
  openedAt:         string
  phase:            string
  status:           string
  startingBalance:  string
  currentBalance:   string
  accountCost:      string
  monthlyFee:       string
  totalPaid:        string
  payoutSplit:      string
  evalProfitTarget: string
  evalMaxDailyDD:   string
  evalMaxTotalDD:   string
  evalTradingDays:  string
  notes:            string
}

interface Props {
  account?:  Account | null
  uid:       string
  onSave:    (a: Account) => void
  onClose:   () => void
}

// ── Keyframes ────────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes afBdIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes afBdOut { from { opacity:1 } to { opacity:0 } }
  @keyframes afCardIn  {
    from { opacity:0; transform: scale(0.94) translateY(14px) }
    to   { opacity:1; transform: scale(1)    translateY(0)   }
  }
  @keyframes afCardOut {
    from { opacity:1; transform: scale(1)    translateY(0)   }
    to   { opacity:0; transform: scale(0.96) translateY(8px) }
  }
  .af-inp:focus { border-color: rgba(255,255,255,0.2) !important; }
  .af-inp::placeholder { color: var(--fg-xdim); }
  .af-btn-press:active { transform: scale(0.95) !important; }
  .af-inp[type=number]::-webkit-inner-spin-button,
  .af-inp[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .af-inp[type=number] { -moz-appearance: textfield; }
`

// ── Component ────────────────────────────────────────────────────────────────

export default function AccountForm({ account, uid, onSave, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<FormData>({
    name:             account?.name            ?? '',
    type:             account?.type            ?? 'evaluation',
    broker:           account?.broker          ?? '',
    currency:         account?.currency        ?? 'USD',
    openedAt:         account?.openedAt?.split('T')[0] ?? account?.createdAt?.split('T')[0] ?? today,
    phase:            account?.phase           ?? '',
    status:           (account as Account & { status?: string })?.status ?? 'Active',
    startingBalance:  account?.startingBalance?.toString() ?? '',
    currentBalance:   account?.currentBalance?.toString()  ?? '',
    accountCost:      account?.accountCost?.toString()      ?? '',
    monthlyFee:       account?.monthlyFee?.toString()       ?? '',
    totalPaid:        (account as Account & { totalPaid?: number })?.totalPaid?.toString() ?? '',
    payoutSplit:      (account as Account & { payoutSplit?: number })?.payoutSplit?.toString() ?? '80',
    evalProfitTarget: account?.evaluation?.profitTarget?.toString()     ?? '10',
    evalMaxDailyDD:   account?.evaluation?.maxDailyDrawdown?.toString() ?? '5',
    evalMaxTotalDD:   account?.evaluation?.maxTotalDrawdown?.toString() ?? '10',
    evalTradingDays:  account?.evaluation?.tradingDays?.toString()      ?? '10',
    notes:            (account as Account & { notes?: string })?.notes  ?? '',
  })

  const [saving,     setSaving]     = useState(false)
  const [saveMsgIdx, setSaveMsgIdx] = useState(0)
  const [error,      setError]      = useState('')
  const [closing,    setClosing]    = useState(false)
  const [brokerOpen, setBrokerOpen] = useState(false)
  const brokerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  // Auto-generate name from broker + phase when both are set and name is still empty / matches old auto
  const prevAutoName = useRef('')
  useEffect(() => {
    const auto = form.broker && form.phase ? `${form.broker} ${form.phase}` : form.broker
    if (!form.name || form.name === prevAutoName.current) {
      prevAutoName.current = auto
      setForm(f => ({ ...f, name: auto }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.broker, form.phase])

  // Save message cycling
  useEffect(() => {
    if (saving) {
      intervalRef.current = setInterval(() => setSaveMsgIdx(i => (i + 1) % SAVE_MSGS.length), 900)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setSaveMsgIdx(0)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [saving])

  // Close broker dropdown on outside click
  useEffect(() => {
    if (!brokerOpen) return
    const h = (e: MouseEvent) => {
      if (brokerRef.current && !brokerRef.current.contains(e.target as Node)) setBrokerOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [brokerOpen])

  const handleClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 260)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Account name is required'); return }
    setSaving(true); setSaveMsgIdx(0); setError('')
    try {
      const openedAtISO = form.openedAt
        ? new Date(form.openedAt).toISOString()
        : new Date().toISOString()

      const accountData: Omit<Account, 'id'> = {
        uid,
        name:            form.name.trim(),
        type:            form.type,
        broker:          form.broker.trim(),
        currency:        form.currency.trim() || 'USD',
        startingBalance: parseFloat(form.startingBalance) || 0,
        currentBalance:  parseFloat(form.currentBalance)  || parseFloat(form.startingBalance) || 0,
        createdAt:       account?.createdAt ?? openedAtISO,
        openedAt:        openedAtISO,
        ...(form.phase      ? { phase: form.phase }                        : {}),
        ...(form.status     ? { status: form.status as import('@/types').AccountStatus } : {}),
        ...(form.accountCost ? { accountCost: parseFloat(form.accountCost) } : {}),
        ...(form.monthlyFee  ? { monthlyFee:  parseFloat(form.monthlyFee)  } : {}),
        ...(form.totalPaid   ? { totalPaid:   parseFloat(form.totalPaid)   } : {}),
        ...(form.payoutSplit ? { payoutSplit: parseFloat(form.payoutSplit) } : {}),
        ...(form.notes.trim()  ? { notes: form.notes.trim() }              : {}),
        ...(account?.payoutHistory  ? { payoutHistory:  account.payoutHistory  } : {}),
        ...(account?.certificates   ? { certificates:   account.certificates   } : {}),
        ...(form.type === 'evaluation' ? {
          evaluation: {
            profitTarget:     parseFloat(form.evalProfitTarget) || 10,
            maxDailyDrawdown: parseFloat(form.evalMaxDailyDD)   || 5,
            maxTotalDrawdown: parseFloat(form.evalMaxTotalDD)   || 10,
            tradingDays:      parseInt(form.evalTradingDays)    || 10,
          },
        } : {}),
      }

      if (account) {
        await updateAccount(uid, account.id, accountData)
        onSave({ id: account.id, ...accountData })
      } else {
        const newAcc = await addAccount(uid, accountData)
        onSave(newAcc)
      }
      onClose()
    } catch {
      setError('Failed to save account. Please try again.')
      setSaving(false)
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'var(--fg)', borderRadius: 9, padding: '9px 12px',
    fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit',
    colorScheme: 'dark', transition: 'border-color 0.12s',
  }

  const sectionEyebrow: React.CSSProperties = {
    fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.10em',
    textTransform: 'uppercase', color: 'var(--fg-dim)', margin: 0,
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 400,
    color: 'var(--fg-muted)', marginBottom: 6, letterSpacing: '-0.01em',
  }

  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0 20px' }} />

  // ── Render ──────────────────────────────────────────────────────────────────

  const content = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px', overflow: 'hidden',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <style>{STYLES}</style>

      {/* Blur backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'none',
        animation: closing ? 'afBdOut 0.26s ease forwards' : 'afBdIn 0.22s ease both',
      }} />

      {/* Neural network particles */}
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none', opacity: 0.18,
        animation: closing ? 'afBdOut 0.26s ease forwards' : 'afBdIn 0.40s ease both',
      }}>
        <ParticleCanvas />
      </div>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 30%, rgba(0,0,0,0.28) 100%)',
      }} />

      {/* Card */}
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
          ? 'afCardOut 0.26s cubic-bezier(0.4,0,1,1) forwards'
          : 'afCardIn 0.38s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>

        {/* Loading overlay */}
        {saving && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-card)', borderRadius: 18, gap: 18,
          }}>
            <DaulesLogo size={44} color="var(--fg)" loading />
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em', minHeight: 20 }}>
              {SAVE_MSGS[saveMsgIdx]}
            </p>
          </div>
        )}

        {/* Top shimmer line */}
        <div style={{
          height: 1, flexShrink: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, transparent)',
        }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.5625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', fontWeight: 600 }}>
                {account ? 'Edit account' : 'New account'}
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.1875rem', fontWeight: 500, letterSpacing: '-0.05em', color: 'var(--fg)' }}>
                {form.name.trim() || (account ? account.name : 'Untitled account')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="af-btn-press"
              style={{
                width: 30, height: 30, borderRadius: 7, marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-sub)', border: '1px solid var(--border)',
                color: 'var(--fg-dim)', cursor: 'pointer',
              }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '20px 24px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
          scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
        }}>

          {/* ── Identity ─────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={sectionEyebrow}>Identity</p>

            {/* Account name */}
            <div>
              <label style={fieldLabel}>Account Name</label>
              <input
                className="af-inp"
                type="text"
                value={form.name}
                onChange={e => { prevAutoName.current = e.target.value; set('name', e.target.value) }}
                placeholder="e.g. FTMO Phase 1"
                style={inp}
              />
            </div>

            {/* Type selector */}
            <div>
              <label style={fieldLabel}>Account Type</label>
              <div style={{ display: 'flex', gap: 7 }}>
                {(['evaluation', 'funded', 'personal'] as AccountType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => set('type', t)}
                    className="af-btn-press"
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 9, fontSize: '0.8125rem',
                      textTransform: 'capitalize', cursor: 'pointer', fontFamily: 'inherit',
                      background: form.type === t ? TYPE_COLORS[t].bg : 'transparent',
                      border: `1px solid ${form.type === t ? TYPE_COLORS[t].border : 'rgba(255,255,255,0.09)'}`,
                      color: form.type === t ? TYPE_COLORS[t].color : 'var(--fg-muted)',
                      fontWeight: form.type === t ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Broker + currency */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
              <div ref={brokerRef} style={{ position: 'relative' }}>
                <label style={fieldLabel}>Prop Firm / Broker</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="af-inp"
                    type="text"
                    value={form.broker}
                    onChange={e => { set('broker', e.target.value); setBrokerOpen(true) }}
                    onFocus={() => setBrokerOpen(true)}
                    placeholder="FTMO, DAWAS, Topstep…"
                    style={{ ...inp, paddingRight: 30 }}
                  />
                  <ChevronDown size={12} style={{
                    position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--fg-dim)', pointerEvents: 'none',
                  }} />
                </div>
                {brokerOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                    background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, marginTop: 3,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {BROKERS
                      .filter(b => !form.broker || b.toLowerCase().includes(form.broker.toLowerCase()))
                      .map(b => (
                        <button
                          key={b}
                          onClick={() => { set('broker', b === 'Other' ? '' : b); setBrokerOpen(false) }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '8px 13px',
                            background: 'transparent', border: 'none',
                            color: form.broker === b ? 'var(--fg)' : 'var(--fg-muted)',
                            fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: form.broker === b ? 500 : 400,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-sub)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          {b}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <label style={fieldLabel}>Currency</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {CURRENCIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('currency', c)}
                      className="af-btn-press"
                      style={{
                        padding: '6px 10px', borderRadius: 7, fontSize: '0.75rem',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: form.currency === c ? 600 : 400,
                        background: form.currency === c ? 'rgba(255,255,255,0.1)' : 'transparent',
                        border: `1px solid ${form.currency === c ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)'}`,
                        color: form.currency === c ? 'var(--fg)' : 'var(--fg-muted)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Opened */}
            <div>
              <label style={fieldLabel}>Opened</label>
              <input
                className="af-inp"
                type="date"
                value={form.openedAt}
                onChange={e => set('openedAt', e.target.value)}
                style={{ ...inp, maxWidth: 180 }}
              />
            </div>

            {/* Phase / Step */}
            <div>
              <label style={fieldLabel}>Phase / Step</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['', ...PHASES].map(p => (
                  <button
                    key={p || '__none'}
                    type="button"
                    onClick={() => set('phase', p)}
                    className="af-btn-press"
                    style={{
                      padding: '6px 11px', borderRadius: 7, fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: form.phase === p ? 600 : 400,
                      background: form.phase === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                      border: `1px solid ${form.phase === p ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)'}`,
                      color: form.phase === p ? 'var(--fg)' : 'var(--fg-muted)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {p || '—'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label style={fieldLabel}>Status</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {STATUSES.map(s => {
                  const active = form.status === s
                  const statusColor =
                    s === 'Active' || s === 'Passed' ? { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', color: '#4ade80' } :
                    s === 'Failed'    ? { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  color: 'var(--red)' } :
                    s === 'Paused'    ? { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', color: '#fbbf24' } :
                    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', color: 'var(--fg-muted)' }
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className="af-btn-press"
                      style={{
                        padding: '6px 11px', borderRadius: 7, fontSize: '0.75rem',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: active ? 600 : 400,
                        background: active ? statusColor.bg : 'transparent',
                        border: `1px solid ${active ? statusColor.border : 'rgba(255,255,255,0.09)'}`,
                        color: active ? statusColor.color : 'var(--fg-muted)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {divider}

          {/* ── Balances ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={sectionEyebrow}>Balances</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabel}>Starting Balance</label>
                <input className="af-inp" type="number" value={form.startingBalance} onChange={e => set('startingBalance', e.target.value)} placeholder="10000" style={inp} />
              </div>
              <div>
                <label style={fieldLabel}>Current Balance</label>
                <input className="af-inp" type="number" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)} placeholder="10000" style={inp} />
              </div>
            </div>
          </div>

          {divider}

          {/* ── Investment ────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={sectionEyebrow}>Investment</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabel}>{form.type === 'evaluation' ? 'Challenge Fee ($)' : 'Purchase Price ($)'}</label>
                <input className="af-inp" type="number" value={form.accountCost} onChange={e => set('accountCost', e.target.value)} placeholder="0.00" style={inp} />
              </div>
              <div>
                <label style={fieldLabel}>Monthly Fee ($)</label>
                <input className="af-inp" type="number" value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} placeholder="0.00" style={inp} />
              </div>
              <div>
                <label style={fieldLabel}>Total Paid So Far ($)</label>
                <input className="af-inp" type="number" value={form.totalPaid} onChange={e => set('totalPaid', e.target.value)} placeholder="0.00" style={inp} />
              </div>
              <div>
                <label style={fieldLabel}>Payout Split (%)</label>
                <input className="af-inp" type="number" value={form.payoutSplit} onChange={e => set('payoutSplit', e.target.value)} placeholder="80" min={0} max={100} style={inp} />
              </div>
            </div>
          </div>

          {/* ── Evaluation Rules ──────────────────────────── */}
          {form.type === 'evaluation' && (
            <>
              {divider}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ ...sectionEyebrow, color: 'var(--amber)' }}>Evaluation Rules</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>Profit Target (%)</label>
                    <input className="af-inp" type="number" value={form.evalProfitTarget} onChange={e => set('evalProfitTarget', e.target.value)} placeholder="10" style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Max Daily DD (%)</label>
                    <input className="af-inp" type="number" value={form.evalMaxDailyDD} onChange={e => set('evalMaxDailyDD', e.target.value)} placeholder="5" style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Max Total DD (%)</label>
                    <input className="af-inp" type="number" value={form.evalMaxTotalDD} onChange={e => set('evalMaxTotalDD', e.target.value)} placeholder="10" style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Trading Days</label>
                    <input className="af-inp" type="number" value={form.evalTradingDays} onChange={e => set('evalTradingDays', e.target.value)} placeholder="10" style={inp} />
                  </div>
                </div>
              </div>
            </>
          )}

          {divider}

          {/* ── Notes ────────────────────────────────────── */}
          <div>
            <p style={{ ...sectionEyebrow, marginBottom: 14 }}>Notes</p>
            <textarea
              className="af-inp"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this account…"
              rows={3}
              style={{ ...inp, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }}
            />
          </div>

          {error && <p style={{ fontSize: '0.75rem', color: 'var(--red)', margin: 0 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, padding: '14px 24px',
          borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            className="af-btn-press"
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--fg-muted)', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontFamily: 'inherit', opacity: saving ? 0.5 : 1,
              letterSpacing: '-0.01em', transition: 'border-color 0.12s, color 0.12s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="af-btn-press"
            disabled={saving}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 9999,
              background: 'var(--fg)', border: 'none',
              color: 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1, letterSpacing: '-0.02em',
              transition: 'opacity 0.12s',
            }}
          >
            {account ? 'Update Account' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, Check } from 'lucide-react'
import { addAccount, updateAccount } from '@/lib/firestore/accounts'
import DaulesLogo from '@/components/ui/DaulesLogo'
import ParticleCanvas from '@/components/ParticleCanvas'
import type {
  Account, AccountType,
  AccountEnvironment, MarketType, TradingStyle, RiskModel, AvgDuration, AccountPurpose,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const BROKERS = [
  'FTMO', 'MyFundedFx', 'The5ers', 'Topstep', 'Apex Trader Funding',
  'DAWAS', 'E8 Funding', 'Funded Engineer', 'True Forex Funds',
  'FundedNext', 'Lux Trading Firm', 'IC Funded', 'Hola Prime',
  'Alpha Capital', 'Goat Funded Trader', 'Other',
]

const PHASES    = ['Phase 1', 'Phase 2', 'Phase 3', 'Verification', 'KYC', 'Funded']
const STATUSES  = ['Active', 'Passed', 'Failed', 'Paused', 'Withdrawn']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'USDT', 'BTC']

const MARKET_TYPES: { value: MarketType; label: string }[] = [
  { value: 'forex',   label: 'Forex'   },
  { value: 'crypto',  label: 'Crypto'  },
  { value: 'stocks',  label: 'Stocks'  },
  { value: 'futures', label: 'Futures' },
  { value: 'options', label: 'Options' },
  { value: 'mixed',   label: 'Mixed'   },
]

const ENVIRONMENTS: { value: AccountEnvironment; label: string; desc: string }[] = [
  { value: 'live',             label: 'Live',             desc: 'Real capital. Every trade counts.' },
  { value: 'demo',             label: 'Demo',             desc: 'Simulation. No real risk.' },
  { value: 'prop_firm',        label: 'Prop Firm',        desc: 'Funded evaluation or funded program.' },
  { value: 'strategy_testing', label: 'Strategy Testing', desc: 'Validate setups before going live.' },
  { value: 'development',      label: 'Development',      desc: 'Skill-building with limited capital.' },
  { value: 'institutional',    label: 'Institutional',    desc: 'Structured portfolio management.' },
]

const TRADING_STYLES: { value: TradingStyle; label: string; desc: string }[] = [
  { value: 'scalping',  label: 'Scalping',  desc: 'Seconds to minutes' },
  { value: 'intraday',  label: 'Intraday',  desc: 'Within the session'  },
  { value: 'swing',     label: 'Swing',     desc: 'Days to weeks'       },
  { value: 'position',  label: 'Position',  desc: 'Weeks to months'     },
]

const RISK_MODELS: { value: RiskModel; label: string; desc: string }[] = [
  { value: 'fixed',         label: 'Fixed $',     desc: 'Same dollar risk every trade'    },
  { value: 'percentage',    label: '% of Balance', desc: 'Risk scales with equity'         },
  { value: 'variable',      label: 'Variable',    desc: 'Adjusted by conviction'          },
  { value: 'discretionary', label: 'Discretionary', desc: 'No fixed formula'              },
]

const AVG_DURATIONS: { value: AvgDuration; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours',   label: 'Hours'   },
  { value: 'days',    label: 'Days'    },
  { value: 'weeks',   label: 'Weeks'   },
]

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

const TOTAL_STEPS = 5

// ── FormData ──────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 – Identity
  name:             string
  broker:           string
  marketType:       MarketType
  currency:         string
  openedAt:         string
  // Step 2 – Environment
  environment:      AccountEnvironment
  type:             AccountType
  phase:            string
  status:           string
  // Step 3 – Parameters
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
  // Step 4 – Style
  tradingStyle:     TradingStyle
  avgDuration:      AvgDuration
  riskModel:        RiskModel
  strategies:       string[]
  strategyInput:    string
  // Notes (available in edit mode)
  notes:            string
  // Purpose question (Quick Create)
  purpose:          AccountPurpose | ''
}

interface Props {
  account?:  Account | null
  uid:       string
  onSave:    (a: Account) => void
  onClose:   () => void
}

// ── Keyframes ─────────────────────────────────────────────────────────────────

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
  @keyframes afStepIn {
    from { opacity:0; transform: translateX(16px) }
    to   { opacity:1; transform: translateX(0)    }
  }
  .af-inp:focus { border-color: rgba(255,255,255,0.2) !important; }
  .af-inp::placeholder { color: var(--fg-xdim); }
  .af-btn-press:active { transform: scale(0.95) !important; }
  .af-inp[type=number]::-webkit-inner-spin-button,
  .af-inp[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .af-inp[type=number] { -moz-appearance: textfield; }
  .af-env-card:hover { border-color: rgba(255,255,255,0.18) !important; background: rgba(255,255,255,0.04) !important; }
`

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountForm({ account, uid, onSave, onClose }: Props) {
  const isEdit = !!account
  const today  = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    name:             account?.name                       ?? '',
    broker:           account?.broker                     ?? '',
    marketType:       (account?.marketType as MarketType) ?? 'forex',
    currency:         account?.currency                   ?? 'USD',
    openedAt:         account?.openedAt?.split('T')[0]    ?? account?.createdAt?.split('T')[0] ?? today,
    environment:      account?.environment                ?? 'prop_firm',
    type:             account?.type                       ?? 'evaluation',
    phase:            account?.phase                      ?? '',
    status:           account?.status                     ?? 'Active',
    startingBalance:  account?.startingBalance?.toString() ?? '',
    currentBalance:   account?.currentBalance?.toString()  ?? '',
    accountCost:      account?.accountCost?.toString()      ?? '',
    monthlyFee:       account?.monthlyFee?.toString()       ?? '',
    totalPaid:        account?.totalPaid?.toString()        ?? '',
    payoutSplit:      account?.payoutSplit?.toString()      ?? '80',
    evalProfitTarget: account?.evaluation?.profitTarget?.toString()     ?? '10',
    evalMaxDailyDD:   account?.evaluation?.maxDailyDrawdown?.toString() ?? '5',
    evalMaxTotalDD:   account?.evaluation?.maxTotalDrawdown?.toString() ?? '10',
    evalTradingDays:  account?.evaluation?.tradingDays?.toString()      ?? '10',
    tradingStyle:     account?.tradingStyle                ?? 'intraday',
    avgDuration:      account?.avgDuration                 ?? 'hours',
    riskModel:        account?.riskModel                   ?? 'fixed',
    strategies:       account?.strategies                  ?? [],
    strategyInput:    '',
    notes:            account?.notes                       ?? '',
    purpose:          account?.purpose                     ?? '',
  })

  const [saving,     setSaving]     = useState(false)
  const [saveMsgIdx, setSaveMsgIdx] = useState(0)
  const [error,      setError]      = useState('')
  const [closing,    setClosing]    = useState(false)
  const [brokerOpen, setBrokerOpen] = useState(false)
  const brokerRef   = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  // Auto-generate name from broker + phase when in create mode
  const prevAutoName = useRef('')
  useEffect(() => {
    if (isEdit) return
    const auto = form.broker && form.phase
      ? `${form.broker} ${form.phase}`
      : form.broker
    if (!form.name || form.name === prevAutoName.current) {
      prevAutoName.current = auto
      setForm(f => ({ ...f, name: auto }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.broker, form.phase, isEdit])

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
        environment:     form.environment,
        marketType:      form.marketType,
        tradingStyle:    form.tradingStyle,
        avgDuration:     form.avgDuration,
        riskModel:       form.riskModel,
        ...(form.strategies.length > 0 ? { strategies: form.strategies } : {}),
        ...(form.phase      ? { phase: form.phase }                                           : {}),
        ...(form.status     ? { status: form.status as import('@/types').AccountStatus }      : {}),
        ...(form.accountCost ? { accountCost: parseFloat(form.accountCost) }                  : {}),
        ...(form.monthlyFee  ? { monthlyFee:  parseFloat(form.monthlyFee)  }                  : {}),
        ...(form.totalPaid   ? { totalPaid:   parseFloat(form.totalPaid)   }                  : {}),
        ...(form.payoutSplit ? { payoutSplit: parseFloat(form.payoutSplit) }                  : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() }                                  : {}),
        ...(form.purpose      ? { purpose: form.purpose as AccountPurpose }                   : {}),
        ...(account?.payoutHistory   ? { payoutHistory:   account.payoutHistory   }           : {}),
        ...(account?.timelineEvents  ? { timelineEvents:  account.timelineEvents  }           : {}),
        ...(account?.certificates    ? { certificates:    account.certificates    }           : {}),
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

  // ── Shared styles ────────────────────────────────────────────────────────────

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

  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0 18px' }} />

  const pillBtn = (active: boolean, color?: { bg: string; border: string; color: string }): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 8, fontSize: '0.8125rem',
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: active ? 600 : 400,
    background: active ? (color?.bg ?? 'rgba(255,255,255,0.10)') : 'transparent',
    border: `1px solid ${active ? (color?.border ?? 'rgba(255,255,255,0.22)') : 'rgba(255,255,255,0.09)'}`,
    color: active ? (color?.color ?? 'var(--fg)') : 'var(--fg-muted)',
    transition: 'all 0.12s',
  })

  // ── STEP RENDERERS ───────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'afStepIn 0.22s ease both' }}>
      <div>
        <p style={{ ...sectionEyebrow, color: 'var(--fg-dim)', marginBottom: 2 }}>Step 1 of {TOTAL_STEPS}</p>
        <h3 style={{ margin: '4px 0 0', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Account Identity
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
          Name and locate your trading environment.
        </p>
      </div>

      <div>
        <label style={fieldLabel}>Account Name</label>
        <input
          className="af-inp" type="text" value={form.name}
          onChange={e => { prevAutoName.current = e.target.value; set('name', e.target.value) }}
          placeholder="e.g. FTMO Phase 1, Binance Futures Main"
          style={inp}
        />
      </div>

      <div ref={brokerRef} style={{ position: 'relative' }}>
        <label style={fieldLabel}>Prop Firm / Broker</label>
        <div style={{ position: 'relative' }}>
          <input
            className="af-inp" type="text" value={form.broker}
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
            maxHeight: 180, overflowY: 'auto',
          }}>
            {BROKERS
              .filter(b => !form.broker || b.toLowerCase().includes(form.broker.toLowerCase()))
              .map(b => (
                <button key={b} onClick={() => { set('broker', b === 'Other' ? '' : b); setBrokerOpen(false) }}
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
        <label style={fieldLabel}>Market</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MARKET_TYPES.map(m => (
            <button key={m.value} type="button" className="af-btn-press"
              onClick={() => set('marketType', m.value)}
              style={pillBtn(form.marketType === m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Currency</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CURRENCIES.map(c => (
              <button key={c} type="button" className="af-btn-press"
                onClick={() => set('currency', c)}
                style={pillBtn(form.currency === c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Opened</label>
          <input className="af-inp" type="date" value={form.openedAt}
            onChange={e => set('openedAt', e.target.value)}
            style={{ ...inp }}
          />
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'afStepIn 0.22s ease both' }}>
      <div>
        <p style={{ ...sectionEyebrow, color: 'var(--fg-dim)', marginBottom: 2 }}>Step 2 of {TOTAL_STEPS}</p>
        <h3 style={{ margin: '4px 0 0', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Trading Environment
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
          Different environments shape different trading behavior.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ENVIRONMENTS.map(env => (
          <button
            key={env.value}
            type="button"
            className="af-env-card"
            onClick={() => set('environment', env.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
              background: form.environment === env.value ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: `1px solid ${form.environment === env.value ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
              textAlign: 'left', fontFamily: 'inherit',
              transition: 'all 0.12s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${form.environment === env.value ? 'var(--fg)' : 'rgba(255,255,255,0.20)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: form.environment === env.value ? 'var(--fg)' : 'transparent',
              transition: 'all 0.12s',
            }}>
              {form.environment === env.value && <Check size={10} style={{ color: 'var(--bg)' }} />}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                {env.label}
              </p>
              <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>{env.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {divider}

      <div>
        <label style={fieldLabel}>Account Type</label>
        <div style={{ display: 'flex', gap: 7 }}>
          {(['evaluation', 'funded', 'personal'] as AccountType[]).map(t => (
            <button key={t} type="button" className="af-btn-press"
              onClick={() => set('type', t)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 9, fontSize: '0.8125rem',
                textTransform: 'capitalize', cursor: 'pointer', fontFamily: 'inherit',
                background: form.type === t ? TYPE_COLORS[t].bg : 'transparent',
                border: `1px solid ${form.type === t ? TYPE_COLORS[t].border : 'rgba(255,255,255,0.09)'}`,
                color: form.type === t ? TYPE_COLORS[t].color : 'var(--fg-muted)',
                fontWeight: form.type === t ? 600 : 400, transition: 'all 0.12s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Phase / Step</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['', ...PHASES].map(p => (
              <button key={p || '__none'} type="button" className="af-btn-press"
                onClick={() => set('phase', p)}
                style={pillBtn(form.phase === p)}
              >
                {p || '—'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Status</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {STATUSES.map(s => {
              const active = form.status === s
              const col =
                s === 'Active' || s === 'Passed' ? { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', color: '#4ade80' } :
                s === 'Failed'   ? { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  color: 'var(--red)' } :
                s === 'Paused'   ? { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', color: '#fbbf24' } :
                { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', color: 'var(--fg-muted)' }
              return (
                <button key={s} type="button" className="af-btn-press"
                  onClick={() => set('status', s)}
                  style={pillBtn(active, active ? col : undefined)}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'afStepIn 0.22s ease both' }}>
      <div>
        <p style={{ ...sectionEyebrow, color: 'var(--fg-dim)', marginBottom: 2 }}>Step 3 of {TOTAL_STEPS}</p>
        <h3 style={{ margin: '4px 0 0', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Account Parameters
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
          Define the financial boundaries and risk rules.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabel}>Starting Balance</label>
          <input className="af-inp" type="number" value={form.startingBalance}
            onChange={e => set('startingBalance', e.target.value)} placeholder="10000" style={inp} />
        </div>
        <div>
          <label style={fieldLabel}>Current Balance</label>
          <input className="af-inp" type="number" value={form.currentBalance}
            onChange={e => set('currentBalance', e.target.value)} placeholder="10000" style={inp} />
        </div>
      </div>

      {divider}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabel}>{form.type === 'evaluation' ? 'Challenge Fee ($)' : 'Purchase Price ($)'}</label>
          <input className="af-inp" type="number" value={form.accountCost}
            onChange={e => set('accountCost', e.target.value)} placeholder="0.00" style={inp} />
        </div>
        <div>
          <label style={fieldLabel}>Monthly Fee ($)</label>
          <input className="af-inp" type="number" value={form.monthlyFee}
            onChange={e => set('monthlyFee', e.target.value)} placeholder="0.00" style={inp} />
        </div>
        <div>
          <label style={fieldLabel}>Total Paid So Far ($)</label>
          <input className="af-inp" type="number" value={form.totalPaid}
            onChange={e => set('totalPaid', e.target.value)} placeholder="0.00" style={inp} />
        </div>
        <div>
          <label style={fieldLabel}>Payout Split (%)</label>
          <input className="af-inp" type="number" value={form.payoutSplit}
            onChange={e => set('payoutSplit', e.target.value)} placeholder="80" min={0} max={100} style={inp} />
        </div>
      </div>

      {form.type === 'evaluation' && (
        <>
          {divider}
          <p style={{ ...sectionEyebrow, color: 'var(--amber)' }}>Evaluation Rules</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Profit Target (%)</label>
              <input className="af-inp" type="number" value={form.evalProfitTarget}
                onChange={e => set('evalProfitTarget', e.target.value)} placeholder="10" style={inp} />
            </div>
            <div>
              <label style={fieldLabel}>Max Daily DD (%)</label>
              <input className="af-inp" type="number" value={form.evalMaxDailyDD}
                onChange={e => set('evalMaxDailyDD', e.target.value)} placeholder="5" style={inp} />
            </div>
            <div>
              <label style={fieldLabel}>Max Total DD (%)</label>
              <input className="af-inp" type="number" value={form.evalMaxTotalDD}
                onChange={e => set('evalMaxTotalDD', e.target.value)} placeholder="10" style={inp} />
            </div>
            <div>
              <label style={fieldLabel}>Trading Days</label>
              <input className="af-inp" type="number" value={form.evalTradingDays}
                onChange={e => set('evalTradingDays', e.target.value)} placeholder="10" style={inp} />
            </div>
          </div>
        </>
      )}
    </div>
  )

  const renderStep4 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'afStepIn 0.22s ease both' }}>
      <div>
        <p style={{ ...sectionEyebrow, color: 'var(--fg-dim)', marginBottom: 2 }}>Step 4 of {TOTAL_STEPS}</p>
        <h3 style={{ margin: '4px 0 0', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Trading Style
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
          Context shapes how Daules interprets your behavior in this account.
        </p>
      </div>

      <div>
        <label style={fieldLabel}>Primary Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {TRADING_STYLES.map(s => (
            <button key={s.value} type="button" className="af-btn-press"
              onClick={() => set('tradingStyle', s.value)}
              style={{
                padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                background: form.tradingStyle === s.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${form.tradingStyle === s.value ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
                textAlign: 'left', transition: 'all 0.12s',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: form.tradingStyle === s.value ? 'var(--fg)' : 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                {s.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--fg-xdim)' }}>{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={fieldLabel}>Average Trade Duration</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {AVG_DURATIONS.map(d => (
            <button key={d.value} type="button" className="af-btn-press"
              onClick={() => set('avgDuration', d.value)}
              style={{ ...pillBtn(form.avgDuration === d.value), flex: 1 }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={fieldLabel}>Risk Model</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {RISK_MODELS.map(r => (
            <button key={r.value} type="button" className="af-btn-press"
              onClick={() => set('riskModel', r.value)}
              style={{
                padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                background: form.riskModel === r.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${form.riskModel === r.value ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
                textAlign: 'left', transition: 'all 0.12s',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: form.riskModel === r.value ? 'var(--fg)' : 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                {r.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--fg-xdim)' }}>{r.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={fieldLabel}>Strategy Tags <span style={{ color: 'var(--fg-xdim)', fontWeight: 400 }}>(optional)</span></label>
        <div style={{ display: 'flex', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
          {form.strategies.map(s => (
            <span key={s} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 99,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
              fontSize: '0.75rem', color: 'var(--fg-muted)',
            }}>
              {s}
              <button onClick={() => set('strategies', form.strategies.filter(x => x !== s))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-xdim)', padding: 0, lineHeight: 1 }}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <input
            className="af-inp"
            type="text"
            value={form.strategyInput}
            onChange={e => set('strategyInput', e.target.value)}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && form.strategyInput.trim()) {
                e.preventDefault()
                const tag = form.strategyInput.trim().replace(/,$/, '')
                if (tag && !form.strategies.includes(tag)) {
                  set('strategies', [...form.strategies, tag])
                }
                set('strategyInput', '')
              }
            }}
            placeholder="Breakout, Mean Reversion… press Enter to add"
            style={{ ...inp, flex: 1 }}
          />
        </div>
      </div>
    </div>
  )

  const renderStep5 = () => {
    const envLabel = ENVIRONMENTS.find(e => e.value === form.environment)?.label ?? form.environment
    const styleLabel = TRADING_STYLES.find(s => s.value === form.tradingStyle)?.label ?? form.tradingStyle
    const riskLabel  = RISK_MODELS.find(r => r.value === form.riskModel)?.label ?? form.riskModel
    const durLabel   = AVG_DURATIONS.find(d => d.value === form.avgDuration)?.label ?? form.avgDuration

    const rows: [string, string][] = [
      ['Name',        form.name || '—'],
      ['Broker',      form.broker || '—'],
      ['Market',      form.marketType],
      ['Currency',    form.currency],
      ['Environment', envLabel],
      ['Type',        form.type],
      ['Phase',       form.phase || '—'],
      ['Status',      form.status],
      ['Balance',     form.startingBalance ? `$${parseFloat(form.startingBalance).toLocaleString()}` : '—'],
      ['Challenge Fee', form.accountCost ? `$${parseFloat(form.accountCost).toLocaleString()}` : '—'],
      ['Trading Style', styleLabel],
      ['Risk Model',  riskLabel],
      ['Duration',    durLabel],
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'afStepIn 0.22s ease both' }}>
        <div>
          <p style={{ ...sectionEyebrow, color: 'var(--fg-dim)', marginBottom: 2 }}>Step 5 of {TOTAL_STEPS}</p>
          <h3 style={{ margin: '4px 0 0', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
            Review
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
            Confirm your account configuration before creating.
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          {rows.map(([label, val], i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center',
              padding: '9px 14px',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>{label}</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
                {val}
              </span>
            </div>
          ))}
          {form.strategies.length > 0 && (
            <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Strategies</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                {form.strategies.map(s => (
                  <span key={s} style={{
                    padding: '2px 8px', borderRadius: 99, fontSize: '0.6875rem',
                    background: 'rgba(255,255,255,0.07)', color: 'var(--fg-muted)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ fontSize: '0.75rem', color: 'var(--red)', margin: 0 }}>{error}</p>}
      </div>
    )
  }

  // ── Edit mode: single-page form ──────────────────────────────────────────────

  const renderEditForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={sectionEyebrow}>Identity</p>
        <div>
          <label style={fieldLabel}>Account Name</label>
          <input className="af-inp" type="text" value={form.name}
            onChange={e => { prevAutoName.current = e.target.value; set('name', e.target.value) }}
            placeholder="e.g. FTMO Phase 1" style={inp} />
        </div>
        <div>
          <label style={fieldLabel}>Account Type</label>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['evaluation', 'funded', 'personal'] as AccountType[]).map(t => (
              <button key={t} type="button" className="af-btn-press" onClick={() => set('type', t)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 9, fontSize: '0.8125rem',
                  textTransform: 'capitalize', cursor: 'pointer', fontFamily: 'inherit',
                  background: form.type === t ? TYPE_COLORS[t].bg : 'transparent',
                  border: `1px solid ${form.type === t ? TYPE_COLORS[t].border : 'rgba(255,255,255,0.09)'}`,
                  color: form.type === t ? TYPE_COLORS[t].color : 'var(--fg-muted)',
                  fontWeight: form.type === t ? 600 : 400, transition: 'all 0.12s',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div ref={brokerRef} style={{ position: 'relative' }}>
          <label style={fieldLabel}>Prop Firm / Broker</label>
          <div style={{ position: 'relative' }}>
            <input className="af-inp" type="text" value={form.broker}
              onChange={e => { set('broker', e.target.value); setBrokerOpen(true) }}
              onFocus={() => setBrokerOpen(true)}
              placeholder="FTMO, DAWAS, Topstep…"
              style={{ ...inp, paddingRight: 30 }} />
            <ChevronDown size={12} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-dim)', pointerEvents: 'none' }} />
          </div>
          {brokerOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, marginTop: 3, boxShadow: '0 10px 40px rgba(0,0,0,0.45)', maxHeight: 180, overflowY: 'auto' }}>
              {BROKERS.filter(b => !form.broker || b.toLowerCase().includes(form.broker.toLowerCase())).map(b => (
                <button key={b} onClick={() => { set('broker', b === 'Other' ? '' : b); setBrokerOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 13px', background: 'transparent', border: 'none', color: form.broker === b ? 'var(--fg)' : 'var(--fg-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: form.broker === b ? 500 : 400 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-sub)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
          <div>
            <label style={fieldLabel}>Opened</label>
            <input className="af-inp" type="date" value={form.openedAt} onChange={e => set('openedAt', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={fieldLabel}>Currency</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {CURRENCIES.map(c => (
                <button key={c} type="button" className="af-btn-press" onClick={() => set('currency', c)} style={pillBtn(form.currency === c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Phase / Step</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['', ...PHASES].map(p => (
              <button key={p || '__none'} type="button" className="af-btn-press" onClick={() => set('phase', p)} style={pillBtn(form.phase === p)}>{p || '—'}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Status</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {STATUSES.map(s => {
              const active = form.status === s
              const col = s === 'Active' || s === 'Passed' ? { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', color: '#4ade80' } : s === 'Failed' ? { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', color: 'var(--red)' } : s === 'Paused' ? { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', color: '#fbbf24' } : { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', color: 'var(--fg-muted)' }
              return <button key={s} type="button" className="af-btn-press" onClick={() => set('status', s)} style={pillBtn(active, active ? col : undefined)}>{s}</button>
            })}
          </div>
        </div>
      </div>
      {divider}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={sectionEyebrow}>Balances</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={fieldLabel}>Starting Balance</label><input className="af-inp" type="number" value={form.startingBalance} onChange={e => set('startingBalance', e.target.value)} placeholder="10000" style={inp} /></div>
          <div><label style={fieldLabel}>Current Balance</label><input className="af-inp" type="number" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)} placeholder="10000" style={inp} /></div>
        </div>
      </div>
      {divider}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={sectionEyebrow}>Investment</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={fieldLabel}>{form.type === 'evaluation' ? 'Challenge Fee ($)' : 'Purchase Price ($)'}</label><input className="af-inp" type="number" value={form.accountCost} onChange={e => set('accountCost', e.target.value)} placeholder="0.00" style={inp} /></div>
          <div><label style={fieldLabel}>Monthly Fee ($)</label><input className="af-inp" type="number" value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} placeholder="0.00" style={inp} /></div>
          <div><label style={fieldLabel}>Total Paid ($)</label><input className="af-inp" type="number" value={form.totalPaid} onChange={e => set('totalPaid', e.target.value)} placeholder="0.00" style={inp} /></div>
          <div><label style={fieldLabel}>Payout Split (%)</label><input className="af-inp" type="number" value={form.payoutSplit} onChange={e => set('payoutSplit', e.target.value)} placeholder="80" style={inp} /></div>
        </div>
      </div>
      {form.type === 'evaluation' && (
        <>
          {divider}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ ...sectionEyebrow, color: 'var(--amber)' }}>Evaluation Rules</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={fieldLabel}>Profit Target (%)</label><input className="af-inp" type="number" value={form.evalProfitTarget} onChange={e => set('evalProfitTarget', e.target.value)} placeholder="10" style={inp} /></div>
              <div><label style={fieldLabel}>Max Daily DD (%)</label><input className="af-inp" type="number" value={form.evalMaxDailyDD} onChange={e => set('evalMaxDailyDD', e.target.value)} placeholder="5" style={inp} /></div>
              <div><label style={fieldLabel}>Max Total DD (%)</label><input className="af-inp" type="number" value={form.evalMaxTotalDD} onChange={e => set('evalMaxTotalDD', e.target.value)} placeholder="10" style={inp} /></div>
              <div><label style={fieldLabel}>Trading Days</label><input className="af-inp" type="number" value={form.evalTradingDays} onChange={e => set('evalTradingDays', e.target.value)} placeholder="10" style={inp} /></div>
            </div>
          </div>
        </>
      )}
      {divider}
      <div>
        <p style={{ ...sectionEyebrow, marginBottom: 14 }}>Notes</p>
        <textarea className="af-inp" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this account…" rows={3} style={{ ...inp, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }} />
      </div>
      {error && <p style={{ fontSize: '0.75rem', color: 'var(--red)', margin: 0 }}>{error}</p>}
    </div>
  )

  // ── Progress dots ─────────────────────────────────────────────────────────────

  const renderStepDots = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          onClick={() => { if (i + 1 < step) setStep(i + 1) }}
          style={{
            width: i + 1 === step ? 20 : 6,
            height: 6,
            borderRadius: 99,
            background: i + 1 <= step ? 'var(--fg)' : 'rgba(255,255,255,0.15)',
            transition: 'all 0.22s cubic-bezier(0.34,1.4,0.64,1)',
            cursor: i + 1 < step ? 'pointer' : 'default',
          }}
        />
      ))}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

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
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'none',
        animation: closing ? 'afBdOut 0.26s ease forwards' : 'afBdIn 0.22s ease both',
      }} />

      {/* Particles */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.18, animation: closing ? 'afBdOut 0.26s ease forwards' : 'afBdIn 0.40s ease both' }}>
        <ParticleCanvas />
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 30%, rgba(0,0,0,0.28) 100%)' }} />

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
        backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        overflow: 'hidden',
        animation: closing
          ? 'afCardOut 0.26s cubic-bezier(0.4,0,1,1) forwards'
          : 'afCardIn 0.38s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>

        {/* Loading overlay */}
        {saving && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: 18, gap: 18 }}>
            <DaulesLogo size={44} color="var(--fg)" loading />
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em', minHeight: 20 }}>
              {SAVE_MSGS[saveMsgIdx]}
            </p>
          </div>
        )}

        {/* Top shimmer line */}
        <div style={{ height: 1, flexShrink: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, transparent)' }} />

        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {!isEdit && renderStepDots()}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--fg)' }}>
                  {isEdit
                    ? (form.name.trim() || account?.name || 'Edit Account')
                    : (form.name.trim() || 'New Account')}
                </h2>
              </div>
            </div>
            <button onClick={handleClose} className="af-btn-press" style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-sub)', border: '1px solid var(--border)', color: 'var(--fg-dim)', cursor: 'pointer' }}>
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px 24px', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
          {isEdit
            ? renderEditForm()
            : step === 1 ? renderStep1()
            : step === 2 ? renderStep2()
            : step === 3 ? renderStep3()
            : step === 4 ? renderStep4()
            : renderStep5()
          }
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {isEdit ? (
            <>
              <button onClick={handleClose} className="af-btn-press" disabled={saving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--fg-muted)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit', opacity: saving ? 0.5 : 1, letterSpacing: '-0.01em', transition: 'border-color 0.12s, color 0.12s' }}>
                Cancel
              </button>
              <button onClick={handleSave} className="af-btn-press" disabled={saving}
                style={{ flex: 2, padding: '10px 0', borderRadius: 9999, background: 'var(--fg)', border: 'none', color: 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.7 : 1, letterSpacing: '-0.02em', transition: 'opacity 0.12s' }}>
                Update Account
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => step > 1 ? setStep(s => s - 1) : handleClose()}
                className="af-btn-press"
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit', letterSpacing: '-0.01em', transition: 'border-color 0.12s, color 0.12s' }}>
                {step > 1 ? 'Back' : 'Cancel'}
              </button>
              {step < TOTAL_STEPS ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="af-btn-press"
                  style={{ flex: 2, padding: '10px 0', borderRadius: 9999, background: 'var(--fg)', border: 'none', color: 'var(--bg)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-0.02em', transition: 'opacity 0.12s' }}>
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="af-btn-press"
                  disabled={saving}
                  style={{ flex: 2, padding: '10px 0', borderRadius: 9999, background: 'var(--fg)', border: 'none', color: 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.7 : 1, letterSpacing: '-0.02em', transition: 'opacity 0.12s' }}>
                  Create Account
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}

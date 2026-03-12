'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { addAccount, updateAccount } from '@/lib/firestore/accounts'
import DaulesLogo from '@/components/ui/DaulesLogo'
import type { Account, AccountType } from '@/types'

const ACCOUNT_TYPE_COLORS: Record<AccountType, { bg: string; color: string; border: string }> = {
  funded:     { bg: 'var(--green-bg)', color: 'var(--green)',    border: 'var(--green-bd)' },
  evaluation: { bg: 'var(--amber-bg)', color: 'var(--amber)',    border: 'var(--amber-bd)' },
  personal:   { bg: 'var(--bg-sub)',   color: 'var(--fg-muted)', border: 'var(--border)' },
}

const BROKERS = [
  'FTMO', 'MyFundedFx', 'The5ers', 'Topstep', 'Apex Trader Funding',
  'DAWAS', 'E8 Funding', 'Funded Engineer', 'True Forex Funds',
  'FundedNext', 'Lux Trading Firm', 'IC Funded', 'Other',
]

const SAVE_MESSAGES = [
  'Connecting to Firestore…',
  'Verifying account details…',
  'Syncing your account…',
  'Almost there…',
]

const EVAL_PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Verification', 'KYC', 'Funded']

interface AccountFormData {
  name:             string
  type:             AccountType
  broker:           string
  currency:         string
  startingBalance:  string
  currentBalance:   string
  accountCost:      string
  monthlyFee:       string
  openedAt:         string
  phase:            string
  evalProfitTarget: string
  evalMaxDailyDD:   string
  evalMaxTotalDD:   string
  evalTradingDays:  string
}

interface Props {
  account?: Account | null
  uid: string
  onSave: (a: Account) => void
  onClose: () => void
}

export default function AccountModal({ account, uid, onSave, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<AccountFormData>({
    name:             account?.name ?? '',
    type:             account?.type ?? 'evaluation',
    broker:           account?.broker ?? '',
    currency:         account?.currency ?? 'USD',
    startingBalance:  account?.startingBalance?.toString() ?? '',
    currentBalance:   account?.currentBalance?.toString() ?? '',
    accountCost:      account?.accountCost?.toString() ?? '',
    monthlyFee:       account?.monthlyFee?.toString() ?? '',
    openedAt:         account?.openedAt ?? account?.createdAt?.split('T')[0] ?? today,
    phase:            account?.phase ?? '',
    evalProfitTarget: account?.evaluation?.profitTarget?.toString() ?? '10',
    evalMaxDailyDD:   account?.evaluation?.maxDailyDrawdown?.toString() ?? '5',
    evalMaxTotalDD:   account?.evaluation?.maxTotalDrawdown?.toString() ?? '10',
    evalTradingDays:  account?.evaluation?.tradingDays?.toString() ?? '10',
  })
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(0)
  const [error,       setError]       = useState('')
  const [brokerOpen,  setBrokerOpen]  = useState(false)
  const brokerRef = useRef<HTMLDivElement>(null)

  const update = <K extends keyof AccountFormData>(k: K, v: AccountFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!saving) return
    const id = setInterval(() => setSaveMsg(m => (m + 1) % SAVE_MESSAGES.length), 900)
    return () => clearInterval(id)
  }, [saving])

  // Close broker dropdown on outside click
  useEffect(() => {
    if (!brokerOpen) return
    const handler = (e: MouseEvent) => {
      if (brokerRef.current && !brokerRef.current.contains(e.target as Node)) {
        setBrokerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [brokerOpen])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Account name is required'); return }
    setSaving(true); setSaveMsg(0); setError('')
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
        currentBalance:  parseFloat(form.currentBalance) || parseFloat(form.startingBalance) || 0,
        createdAt:       account?.createdAt ?? openedAtISO,
        openedAt:        openedAtISO,
        ...(form.phase        ? { phase: form.phase }                              : {}),
        ...(form.accountCost  ? { accountCost: parseFloat(form.accountCost) }      : {}),
        ...(form.monthlyFee   ? { monthlyFee:  parseFloat(form.monthlyFee)  }      : {}),
        ...(account?.payoutHistory   ? { payoutHistory:   account.payoutHistory   } : {}),
        ...(account?.certificates    ? { certificates:    account.certificates    } : {}),
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

  const inp: React.CSSProperties = {
    background: 'var(--bg-sub)', border: '1px solid var(--border)',
    color: 'var(--fg)', borderRadius: 8, padding: '8px 12px',
    fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit',
    colorScheme: 'dark',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--fg-dim)', margin: 0,
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: '0.6875rem', fontWeight: 500,
    letterSpacing: '-0.01em', color: 'var(--fg-muted)', marginBottom: 5,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, position: 'relative',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 64px)',
      }}>

        {/* Loading overlay */}
        {saving && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-card)', borderRadius: 16, gap: 18,
          }}>
            <DaulesLogo size={44} color="var(--fg)" loading />
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em', minHeight: 20 }}>
              {SAVE_MESSAGES[saveMsg]}
            </p>
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.04em', margin: 0 }}>
              {account ? 'Edit Account' : 'New Account'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: '2px 0 0', letterSpacing: '-0.01em' }}>
              {account ? 'Update your account details' : 'Track a new prop firm or personal account'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 0,
          overflowY: 'auto', flex: 1, minHeight: 0,
          scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
        }}>

          {/* — Identity — */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <p style={sectionLabel}>Identity</p>

            <div>
              <label style={fieldLabel}>Account Name</label>
              <input
                type="text" value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="e.g. FTMO Phase 1"
                style={inp}
              />
            </div>

            <div>
              <label style={fieldLabel}>Account Type</label>
              <div style={{ display: 'flex', gap: 7 }}>
                {(['evaluation', 'funded', 'personal'] as AccountType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => update('type', t)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: '0.8125rem',
                      textTransform: 'capitalize', cursor: 'pointer', fontFamily: 'inherit',
                      background: form.type === t ? ACCOUNT_TYPE_COLORS[t].bg : 'transparent',
                      border: `1px solid ${form.type === t ? ACCOUNT_TYPE_COLORS[t].border : 'var(--border)'}`,
                      color: form.type === t ? ACCOUNT_TYPE_COLORS[t].color : 'var(--fg-muted)',
                      fontWeight: form.type === t ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 10 }}>
              {/* Broker with dropdown */}
              <div ref={brokerRef} style={{ position: 'relative' }}>
                <label style={fieldLabel}>Prop Firm / Broker</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text" value={form.broker}
                    onChange={e => { update('broker', e.target.value); setBrokerOpen(true) }}
                    onFocus={() => setBrokerOpen(true)}
                    placeholder="FTMO, Topstep, DAWAS…"
                    style={{ ...inp, paddingRight: 30 }}
                  />
                  <ChevronDown size={12} style={{
                    position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--fg-dim)', pointerEvents: 'none',
                  }} />
                </div>
                {brokerOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, marginTop: 3, overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {BROKERS
                      .filter(b => !form.broker || b.toLowerCase().includes(form.broker.toLowerCase()))
                      .map(b => (
                        <button
                          key={b}
                          onClick={() => { update('broker', b === 'Other' ? '' : b); setBrokerOpen(false) }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '7px 13px',
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
                <input type="text" value={form.currency} onChange={e => update('currency', e.target.value)} placeholder="USD" style={inp} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabel}>Account Opened</label>
                <input
                  type="date" value={form.openedAt}
                  onChange={e => update('openedAt', e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={fieldLabel}>Phase / Step</label>
                <select
                  value={form.phase}
                  onChange={e => update('phase', e.target.value)}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="">—</option>
                  {EVAL_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />

          {/* — Balances — */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <p style={sectionLabel}>Balances</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabel}>Starting Balance</label>
                <input type="number" value={form.startingBalance} onChange={e => update('startingBalance', e.target.value)} placeholder="10000" style={inp} />
              </div>
              <div>
                <label style={fieldLabel}>Current Balance</label>
                <input type="number" value={form.currentBalance} onChange={e => update('currentBalance', e.target.value)} placeholder="10000" style={inp} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />

          {/* — Cost Tracking — */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <p style={sectionLabel}>Cost Tracking</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabel}>{form.type === 'evaluation' ? 'Challenge Fee ($)' : 'Purchase Price ($)'}</label>
                <input type="number" value={form.accountCost} onChange={e => update('accountCost', e.target.value)} placeholder="0.00" style={inp} />
              </div>
              <div>
                <label style={fieldLabel}>Monthly Fee ($)</label>
                <input type="number" value={form.monthlyFee} onChange={e => update('monthlyFee', e.target.value)} placeholder="0.00" style={inp} />
              </div>
            </div>
          </div>

          {/* — Evaluation Parameters — */}
          {form.type === 'evaluation' && (
            <>
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>
                <p style={{ ...sectionLabel, color: 'var(--amber)' }}>Evaluation Rules</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>Profit Target (%)</label>
                    <input type="number" value={form.evalProfitTarget} onChange={e => update('evalProfitTarget', e.target.value)} placeholder="10" style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Max Daily DD (%)</label>
                    <input type="number" value={form.evalMaxDailyDD} onChange={e => update('evalMaxDailyDD', e.target.value)} placeholder="5" style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Max Total DD (%)</label>
                    <input type="number" value={form.evalMaxTotalDD} onChange={e => update('evalMaxTotalDD', e.target.value)} placeholder="10" style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Trading Days</label>
                    <input type="number" value={form.evalTradingDays} onChange={e => update('evalTradingDays', e.target.value)} placeholder="10" style={inp} />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && <p style={{ fontSize: '0.75rem', color: 'var(--red)', margin: '8px 0 0' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, padding: '14px 22px',
          borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button
            onClick={onClose} disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--fg-muted)', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontFamily: 'inherit', opacity: saving ? 0.5 : 1,
              letterSpacing: '-0.01em',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 9999,
              background: 'var(--fg)', border: 'none',
              color: 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1, letterSpacing: '-0.02em',
            }}
          >
            {account ? 'Update Account' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

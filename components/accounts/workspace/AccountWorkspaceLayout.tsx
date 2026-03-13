'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Settings, Edit2 } from 'lucide-react'
import type { Account, Trade } from '@/types'
import AccountEquityChart from './AccountEquityChart'
import AccountMetricCards from './AccountMetricCards'
import AccountBehaviorTab from './AccountBehaviorTab'
import AccountStrategiesTab from './AccountStrategiesTab'
import AccountCard from '../AccountCard'
import AccountForm from '../AccountForm'
import { getAccounts } from '@/lib/firestore/accounts'
import { calcHealthScore, healthScoreColor } from '@/lib/analytics/accountHealth'
import { calcBehavioralSignals } from '@/lib/analytics/behavioralSignals'

type Tab = 'overview' | 'trades' | 'strategies' | 'behavior' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'trades',     label: 'Trades'     },
  { id: 'strategies', label: 'Strategies' },
  { id: 'behavior',   label: 'Behavior'   },
  { id: 'settings',   label: 'Settings'   },
]

const ENV_LABEL: Record<string, string> = {
  live:             'Live',
  demo:             'Demo',
  prop_firm:        'Prop Firm',
  strategy_testing: 'Strategy Testing',
  development:      'Development',
  institutional:    'Institutional',
}

interface Props {
  account:    Account
  uid:        string
  onUpdated:  (a: Account) => void
}

export default function AccountWorkspaceLayout({ account, uid, onUpdated }: Props) {
  const router = useRouter()
  const [tab,       setTab]       = useState<Tab>('overview')
  const [trades,    setTrades]    = useState<Trade[]>([])
  const [showEdit,  setShowEdit]  = useState(false)

  // Load trades for this account
  useEffect(() => {
    // Trades come from the trades subcollection — skipping full fetch for now;
    // trades will be populated when the trades system wires accountId filtering.
    // For now we use an empty array so charts render correctly.
    setTrades([])
  }, [account.id])

  const health   = calcHealthScore(account, trades)
  const envLabel = account.environment ? (ENV_LABEL[account.environment] ?? account.environment) : account.type

  // Contextual behavioral descriptor for header
  const contextDesc = useMemo(() => {
    if (trades.length < 3) return null
    const signals = calcBehavioralSignals(account, trades)
    const critical = signals.filter(s => s.severity === 'critical').length
    const warning  = signals.filter(s => s.severity === 'warning').length
    if (critical >= 2) return 'Emotionally volatile account.'
    if (critical >= 1) return 'Recovery-driven trading.'
    if (warning >= 2)  return 'Behavioral pressure building.'
    if (warning === 0 && signals.length >= 3) return 'Highly disciplined environment.'
    return 'Developing discipline.'
  }, [account, trades])

  return (
    <div style={{ maxWidth: 860, animation: 'wsIn 0.28s ease both' }}>
      <style>{`
        @keyframes wsIn {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0)   }
        }
      `}</style>

      {/* ── Back + Header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/dashboard/accounts')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0 0 14px', color: 'var(--fg-muted)', fontSize: '0.75rem',
            fontFamily: 'inherit', letterSpacing: '-0.01em',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-muted)' }}
        >
          <ArrowLeft size={13} />
          Accounts
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: 'var(--fg-xdim)',
              }}>
                {envLabel}
              </span>
              {account.marketType && (
                <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)' }}>·</span>
              )}
              {account.marketType && (
                <span style={{ fontSize: '0.5625rem', color: 'var(--fg-xdim)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {account.marketType}
                </span>
              )}
            </div>
            <h1 style={{
              margin: 0, fontSize: '1.625rem', fontWeight: 700,
              color: 'var(--fg)', letterSpacing: '-0.05em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {account.name}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
              {account.broker && `${account.broker} · `}
              {account.currency} {account.startingBalance?.toLocaleString()}
              {account.phase && ` · ${account.phase}`}
            </p>
            {contextDesc && (
              <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: 'var(--fg-xdim)', letterSpacing: '-0.01em', fontStyle: 'italic' }}>
                {contextDesc}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Health score */}
            {health && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${healthScoreColor(health.score)}18`,
                  border: `2px solid ${healthScoreColor(health.score)}40`,
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: healthScoreColor(health.score), letterSpacing: '-0.03em' }}>
                    {health.score}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.5625rem', color: 'var(--fg-xdim)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {health.label}
                </p>
              </div>
            )}

            {/* Edit button */}
            <button
              onClick={() => setShowEdit(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 9,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--fg-muted)', cursor: 'pointer',
                fontSize: '0.75rem', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <Edit2 size={12} />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <AccountMetricCards account={account} trades={trades} />
      </div>

      {/* ── Equity chart ─────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <AccountEquityChart account={account} trades={trades} />
      </div>

      {/* ── Tab navigation ────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        marginBottom: 24,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.8125rem', fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--fg)' : 'var(--fg-muted)',
              letterSpacing: '-0.01em', flexShrink: 0,
              borderBottom: tab === t.id ? '2px solid var(--fg)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.12s, border-color 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ animation: 'wsIn 0.20s ease both' }}>
          <AccountCard
            account={account}
            onEdit={() => setShowEdit(true)}
            onDelete={() => {}}
            onUpdated={onUpdated}
          />
        </div>
      )}

      {tab === 'trades' && (
        <div style={{ animation: 'wsIn 0.20s ease both' }}>
          <TradesPlaceholder />
        </div>
      )}

      {tab === 'strategies' && (
        <div style={{ animation: 'wsIn 0.20s ease both' }}>
          <AccountStrategiesTab account={account} trades={trades} />
        </div>
      )}

      {tab === 'behavior' && (
        <div style={{ animation: 'wsIn 0.20s ease both' }}>
          <AccountBehaviorTab account={account} trades={trades} />
        </div>
      )}

      {tab === 'settings' && (
        <div style={{ animation: 'wsIn 0.20s ease both' }}>
          <SettingsPanel account={account} onEdit={() => setShowEdit(true)} />
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <AccountForm
          account={account}
          uid={uid}
          onSave={updated => { onUpdated(updated); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}

// ── Placeholder: Trades tab ────────────────────────────────────────────────────
function TradesPlaceholder() {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center',
      background: 'var(--bg-card)', borderRadius: 14,
      border: '1px dashed var(--border)',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
        Trades
      </p>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
        Trade log is available on the Trades page. Filter by this account to see all entries.
      </p>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────────
function SettingsPanel({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const rows: [string, string][] = [
    ['Name',          account.name],
    ['Broker',        account.broker ?? '—'],
    ['Type',          account.type],
    ['Environment',   account.environment ?? '—'],
    ['Market',        account.marketType ?? '—'],
    ['Currency',      account.currency],
    ['Trading Style', account.tradingStyle ?? '—'],
    ['Risk Model',    account.riskModel ?? '—'],
    ['Starting Bal.', `$${account.startingBalance?.toLocaleString() ?? 0}`],
    ['Current Bal.',  `$${account.currentBalance?.toLocaleString() ?? 0}`],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {rows.map(([label, val], i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center',
            padding: '11px 16px',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{label}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em', textTransform: 'capitalize' }}>
              {val}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onEdit}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
          padding: '9px 18px', borderRadius: 9,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: 'var(--fg-muted)', cursor: 'pointer',
          fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 500,
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <Settings size={13} />
        Edit Account Settings
      </button>
    </div>
  )
}

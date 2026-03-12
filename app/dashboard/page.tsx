'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, LayoutGrid, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'
import { useAccount } from '@/lib/account-context'
import { getTrades, addTrade } from '@/lib/firestore/trades'
import type { Trade } from '@/types'
import TradeForm from '@/components/trades/TradeForm'
import StatsWidget          from '@/components/dashboard/widgets/StatsWidget'
import CalendarWidget       from '@/components/dashboard/widgets/CalendarWidget'
import RecentTradesWidget   from '@/components/dashboard/widgets/RecentTradesWidget'
import BehavioralDNAWidget  from '@/components/dashboard/widgets/BehavioralDNAWidget'
import MomentumScoreWidget  from '@/components/dashboard/widgets/MomentumScoreWidget'
import AccountHealthWidget  from '@/components/dashboard/widgets/AccountHealthWidget'

// ── Widget registry ────────────────────────────────────────────────────────
type WidgetId = 'stats' | 'dna' | 'momentum' | 'health' | 'calendar' | 'recent'

interface WidgetDef {
  id: WidgetId
  label: string
  description: string
  fundedOnly?: boolean
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: 'stats',    label: 'Statistics',        description: 'Net P&L, win rate, avg R, trade count' },
  { id: 'dna',      label: 'Behavioral DNA',    description: '3D trait analysis — patience, discipline, resilience and more' },
  { id: 'momentum', label: 'Momentum Score',    description: 'Daily trading readiness score (0–100)' },
  { id: 'health',   label: 'Account Health',    description: 'Drawdown, profit target, daily limits', fundedOnly: true },
  { id: 'calendar', label: 'Calendar',          description: 'Monthly P&L calendar with day drill-down' },
  { id: 'recent',   label: 'Recent Trades',     description: 'Latest trades at a glance' },
]

const DEFAULT_ORDER:   WidgetId[] = ['stats', 'momentum', 'health', 'calendar', 'dna', 'recent']
const DEFAULT_VISIBLE: WidgetId[] = ['stats', 'momentum', 'health', 'calendar', 'dna', 'recent']
const STORAGE_KEY = 'daules-widget-layout-v2'

interface WidgetLayout { order: WidgetId[]; visible: WidgetId[] }

function loadLayout(): WidgetLayout {
  if (typeof window === 'undefined') return { order: DEFAULT_ORDER, visible: DEFAULT_VISIBLE }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetLayout
      // Merge: add any new widget IDs from DEFAULT_ORDER that aren't in stored layout
      const mergedOrder = [
        ...parsed.order,
        ...DEFAULT_ORDER.filter(id => !parsed.order.includes(id)),
      ]
      const mergedVisible = [
        ...parsed.visible,
        ...DEFAULT_VISIBLE.filter(id => !parsed.visible.includes(id) && !parsed.order.includes(id)),
      ]
      return { order: mergedOrder, visible: mergedVisible }
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, visible: DEFAULT_VISIBLE }
}

function saveLayout(layout: WidgetLayout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)) } catch { /* ignore */ }
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { selectedAccount, accounts, user } = useAccount()
  const [trades,   setTrades]   = useState<Trade[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [logTradeDate,  setLogTradeDate]  = useState<string | undefined>()
  const [showMgr,       setShowMgr]       = useState(false)
  const [layout,   setLayout]   = useState<WidgetLayout>({ order: DEFAULT_ORDER, visible: DEFAULT_VISIBLE })

  useEffect(() => { setLayout(loadLayout()) }, [])

  useEffect(() => {
    if (!user || !selectedAccount) { setLoading(false); return }
    setLoading(true)
    getTrades(user.uid, selectedAccount.id)
      .then(setTrades).catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [user, selectedAccount])

  const handleAddTrade = async (data: Omit<Trade, 'id'>, accountIds: string[]) => {
    if (!user) return
    const results = await Promise.allSettled(
      accountIds.map(aid => addTrade(user.uid, aid, { ...data, accountId: aid }))
    )
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && accountIds[i] === selectedAccount?.id) {
        setTrades(prev => [r.value, ...prev])
      }
    })
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) throw new Error(`Failed to save to ${failed} account(s)`)
  }

  const updateLayout = useCallback((next: WidgetLayout) => {
    setLayout(next)
    saveLayout(next)
  }, [])

  const toggleVisible = (id: WidgetId) => {
    const next = layout.visible.includes(id)
      ? layout.visible.filter(v => v !== id)
      : [...layout.visible, id]
    updateLayout({ ...layout, visible: next })
  }

  const moveWidget = (id: WidgetId, dir: -1 | 1) => {
    const order = [...layout.order]
    const idx   = order.indexOf(id)
    const swap  = idx + dir
    if (swap < 0 || swap >= order.length) return
    ;[order[idx], order[swap]] = [order[swap], order[idx]]
    updateLayout({ ...layout, order })
  }

  const isFunded = selectedAccount?.type === 'funded' || selectedAccount?.type === 'evaluation'

  const visibleOrdered = layout.order.filter(id => {
    if (!layout.visible.includes(id)) return false
    const def = WIDGET_DEFS.find(d => d.id === id)
    if (def?.fundedOnly && !isFunded) return false
    return true
  })

  // Filter defs shown in manager (hide fundedOnly if not funded)
  const managerDefs = WIDGET_DEFS.filter(d => !d.fundedOnly || isFunded)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 980 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--fg)' }}>
            Overview
          </h1>
          {selectedAccount && (
            <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
              {selectedAccount.name} · {selectedAccount.broker}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowMgr(m => !m)}
            className="btn-press"
            title="Manage widgets"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8,
              background: showMgr ? 'var(--nav-active-bg)' : 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--fg-muted)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.8125rem', fontWeight: 400,
              transition: 'background var(--dur-fast) var(--ease-out)',
            }}
          >
            <LayoutGrid size={13} />
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="btn-press"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: 'var(--fg)', color: 'var(--bg)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em',
            }}
          >
            <Plus size={13} />
            Log trade
          </button>
        </div>
      </div>

      {/* Widget manager panel */}
      {showMgr && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          animation: 'widgetIn 0.22s var(--ease-out) both',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
              Widgets
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
              Show, hide or reorder your overview panels
            </p>
          </div>
          <div style={{ padding: '8px 4px' }}>
            {layout.order.filter(id => managerDefs.some(d => d.id === id)).map((id, i) => {
              const def     = managerDefs.find(d => d.id === id)!
              const visible = layout.visible.includes(id)
              const orderIdx = layout.order.indexOf(id)
              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', borderRadius: 8,
                  opacity: visible ? 1 : 0.45,
                  transition: 'opacity var(--dur-med) var(--ease-out)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                      {def.label}
                      {def.fundedOnly && (
                        <span style={{ marginLeft: 6, fontSize: '0.625rem', padding: '1px 6px', borderRadius: 999, background: 'var(--amber-bg)', color: 'var(--amber)', letterSpacing: '0.04em' }}>
                          FUNDED
                        </span>
                      )}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: '0.6875rem', color: 'var(--fg-dim)' }}>
                      {def.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <MgrBtn onClick={() => moveWidget(id, -1)} disabled={orderIdx === 0} title="Move up">
                      <ChevronUp size={12} />
                    </MgrBtn>
                    <MgrBtn onClick={() => moveWidget(id, 1)} disabled={orderIdx === layout.order.length - 1} title="Move down">
                      <ChevronDown size={12} />
                    </MgrBtn>
                    <MgrBtn onClick={() => toggleVisible(id)} title={visible ? 'Hide' : 'Show'}>
                      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </MgrBtn>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Widget stack */}
      {visibleOrdered.map((id, i) => (
        <div key={id} className="widget-enter" style={{ animationDelay: `${i * 0.06}s` }}>
          {id === 'stats'    && <StatsWidget trades={trades} />}
          {id === 'dna'      && <BehavioralDNAWidget trades={trades} />}
          {id === 'momentum' && <MomentumScoreWidget trades={trades} />}
          {id === 'health'   && selectedAccount?.evaluation && (
            <AccountHealthWidget account={selectedAccount} trades={trades} />
          )}
          {id === 'calendar' && <CalendarWidget trades={trades} onLogTrade={(date?: Date) => { setLogTradeDate(date ? format(date, 'yyyy-MM-dd') : undefined); setShowForm(true) }} />}
          {id === 'recent'   && (
            <RecentTradesWidget
              trades={trades}
              loading={loading}
              onLogTrade={() => setShowForm(true)}
            />
          )}
        </div>
      ))}

      {/* Trade form modal */}
      {showForm && user && (
        <TradeForm
          accounts={accounts}
          defaultAccountId={selectedAccount?.id ?? null}
          uid={user.uid}
          initialDate={logTradeDate}
          onSave={handleAddTrade}
          onClose={() => { setShowForm(false); setLogTradeDate(undefined) }}
        />
      )}
    </div>
  )
}

// ── Widget manager button ──────────────────────────────────────────────────
function MgrBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="btn-press"
      style={{
        width: 28, height: 28, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov && !disabled ? 'var(--nav-active-bg)' : 'transparent',
        border: '1px solid var(--border)',
        color: disabled ? 'var(--fg-xdim)' : 'var(--fg-muted)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}
    >
      {children}
    </button>
  )
}

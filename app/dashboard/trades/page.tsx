'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, Edit2 } from 'lucide-react'
import { useAccount } from '@/lib/account-context'
import { getTrades, addTrade, updateTrade, deleteTrade } from '@/lib/firestore/trades'
import type { Trade } from '@/types'
import TradeForm from '@/components/trades/TradeForm'
import { format } from 'date-fns'
import DirectionBadge from '@/components/ui/DirectionBadge'

type SortKey = 'date' | 'symbol' | 'pnl' | 'rMultiple'
type SortDir = 'asc' | 'desc'

export default function TradesPage() {
  const { selectedAccount, accounts, user } = useAccount()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'long' | 'short'>('all')
  const [setupFilter, setSetupFilter] = useState('')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    if (!user || !selectedAccount) {
      setLoading(false)
      return
    }
    setLoading(true)
    getTrades(user.uid, selectedAccount.id)
      .then(setTrades)
      .catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [user, selectedAccount])

  const filteredTrades = useMemo(() => {
    let result = [...trades]
    if (dateFrom) result = result.filter((t) => t.date >= dateFrom)
    if (dateTo) result = result.filter((t) => t.date <= dateTo)
    if (directionFilter !== 'all') result = result.filter((t) => t.direction === directionFilter)
    if (setupFilter) {
      result = result.filter((t) =>
        t.setup.some((s) => s.toLowerCase().includes(setupFilter.toLowerCase()))
      )
    }
    result.sort((a, b) => {
      let aVal: string | number = a[sortKey]
      let bVal: string | number = b[sortKey]
      if (sortKey === 'date') {
        aVal = new Date(a.date).getTime()
        bVal = new Date(b.date).getTime()
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return result
  }, [trades, dateFrom, dateTo, directionFilter, setupFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown size={12} style={{ opacity: 0.3 }} />
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
  }

  const handleAddTrade = async (tradeData: Omit<Trade, 'id'>, accountIds: string[]) => {
    if (!user || !selectedAccount) return
    const newTrade = await addTrade(user.uid, accountIds[0] ?? selectedAccount.id, tradeData)
    setTrades([newTrade, ...trades])
  }

  const handleUpdateTrade = async (tradeData: Omit<Trade, 'id'>, _accountIds: string[]) => {
    if (!user || !selectedAccount || !editingTrade) return
    await updateTrade(user.uid, selectedAccount.id, editingTrade.id, tradeData)
    setTrades(
      trades.map((t) =>
        t.id === editingTrade.id ? { ...tradeData, id: editingTrade.id } : t
      )
    )
    setEditingTrade(null)
  }

  const handleDelete = async (tradeId: string) => {
    if (!user || !selectedAccount) return
    await deleteTrade(user.uid, selectedAccount.id, tradeId)
    setTrades(trades.filter((t) => t.id !== tradeId))
    setDeleteConfirm(null)
  }

  const inputStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    outline: 'none',
    colorScheme: 'dark' as const,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
          Trade Log
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--fg)', color: 'var(--bg)', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em' }}
        >
          <Plus size={16} />
          New Trade
        </button>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap gap-3 p-4 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'long', 'short'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirectionFilter(d)}
              className="px-3 py-1.5 rounded-lg text-xs capitalize"
              style={{
                background: directionFilter === d ? 'var(--bg-sub)' : 'transparent',
                border: `1px solid ${directionFilter === d ? 'var(--border)' : 'var(--border)'}`,
                color: directionFilter === d ? 'var(--fg)' : 'var(--fg-muted)',
                fontWeight: directionFilter === d ? 500 : undefined,
                cursor: 'pointer',
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={setupFilter}
          onChange={(e) => setSetupFilter(e.target.value)}
          placeholder="Filter by setup..."
          style={{ ...inputStyle, minWidth: '160px' }}
        />
        {(dateFrom || dateTo || directionFilter !== 'all' || setupFilter) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setDirectionFilter('all')
              setSetupFilter('')
            }}
            className="text-xs"
            style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {loading ? (
          <div className="p-8 text-center">
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin mx-auto"
              style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--fg)' }}>
              No trades found
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
              {trades.length === 0
                ? 'Add your first trade to get started'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Date', key: 'date' as SortKey },
                    { label: 'Symbol', key: 'symbol' as SortKey },
                    { label: 'Direction', key: null },
                    { label: 'Setup', key: null },
                    { label: 'P&L', key: 'pnl' as SortKey },
                    { label: 'R', key: 'rMultiple' as SortKey },
                    { label: '', key: null },
                  ].map(({ label, key }) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-xs font-medium tracking-tight"
                      style={{
                        color: 'var(--fg-muted)',
                        cursor: key ? 'pointer' : 'default',
                      }}
                      onClick={() => key && toggleSort(key)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && <SortIcon k={key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade, i) => (
                  <>
                    <tr
                      key={trade.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() =>
                        setExpandedRow(expandedRow === trade.id ? null : trade.id)
                      }
                    >
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {(() => {
                          try {
                            return format(new Date(trade.date), 'MMM d, yyyy')
                          } catch {
                            return trade.date
                          }
                        })()}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-medium"
                        style={{ color: 'var(--fg)' }}
                      >
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <DirectionBadge direction={trade.direction} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {trade.setup.slice(0, 2).map((s) => (
                            <span
                              key={s}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                background: 'var(--bg-sub)',
                                color: 'var(--fg-muted)',
                              }}
                            >
                              {s}
                            </span>
                          ))}
                          {trade.setup.length > 2 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ color: 'var(--fg-muted)' }}
                            >
                              +{trade.setup.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-semibold"
                        style={{
                          color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{
                          color: trade.rMultiple >= 0 ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        {trade.rMultiple >= 0 ? '+' : ''}
                        {trade.rMultiple.toFixed(2)}R
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditingTrade(trade)
                              setShowForm(true)
                            }}
                            style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          {deleteConfirm === trade.id ? (
                            <button
                              onClick={() => handleDelete(trade.id)}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', cursor: 'pointer' }}
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(trade.id)}
                              style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedRow === trade.id && (
                      <tr
                        key={`${trade.id}-expanded`}
                        style={{ background: 'var(--bg-sub)' }}
                      >
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                            {[
                              { label: 'Entry', value: trade.entry.toFixed(5) },
                              { label: 'Exit', value: trade.exit.toFixed(5) },
                              { label: 'Stop Loss', value: trade.stopLoss.toFixed(5) },
                              { label: 'Take Profit', value: trade.takeProfit.toFixed(5) },
                              { label: 'Position Size', value: trade.positionSize.toString() },
                              { label: 'Session', value: trade.session },
                              {
                                label: 'Mistakes',
                                value: trade.mistakes.join(', ') || 'None',
                              },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <p
                                  className="text-xs"
                                  style={{ color: 'var(--fg-muted)' }}
                                >
                                  {label}
                                </p>
                                <p
                                  className="text-xs font-medium mt-0.5"
                                  style={{ color: 'var(--fg)' }}
                                >
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                          {trade.notes && (
                            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                              {trade.notes}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && user && (
        <TradeForm
          trade={editingTrade}
          accounts={accounts}
          defaultAccountId={selectedAccount?.id ?? null}
          uid={user.uid}
          onSave={editingTrade ? handleUpdateTrade : handleAddTrade}
          onClose={() => {
            setShowForm(false)
            setEditingTrade(null)
          }}
        />
      )}
    </div>
  )
}

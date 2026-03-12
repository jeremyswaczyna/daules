'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { useAccount } from '@/lib/account-context'
import { getTrades } from '@/lib/firestore/trades'
import { getSetups, addSetup, updateSetup, deleteSetup } from '@/lib/firestore/setups'
import type { Trade, Setup } from '@/types'
import { calcWinRate } from '@/lib/calculations'

interface SetupWithStats extends Setup {
  winRate: number
  tradeCount: number
}

function SetupCard({
  setup,
  onEdit,
  onDelete,
}: {
  setup: SetupWithStats
  onEdit: (s: Setup) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm tracking-tight" style={{ color: 'var(--fg)' }}>
            {setup.name}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
            {setup.description}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
          <span
            className="px-2 py-1 rounded-lg text-xs font-medium"
            style={{
              background: setup.winRate >= 50 ? 'var(--green-bg)' : 'var(--red-bg)',
              color: setup.winRate >= 50 ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${setup.winRate >= 50 ? 'var(--green-bd)' : 'var(--red-bd)'}`,
            }}
          >
            {setup.tradeCount > 0 ? `${setup.winRate.toFixed(0)}% WR` : 'No trades'}
          </span>
        </div>
      </div>

      {setup.rules.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--fg-muted)' }}>
            Rules
          </p>
          <ul className="space-y-1">
            {setup.rules.map((rule, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--fg)' }}>
                <span style={{ color: 'var(--fg-xdim)' }}>•</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      )}

      {setup.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {setup.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-xs"
              style={{ background: 'var(--bg-sub)', color: 'var(--fg-muted)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between pt-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          {setup.tradeCount} trade{setup.tradeCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(setup)}
            style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Edit2 size={13} />
          </button>
          {confirmDelete ? (
            <button
              onClick={() => onDelete(setup.id)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', cursor: 'pointer' }}
            >
              Delete
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface SetupFormData {
  name: string
  description: string
  rules: string[]
  tags: string[]
  newRule: string
  newTag: string
}

function SetupModal({
  setup,
  onSave,
  onClose,
}: {
  setup?: Setup | null
  onSave: (data: Omit<Setup, 'id' | 'uid' | 'createdAt'>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<SetupFormData>({
    name: setup?.name ?? '',
    description: setup?.description ?? '',
    rules: setup?.rules ?? [],
    tags: setup?.tags ?? [],
    newRule: '',
    newTag: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field: keyof SetupFormData, value: string | string[]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const addRule = () => {
    const trimmed = form.newRule.trim()
    if (trimmed) {
      update('rules', [...form.rules, trimmed])
      update('newRule', '')
    }
  }

  const removeRule = (i: number) =>
    update('rules', form.rules.filter((_, idx) => idx !== i))

  const addTag = () => {
    const trimmed = form.newTag.trim()
    if (trimmed && !form.tags.includes(trimmed)) {
      update('tags', [...form.tags, trimmed])
      update('newTag', '')
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules,
        tags: form.tags,
      })
      onClose()
    } catch {
      setError('Failed to save setup')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-sub)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '80vh' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>
            {setup ? 'Edit Setup' : 'New Setup'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--fg-muted)' }}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Breakout Pullback"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--fg-muted)' }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Describe your setup..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>Rules</label>
            <div className="space-y-2 mb-2">
              {form.rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="flex-1 text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-sub)', color: 'var(--fg)', border: '1px solid var(--border)' }}
                  >
                    {rule}
                  </span>
                  <button
                    onClick={() => removeRule(i)}
                    style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.newRule}
                onChange={(e) => update('newRule', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRule()}
                placeholder="Add a rule..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addRule}
                className="px-3 py-2 rounded-lg"
                style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', cursor: 'pointer' }}
              >
                <Check size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => update('tags', form.tags.filter((t) => t !== tag))}
                  className="px-2 py-0.5 rounded text-xs flex items-center gap-1"
                  style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  {tag} <X size={10} />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.newTag}
                onChange={(e) => update('newTag', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a tag..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addTag}
                className="px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-sub)', border: '1px solid var(--border)', color: 'var(--fg-muted)', cursor: 'pointer' }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        </div>

        <div
          className="flex gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm"
            style={{ background: 'var(--bg-sub)', border: '1px solid var(--border)', color: 'var(--fg-muted)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium"
            style={{ background: 'var(--fg)', color: 'var(--bg)', borderRadius: 9999, border: 'none', opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Setup'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlaybookPage() {
  const { user, selectedAccount } = useAccount()
  const [setups, setSetups] = useState<Setup[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSetup, setEditingSetup] = useState<Setup | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const fetchData = async () => {
      try {
        const [setupData, tradeData] = await Promise.all([
          getSetups(user.uid),
          selectedAccount ? getTrades(user.uid, selectedAccount.id) : Promise.resolve([]),
        ])
        setSetups(setupData)
        setTrades(tradeData)
      } catch {
        setSetups([])
        setTrades([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user, selectedAccount])

  const setupsWithStats: SetupWithStats[] = setups.map((setup) => {
    const relatedTrades = trades.filter((t) => t.setup.includes(setup.name))
    return {
      ...setup,
      winRate: calcWinRate(relatedTrades),
      tradeCount: relatedTrades.length,
    }
  })

  const handleSaveSetup = async (
    data: Omit<Setup, 'id' | 'uid' | 'createdAt'>
  ) => {
    if (!user) return
    if (editingSetup) {
      await updateSetup(user.uid, editingSetup.id, data)
      setSetups(setups.map((s) => (s.id === editingSetup.id ? { ...s, ...data } : s)))
    } else {
      const newSetup = await addSetup(user.uid, {
        ...data,
        uid: user.uid,
        createdAt: new Date().toISOString(),
      })
      setSetups([...setups, newSetup])
    }
    setEditingSetup(null)
  }

  const handleDeleteSetup = async (id: string) => {
    if (!user) return
    await deleteSetup(user.uid, id)
    setSetups(setups.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
          Playbook
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--fg)', color: 'var(--bg)', borderRadius: 9999, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={16} />
          Add Setup
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      ) : setupsWithStats.length === 0 ? (
        <div
          className="rounded-xl p-16 flex flex-col items-center justify-center gap-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
            No setups yet
          </p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--fg-muted)' }}>
            Document your trading setups to track which ones work best
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--fg)', color: 'var(--bg)', borderRadius: 9999, border: 'none', cursor: 'pointer' }}
          >
            <Plus size={14} />
            Add Setup
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {setupsWithStats.map((setup) => (
            <SetupCard
              key={setup.id}
              setup={setup}
              onEdit={(s) => {
                setEditingSetup(s)
                setShowModal(true)
              }}
              onDelete={handleDeleteSetup}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SetupModal
          setup={editingSetup}
          onSave={handleSaveSetup}
          onClose={() => {
            setShowModal(false)
            setEditingSetup(null)
          }}
        />
      )}
    </div>
  )
}

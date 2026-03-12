'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAccount } from '@/lib/account-context'
import { getTrades } from '@/lib/firestore/trades'
import type { Trade } from '@/types'
import { Download, LogOut, SlidersHorizontal } from 'lucide-react'
import ProfilePictureUpload from '@/components/settings/ProfilePictureUpload'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

function exportTradesToCSV(trades: Trade[]) {
  const headers = [
    'Date', 'Symbol', 'Direction', 'Entry', 'Exit', 'Stop Loss',
    'Take Profit', 'Position Size', 'P&L', 'R Multiple', 'Setup',
    'Mistakes', 'Session', 'Notes',
  ]
  const rows = trades.map(t => [
    t.date, t.symbol, t.direction, t.entry, t.exit, t.stopLoss,
    t.takeProfit, t.positionSize, t.pnl, t.rMultiple,
    t.setup.join('; '), t.mistakes.join('; '), t.session, t.notes,
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daules-trades-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, accounts } = useAccount()
  const [displayName,       setDisplayName]       = useState('')
  const [savingProfile,     setSavingProfile]     = useState(false)
  const [exporting,         setExporting]         = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  useEffect(() => { if (user) setDisplayName(user.displayName ?? '') }, [user])

  const handleSaveProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    try {
      await updateProfile(user, { displayName: displayName.trim() })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleExport = async () => {
    if (!user) return
    setExporting(true)
    try {
      const allTrades: Trade[] = []
      for (const account of accounts) {
        const trades = await getTrades(user.uid, account.id)
        allTrades.push(...trades)
      }
      exportTradesToCSV(allTrades)
    } finally {
      setExporting(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/signin')
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'hidden',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-sub)', border: '1px solid var(--border)',
    color: 'var(--fg)', borderRadius: 8, padding: '8px 12px',
    fontSize: 14, width: '100%', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-sub)', border: '1px solid var(--border)' }}
        >
          <SlidersHorizontal size={14} style={{ color: 'var(--fg-muted)' }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
          Settings
        </h1>
      </div>

      {/* ── Profile ─────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Profile</p>
        </div>
        <div className="px-5 py-5 space-y-5">
          {user && (
            <ProfilePictureUpload
              user={user}
              onUpdated={() => {/* photoURL updated via Firebase Auth */}}
            />
          )}
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--fg-muted)' }}>Display Name</label>
            <input
              type="text" value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name" style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--fg-muted)' }}>Email</label>
            <input
              type="email" value={user?.email ?? ''} disabled
              style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
            />
          </div>
          <button
            onClick={handleSaveProfile} disabled={savingProfile}
            className="px-4 py-2 text-sm font-medium"
            style={{
              background: 'var(--fg)', color: 'var(--bg)', borderRadius: 9999, border: 'none',
              opacity: savingProfile ? 0.7 : 1, cursor: savingProfile ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* ── Data ────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Data</p>
        </div>
        <div className="px-5 py-5">
          <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>
            Export all your trades as a CSV file
          </p>
          <button
            onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--bg-sub)', border: '1px solid var(--border)',
              color: 'var(--fg)', opacity: exporting ? 0.7 : 1,
              cursor: exporting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : 'Export Trades as CSV'}
          </button>
        </div>
      </div>

      {/* ── Sign out ────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div className="px-5 py-5">
          <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>
            Sign out of your Daules account
          </p>
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--red-bg)', border: '1px solid var(--red-bd)',
              color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>

      {showSignOutConfirm && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need to sign back in to access your journal."
          confirmLabel="Sign out"
          variant="destructive"
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}
    </div>
  )
}

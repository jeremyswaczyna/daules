'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, Check, Layers, Sun, Moon } from 'lucide-react'
import type { Account } from '@/types'
import type { User } from 'firebase/auth'
import DaulesLogo from '@/components/ui/DaulesLogo'

interface Props {
  user: User
  selectedAccount: Account | null
  accounts: Account[]
  onSelectAccount: (a: Account | null) => void
  cumulative: boolean
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function SidebarHeader({
  user, selectedAccount, accounts, onSelectAccount, cumulative, theme, onToggleTheme,
}: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })

  const initial     = (user.displayName ?? user.email ?? 'U').charAt(0).toUpperCase()
  const photoURL    = user.photoURL
  const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'User'
  const accountLabel = cumulative ? 'All Accounts' : (selectedAccount?.name ?? 'Select account')

  const openDrop = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ padding: '14px 10px 10px', borderBottom: '1px solid var(--border)' }}>

      {/* Logo row — clickable home link + theme toggle */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '2px 4px', marginBottom: 14,
      }}>
        <Link
          href="/dashboard"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            textDecoration: 'none', flex: 1,
            borderRadius: 6, padding: '2px 4px', margin: '-2px -4px',
            transition: 'background 0.12s',
          }}
          title="Dashboard home"
        >
          <DaulesLogo size={22} color="var(--fg)" />
          <span style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: '1.1875rem', fontWeight: 500,
            letterSpacing: '-0.01em', color: 'var(--fg)',
            lineHeight: 1, userSelect: 'none',
          }}>
            Daules
          </span>
        </Link>

        {/* Theme toggle — compact, right of logo */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
            background: 'transparent', border: 'none',
            color: 'var(--fg-dim)', cursor: 'pointer',
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--nav-hover-bg)'; e.currentTarget.style.color = 'var(--fg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-dim)' }}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 12, marginLeft: 4, marginRight: 4 }} />

      {/* User row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 4px', marginBottom: 12 }}>
        {photoURL ? (
          <img src={photoURL} alt={displayName}
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 600, color: 'var(--bg)', flexShrink: 0,
          }}>{initial}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)', marginTop: 1 }}>{user.email}</div>
        </div>
      </div>

      {/* Account selector button */}
      <button
        ref={btnRef}
        onClick={open ? () => setOpen(false) : openDrop}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 8px',
          background: open ? 'var(--nav-active-bg)' : 'transparent',
          border: '1px solid var(--border)', borderRadius: 7,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--nav-hover-bg)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 5,
          background: 'var(--bg-sub)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {cumulative
            ? <Layers size={9} style={{ color: 'var(--fg-muted)' }} />
            : <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--fg-muted)' }}>
                {selectedAccount?.name.charAt(0).toUpperCase() ?? '—'}
              </span>
          }
        </div>
        <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--fg)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {accountLabel}
        </span>
        <ChevronDown size={11} style={{ color: 'var(--fg-dim)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s var(--ease)' }} />
      </button>

      {/* Fixed-position dropdown */}
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: 'var(--shadow-md)', overflow: 'hidden', zIndex: 999, padding: 4,
          }}>
            {accounts.map(acc => (
              <DropItem key={acc.id} label={acc.name} sub={acc.type}
                active={!cumulative && selectedAccount?.id === acc.id}
                onClick={() => { onSelectAccount(acc); setOpen(false) }} />
            ))}
            {accounts.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />}
            <DropItem label="All Accounts" sub="cumulative view" active={cumulative}
              icon={<Layers size={11} />}
              onClick={() => { onSelectAccount(null); setOpen(false) }} />
            {accounts.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--fg-dim)' }}>
                No accounts — add one in Settings
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function DropItem({ label, sub, active, icon, onClick }: {
  label: string; sub: string; active: boolean; icon?: React.ReactNode; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 8px', borderRadius: 6,
        background: hov || active ? 'var(--nav-active-bg)' : 'transparent',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
      }}>
      {icon && <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--fg)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)', textTransform: 'capitalize' }}>{sub}</div>
      </div>
      {active && <Check size={12} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />}
    </button>
  )
}

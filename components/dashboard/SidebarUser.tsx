'use client'

import type { User } from 'firebase/auth'

interface Props {
  user: User
  onSignOut: () => void
}

export default function SidebarUser({ onSignOut }: Props) {
  return (
    <div style={{
      padding: '8px 6px 10px',
      borderTop: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <button
        onClick={onSignOut}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', borderRadius: 6,
          background: 'transparent', border: 'none',
          color: 'var(--fg-muted)', cursor: 'pointer',
          fontSize: '0.8125rem', letterSpacing: '-0.01em',
          fontFamily: 'inherit',
          transition: 'background 0.1s, color 0.1s',
          width: '100%', textAlign: 'left',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--nav-hover-bg)'; e.currentTarget.style.color = 'var(--fg)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-muted)' }}
      >
        Sign out
      </button>
    </div>
  )
}

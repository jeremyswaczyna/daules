'use client'

import { Menu } from 'lucide-react'

interface Props {
  onOpenSidebar: () => void
  pageTitle?: string
}

export default function TopBar({ onOpenSidebar, pageTitle }: Props) {
  return (
    <header
      className="lg:hidden"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onOpenSidebar}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 7,
          background: 'var(--bg-sub)', border: '1px solid var(--border)',
          color: 'var(--fg-muted)', cursor: 'pointer',
        }}
      >
        <Menu size={15} />
      </button>
      {pageTitle && (
        <span style={{ fontSize: '0.9375rem', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          {pageTitle}
        </span>
      )}
    </header>
  )
}

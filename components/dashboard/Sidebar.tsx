'use client'

import SidebarHeader from './SidebarHeader'
import SidebarNav from './SidebarNav'
import SidebarUser from './SidebarUser'
import type { Account } from '@/types'
import type { User } from 'firebase/auth'

interface Props {
  user: User
  accounts: Account[]
  selectedAccount: Account | null
  onSelectAccount: (a: Account | null) => void
  cumulative: boolean
  pathname: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onSignOut: () => void
  open: boolean
  onClose: () => void
}

export default function Sidebar(props: Props) {
  const { open, onClose } = props

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div onClick={onClose} className="lg:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)' }} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col lg:relative lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: 240, minWidth: 240,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          transition: 'transform 0.2s var(--ease)',
        }}
      >
        <SidebarHeader
          user={props.user}
          selectedAccount={props.selectedAccount}
          accounts={props.accounts}
          onSelectAccount={props.onSelectAccount}
          cumulative={props.cumulative}
          theme={props.theme}
          onToggleTheme={props.onToggleTheme}
        />
        <SidebarNav pathname={props.pathname} onNavigate={onClose} />
        <SidebarUser
          user={props.user}
          onSignOut={props.onSignOut}
        />
      </aside>
    </>
  )
}

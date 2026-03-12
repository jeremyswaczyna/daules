'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, List, BarChart2, BookOpen,
  ClipboardList, Sparkles, Settings, ChevronRight, FlaskConical,
} from 'lucide-react'

type NavLeaf = { label: string; href: string }
type NavItem = {
  label: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  href?: string
  children?: NavLeaf[]
}
type NavGroup = { group: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    group: 'Workspace',
    items: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        children: [
          { label: 'Overview',    href: '/dashboard' },
          { label: 'Trades',      href: '/dashboard/trades' },
          { label: 'Performance', href: '/dashboard/performance' },
          { label: 'Accounts',    href: '/dashboard/accounts' },
        ],
      },
      { label: 'Playbook', icon: BookOpen,      href: '/dashboard/playbook' },
      { label: 'Review',   icon: ClipboardList, href: '/dashboard/review' },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { label: 'Insights',  icon: Sparkles,       href: '/dashboard/insights' },
      { label: 'Patterns',  icon: FlaskConical,   href: '/dashboard/patterns' },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
    ],
  },
]

interface Props {
  pathname: string
  onNavigate?: () => void
}

export default function SidebarNav({ pathname, onNavigate }: Props) {
  const defaultOpen: Record<string, boolean> = {}
  NAV.forEach(g => g.items.forEach(item => {
    if (item.children?.some(c => c.href === pathname || (c.href !== '/dashboard' && pathname.startsWith(c.href)))) {
      defaultOpen[item.label] = true
    }
  }))
  if (!('Dashboard' in defaultOpen)) defaultOpen['Dashboard'] = true

  const [open, setOpen] = useState<Record<string, boolean>>(defaultOpen)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const toggle = (label: string) => setOpen(o => ({ ...o, [label]: !o[label] }))

  return (
    <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto', overflowX: 'hidden' }}>
      {NAV.map(({ group, items }) => (
        <div key={group} style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em',
            textTransform: 'uppercase', color: 'var(--fg-xdim)',
            padding: '0 10px', marginBottom: 3,
          }}>
            {group}
          </div>

          {items.map(item => {
            const Icon = item.icon
            const hasChildren = !!item.children
            const isOpen = open[item.label]
            const parentActive = hasChildren
              ? item.children!.some(c => isActive(c.href))
              : item.href ? isActive(item.href) : false

            return (
              <div key={item.label}>
                {hasChildren ? (
                  <NavButton
                    onClick={() => toggle(item.label)}
                    active={parentActive}
                    suffix={
                      <ChevronRight size={11} style={{
                        color: 'var(--fg-dim)', flexShrink: 0,
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.22s var(--ease-out)',
                      }} />
                    }
                  >
                    <Icon size={14} style={{ flexShrink: 0, opacity: parentActive ? 0.9 : 0.6, transition: 'opacity 0.15s' }} />
                    <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: parentActive ? 500 : 400, letterSpacing: '-0.015em', transition: 'font-weight 0.1s' }}>
                      {item.label}
                    </span>
                  </NavButton>
                ) : (
                  <NavLink href={item.href!} active={parentActive} onClick={onNavigate}>
                    <Icon size={14} style={{ flexShrink: 0, opacity: parentActive ? 0.9 : 0.6, transition: 'opacity 0.15s' }} />
                    <span style={{ fontSize: '0.8125rem', letterSpacing: '-0.015em', fontWeight: parentActive ? 500 : 400 }}>
                      {item.label}
                    </span>
                  </NavLink>
                )}

                {/* Children with smooth height animation */}
                {hasChildren && (
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: isOpen ? 200 : 0,
                    transition: 'max-height 0.28s var(--ease-out)',
                  }}>
                    <div style={{ paddingTop: 1, paddingBottom: 2 }}>
                      {item.children!.map(child => (
                        <NavLink
                          key={child.href}
                          href={child.href}
                          active={isActive(child.href)}
                          onClick={onNavigate}
                          indent
                        >
                          <span style={{
                            fontSize: '0.8125rem', letterSpacing: '-0.015em',
                            fontWeight: isActive(child.href) ? 500 : 400,
                          }}>
                            {child.label}
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

// ── NavButton (for parent items with children) ─────────────────────────────
function NavButton({ onClick, active, suffix, children }: {
  onClick: () => void
  active: boolean
  suffix?: React.ReactNode
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        width: '100%', display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: 6,
        background: active ? 'var(--nav-active-bg)' : hov ? 'var(--nav-hover-bg)' : 'transparent',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        color: active ? 'var(--nav-active-text)' : hov ? 'var(--fg)' : 'var(--fg-muted)',
        transform: pressed ? 'scale(0.975)' : 'scale(1)',
        transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-spring)`,
      }}
    >
      {/* Active left accent */}
      <span style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 2,
        height: active ? 14 : 0,
        borderRadius: 99,
        background: 'var(--fg)',
        opacity: active ? 0.55 : 0,
        transition: `height 0.22s var(--ease-spring), opacity 0.18s var(--ease-out)`,
      }} />
      {children}
      {suffix}
    </button>
  )
}

// ── NavLink ────────────────────────────────────────────────────────────────
function NavLink({ href, active, onClick, indent, children }: {
  href: string
  active: boolean
  onClick?: () => void
  indent?: boolean
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 7,
        padding: indent ? '5px 10px 5px 32px' : '5px 10px',
        borderRadius: 6, textDecoration: 'none',
        background: active ? 'var(--nav-active-bg)' : hov ? 'var(--nav-hover-bg)' : 'transparent',
        color: active ? 'var(--nav-active-text)' : hov ? 'var(--fg)' : 'var(--fg-muted)',
        transform: pressed ? 'scale(0.975)' : 'scale(1)',
        transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-spring)`,
      }}
    >
      {/* Active left accent */}
      <span style={{
        position: 'absolute',
        left: indent ? 22 : 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 2,
        height: active ? 12 : 0,
        borderRadius: 99,
        background: 'var(--fg)',
        opacity: active ? 0.5 : 0,
        transition: `height 0.22s var(--ease-spring), opacity 0.18s var(--ease-out)`,
      }} />
      {children}
    </Link>
  )
}

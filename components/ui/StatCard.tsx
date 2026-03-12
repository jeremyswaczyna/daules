import type { CSSProperties, ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'red' | 'amber' | 'default'
  icon?: ReactNode
}

export default function StatCard({ label, value, sub, accent = 'default', icon }: StatCardProps) {
  const valueColor =
    accent === 'green' ? 'var(--green)' :
    accent === 'red'   ? 'var(--red)'   :
    accent === 'amber' ? 'var(--amber)' :
    'var(--fg)'

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '18px 20px',
      transition: 'background 0.15s var(--ease)',
    } as CSSProperties}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-hover)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--fg-dim)',
        }}>
          {label}
        </span>
        {icon && <span style={{ color: 'var(--fg-dim)', opacity: 0.6 }}>{icon}</span>}
      </div>
      <div style={{
        fontSize: '1.5rem',
        fontWeight: 500,
        letterSpacing: '-0.04em',
        color: valueColor,
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 6, letterSpacing: '-0.01em' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

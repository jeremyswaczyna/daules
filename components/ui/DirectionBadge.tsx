export default function DirectionBadge({ direction }: { direction: 'long' | 'short' }) {
  const isLong = direction === 'long'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.625rem', fontWeight: 500,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 9999,
      background: 'var(--bg-sub)',
      color: 'var(--fg-muted)',
      border: '1px solid var(--border)',
    }}>
      {isLong ? '↑ Long' : '↓ Short'}
    </span>
  )
}

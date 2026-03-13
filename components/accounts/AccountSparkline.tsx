'use client'

interface Props {
  data:   number[]
  width?: number
  height?: number
  color?: string
}

/**
 * Lightweight SVG sparkline — no recharts dependency.
 * Renders a smooth polyline of normalized data points.
 */
export default function AccountSparkline({
  data,
  width  = 100,
  height = 32,
  color  = '#4ade80',
}: Props) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 3

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = pad + ((1 - (v - min) / range) * (height - pad * 2))
    return [x, y] as [number, number]
  })

  // Build smooth bezier path
  const d = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = points[i - 1]
    const cpx = (px + x) / 2
    return `${acc} C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`
  }, '')

  const last = points[points.length - 1]
  const first = points[0]
  const isUp = last[1] <= first[1]
  const lineColor = isUp ? (color ?? '#4ade80') : 'var(--red, #ef4444)'

  // Area fill path
  const fill = `${d} L ${last[0]} ${height} L ${first[0]} ${height} Z`

  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 7)}`

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lineColor} stopOpacity={0.18} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0}    />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={lineColor} />
    </svg>
  )
}

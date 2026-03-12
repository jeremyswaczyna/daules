'use client'

interface Props {
  size?: number
  color?: string
  /** When true: nodes pulse in sequence (wave) + connector lines trace in — use for loading states */
  loading?: boolean
  style?: React.CSSProperties
}

/**
 * Daules logo mark — asymmetric calligraphic A with neural-network nodes.
 * Thick left stroke (strokeWidth 12), thin right stroke (sw 3), curved connector arcs.
 * Nodes: apex (52,9), inner-mid (30,55), right-base (80,78).
 *
 * loading=false → idle: nodes pulse gently with staggered delays
 * loading=true  → wave: nodes activate in sequence (apex → mid → base), connectors trace in
 */
export default function DaulesLogo({ size = 24, color = 'currentColor', loading = false, style }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
    >
      <style>{`
        /* ── idle pulse — each node breathes independently ── */
        @keyframes dlp0 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        @keyframes dlp1 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        @keyframes dlp2 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }

        /* ── loading wave — signal travels apex → mid → base ── */
        @keyframes dlw  { 0%,100%{opacity:.15;transform:scale(.55)} 50%{opacity:1;transform:scale(1.45)} }

        /* ── connector trace — draws the arc in over time ── */
        @keyframes dlt  { from{stroke-dashoffset:1} to{stroke-dashoffset:0} }

        /* ── loading: entire mark breathes slightly ── */
        @keyframes dlb  { 0%,100%{opacity:1} 50%{opacity:.72} }
      `}</style>

      {/* ─── Main A strokes ─────────────────────────────────────────── */}

      {/* Thick calligraphic left leg — the visual mass of the A */}
      <path
        d="M52 9 L11 86"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Thin right leg */}
      <path
        d="M52 9 L80 78"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Inner body stroke — the subtle third stroke inside the thick one */}
      <path
        d="M52 9 L28 70"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.52"
      />

      {/* ─── Neural connector arcs ──────────────────────────────────── */}

      {/* Arc from apex → inner-mid node: curves around the outside of the left stroke */}
      <path
        d="M52,9 C24,20 14,40 30,55"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity={loading ? 0.7 : 0.34}
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset="0"
        style={loading ? {
          strokeDashoffset: '1',
          animation: 'dlt 0.65s cubic-bezier(.4,0,.2,1) 0.1s infinite alternate',
        } : {}}
      />

      {/* Arc from inner-mid → right-base node */}
      <path
        d="M30,55 C52,64 66,70 80,78"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity={loading ? 0.7 : 0.34}
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset="0"
        style={loading ? {
          strokeDashoffset: '1',
          animation: 'dlt 0.65s cubic-bezier(.4,0,.2,1) 0.32s infinite alternate',
        } : {}}
      />

      {/* ─── Nodes ──────────────────────────────────────────────────── */}

      {/* Apex node */}
      <circle
        cx="52" cy="9" r="4.5"
        fill={color}
        style={{
          transformOrigin: '52px 9px',
          animation: loading
            ? 'dlw 1.4s ease-in-out 0s infinite'
            : 'dlp0 3.2s ease-in-out 0s infinite',
        }}
      />

      {/* Inner-mid node (where inner stroke meets connector) */}
      <circle
        cx="30" cy="55" r="3"
        fill={color}
        style={{
          transformOrigin: '30px 55px',
          animation: loading
            ? 'dlw 1.4s ease-in-out 0.45s infinite'
            : 'dlp1 3.2s ease-in-out 1.1s infinite',
        }}
      />

      {/* Right-base node */}
      <circle
        cx="80" cy="78" r="3.8"
        fill={color}
        style={{
          transformOrigin: '80px 78px',
          animation: loading
            ? 'dlw 1.4s ease-in-out 0.9s infinite'
            : 'dlp2 3.2s ease-in-out 2.2s infinite',
        }}
      />
    </svg>
  )
}

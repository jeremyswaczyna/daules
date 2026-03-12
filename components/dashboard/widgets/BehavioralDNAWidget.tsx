'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Trade } from '@/types'
import { calcBehavioralDNA, DNA_TRAITS, type BehavioralDNA } from '@/lib/calculations'

// ─── Canvas constants (logical px — drawn at 2× for crispness) ──────────────
const CW        = 860   // logical width
const CH        = 188   // logical height
const CX        = CW / 2
const CY        = CH / 2
const R         = 46    // helix tube radius
const HALF_W    = 355   // helix extends ±HALF_W along X axis
const FOV       = 310   // perspective focal length
const ROTATIONS = 2     // complete turns (2×2π total range)
const T_MIN     = -Math.PI * ROTATIONS
const T_MAX     =  Math.PI * ROTATIONS
const STRAND_N  = 300   // dots per strand
const SPIN_RATE = 0.0024 // rad per frame — slow, elegant

// 8 rung t-values, evenly distributed
const RUNG_TS = DNA_TRAITS.map((_, i) =>
  T_MIN + (i / (DNA_TRAITS.length - 1)) * (T_MAX - T_MIN)
)

// score → RGB — matches Daules brand palette
function scoreRGB(s: number): [number, number, number] {
  if (s >= 78) return [110, 231, 155]   // emerald
  if (s >= 58) return [251, 191,  70]   // amber
  return [248, 113, 113]                 // rose
}

// Project a point on the horizontal helix.
// Helix axis = screen X. Helix rotates around X axis.
//   sy = R·cos(t),  sz = R·sin(t)
// After X-axis rotation by `angle`:
//   ry = sy·cos(α) − sz·sin(α)
//   rz = sy·sin(α) + sz·cos(α)
// Screen: px = CX + (HALF_W·t)/(π·ROTATIONS),  py = CY + ry·fov/(fov+rz)
function project(t: number, sy: number, sz: number, angle: number) {
  const ry  = sy * Math.cos(angle) - sz * Math.sin(angle)
  const rz  = sy * Math.sin(angle) + sz * Math.cos(angle)
  const ps  = FOV / (FOV + rz + R * 0.35)   // perspective scale
  const px  = CX + (HALF_W * t) / (Math.PI * ROTATIONS)
  const py  = CY + ry * ps
  return { px, py, ps, rz }
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props { trades: Trade[] }

export default function BehavioralDNAWidget({ trades }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef  = useRef(0.55)          // initial spin angle (nice perspective view)
  const rafRef    = useRef<number>(0)
  const dprRef    = useRef(1)
  const dnaRef    = useRef<BehavioralDNA | null>(null)

  // Always keep dna up-to-date (runs synchronously on each render)
  dnaRef.current = calcBehavioralDNA(trades)
  const dna      = dnaRef.current
  const hasData  = trades.length >= 5

  // ── DPR setup (once on mount) ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    dprRef.current = dpr
    canvas.width  = CW * dpr
    canvas.height = CH * dpr
  }, [])

  // ── draw loop ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr   = dprRef.current
    const angle = angleRef.current
    const dna_  = dnaRef.current!

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    // ── precompute rungs ───────────────────────────────────────────────────
    type Pt = ReturnType<typeof project>
    type Rung = {
      pA: Pt; pB: Pt; midRz: number
      trait: typeof DNA_TRAITS[number]
      score: number; rgb: [number, number, number]
    }

    const rungs: Rung[] = RUNG_TS.map((t, i) => {
      const pA = project(t, R * Math.cos(t),             R * Math.sin(t),             angle)
      const pB = project(t, R * Math.cos(t + Math.PI),   R * Math.sin(t + Math.PI),   angle)
      const score = hasData ? dna_[DNA_TRAITS[i].key] : 35
      return { pA, pB, midRz: (pA.rz + pB.rz) / 2, trait: DNA_TRAITS[i], score, rgb: scoreRGB(score) }
    })

    // ── collect all drawables for Z-sort ──────────────────────────────────
    type D =
      | { k: 'dot';  px: number; py: number; ps: number; rz: number; s: 0 | 1 }
      | { k: 'rung'; rz: number; rg: Rung }
      | { k: 'node'; px: number; py: number; ps: number; rz: number; rg: Rung }

    const items: D[] = []

    for (let i = 0; i <= STRAND_N; i++) {
      const t  = T_MIN + (i / STRAND_N) * (T_MAX - T_MIN)
      const pA = project(t, R * Math.cos(t),           R * Math.sin(t),           angle)
      const pB = project(t, R * Math.cos(t + Math.PI), R * Math.sin(t + Math.PI), angle)
      items.push({ k: 'dot', ...pA, s: 0 })
      items.push({ k: 'dot', ...pB, s: 1 })
    }
    for (const rg of rungs) {
      items.push({ k: 'rung', rz: rg.midRz, rg })
      items.push({ k: 'node', px: rg.pA.px, py: rg.pA.py, ps: rg.pA.ps, rz: rg.pA.rz, rg })
      items.push({ k: 'node', px: rg.pB.px, py: rg.pB.py, ps: rg.pB.ps, rz: rg.pB.rz, rg })
    }
    items.sort((a, b) => b.rz - a.rz)   // back → front

    // ── render ────────────────────────────────────────────────────────────
    for (const it of items) {

      // Strand particle — same crisp style as Daules logo particles
      if (it.k === 'dot') {
        const depth = Math.max(0, Math.min(1, (it.ps - 0.5) / 0.6))
        const alpha = 0.05 + depth * 0.42
        const size  = 0.45 + depth * 1.1
        ctx.beginPath()
        ctx.arc(it.px, it.py, size, 0, Math.PI * 2)
        ctx.fillStyle = it.s === 0
          ? `rgba(255,255,255,${alpha.toFixed(3)})`
          : `rgba(185,210,255,${(alpha * 0.78).toFixed(3)})`
        ctx.fill()
      }

      // Rung cross-bridge
      else if (it.k === 'rung') {
        const { pA, pB, rgb, score } = it.rg
        const [r, g, b] = rgb
        const depth = Math.max(0, Math.min(1, (FOV / (FOV + it.rz + R * 0.35) - 0.5) / 0.55))
        const alpha  = hasData ? (0.06 + depth * 0.38) : 0.06

        // Ghost background line
        ctx.beginPath()
        ctx.moveTo(pA.px, pA.py)
        ctx.lineTo(pB.px, pB.py)
        ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(3)})`
        ctx.lineWidth   = 0.6 + depth * 0.8
        ctx.stroke()

        // Filled score overlay
        if (hasData && score > 0) {
          const fx = pA.px + (pB.px - pA.px) * (score / 100)
          const fy = pA.py + (pB.py - pA.py) * (score / 100)
          ctx.beginPath()
          ctx.moveTo(pA.px, pA.py)
          ctx.lineTo(fx, fy)
          ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(0.85, alpha * 2.2).toFixed(3)})`
          ctx.lineWidth   = 1.2 + depth * 1.6
          ctx.stroke()
        }
      }

      // Trait node — identical render style to Daules logo nodes
      // Outer glow: radial gradient (no shadowBlur), inner dot: white-center radial gradient
      else if (it.k === 'node') {
        const { px, py, ps, rg } = it
        const [cr, cg, cb] = rg.rgb
        const depth = Math.max(0, Math.min(1, (ps - 0.5) / 0.6))
        const alpha = hasData ? (0.22 + depth * 0.78) : 0.15
        const r_dot = 2.2 + depth * 5.0   // node radius: 2.2 → 7.2 px

        // ── outer glow ring (crisp radial gradient, zero blur) ───────────
        const glowR = r_dot * 4
        const grd   = ctx.createRadialGradient(px, py, r_dot * 0.6, px, py, glowR)
        grd.addColorStop(0, `rgba(${cr},${cg},${cb},${(alpha * 0.28).toFixed(3)})`)
        grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.beginPath()
        ctx.arc(px, py, glowR, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // ── inner dot (white core → score color) ─────────────────────────
        const dot = ctx.createRadialGradient(px, py, 0, px, py, r_dot)
        dot.addColorStop(0,   `rgba(255,255,255,${(alpha * 1.0).toFixed(3)})`)
        dot.addColorStop(0.45,`rgba(${cr},${cg},${cb},${(alpha * 0.95).toFixed(3)})`)
        dot.addColorStop(1,   `rgba(${cr},${cg},${cb},${(alpha * 0.25).toFixed(3)})`)
        ctx.beginPath()
        ctx.arc(px, py, r_dot, 0, Math.PI * 2)
        ctx.fillStyle = dot
        ctx.fill()
      }
    }

    // ── no-data label ─────────────────────────────────────────────────────
    if (!hasData) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.font      = '400 11px -apple-system, Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Log 5+ trades to unlock your behavioral profile', CX, CY + 4)
      ctx.textAlign = 'left'
    }

    ctx.restore()
    angleRef.current += SPIN_RATE
    rafRef.current    = requestAnimationFrame(draw)
  }, [hasData])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 0',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
            Behavioral DNA
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
            {hasData
              ? `${trades.length} trade${trades.length !== 1 ? 's' : ''} analyzed`
              : 'Needs 5+ trades to activate'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {([['#6ee79b', 'Strong · 78+'], ['#fbbf46', 'Fair · 58–77'], ['#f87171', 'Weak · <58']] as const).map(([col, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: col, boxShadow: `0 0 5px ${col}88` }} />
              <span style={{ fontSize: '0.625rem', color: 'var(--fg-dim)', letterSpacing: '0.01em' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Canvas — pure 3D animation ───────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: CH + 'px', display: 'block' }}
      />

      {/* ── Trait score grid — HTML for pixel-perfect crispness ─────────── */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
        {DNA_TRAITS.map((trait, i) => {
          const score = hasData ? dna[trait.key] : null
          const [r, g, b] = score !== null ? scoreRGB(score) : [100, 100, 100]
          const color = score !== null ? `rgb(${r},${g},${b})` : 'var(--fg-xdim,var(--fg-dim))'
          return (
            <div key={trait.key} style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
              padding: '10px 2px 11px',
              borderRight: i < DNA_TRAITS.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{
                fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--fg-dim)',
                textAlign: 'center', lineHeight: 1.3,
              }}>
                {trait.label}
              </span>
              <span style={{
                fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.04em',
                color, marginTop: 4, lineHeight: 1,
              }}>
                {score !== null ? score : '—'}
              </span>
              {/* Micro score bar */}
              <div style={{
                marginTop: 5, width: '60%', height: 2,
                background: 'var(--border)', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: score !== null ? `${score}%` : '0%',
                  background: color,
                  borderRadius: 2,
                  transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x:  number
  y:  number
  vx: number
  vy: number
}

const PARTICLE_COUNT    = 55
const MAX_DIST          = 130   // max px between connected particles
const DOT_RADIUS        = 1.2
const LINE_OPACITY      = 0.06
const DOT_OPACITY       = 0.18
const CURSOR_RADIUS     = 160   // px of cursor influence
const CURSOR_STRENGTH   = 0.016 // how much cursor nudges particles
const BASE_SPEED        = 0.18
const FPS_CAP           = 30

export default function SubtleNeuralBackground() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const mouse       = useRef({ x: -9999, y: -9999 })
  const particles   = useRef<Particle[]>([])
  const rafRef      = useRef<number>(0)
  const lastFrame   = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init particles
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * BASE_SPEED * 2,
      vy: (Math.random() - 0.5) * BASE_SPEED * 2,
    }))

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove)

    // Detect dark mode via CSS variable approach
    const isDark = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      // dark if bg is close to black
      return !bg || bg === '#09090b' || document.documentElement.getAttribute('data-theme') === 'dark'
    }

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw)
      const dt = now - lastFrame.current
      if (dt < 1000 / FPS_CAP) return
      lastFrame.current = now

      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      const dark    = isDark()
      const dotCol  = dark ? `rgba(255,255,255,${DOT_OPACITY})` : `rgba(0,0,0,${DOT_OPACITY})`
      const lineR   = dark ? 255 : 0
      const lineG   = dark ? 255 : 0
      const lineB   = dark ? 255 : 0

      const ps = particles.current
      const mx = mouse.current.x
      const my = mouse.current.y

      // Update positions
      for (const p of ps) {
        // Cursor repulsion (soft)
        const dx = p.x - mx
        const dy = p.y - my
        const distSq = dx * dx + dy * dy
        if (distSq < CURSOR_RADIUS * CURSOR_RADIUS && distSq > 0) {
          const dist  = Math.sqrt(distSq)
          const force = (CURSOR_RADIUS - dist) / CURSOR_RADIUS
          p.vx += (dx / dist) * force * CURSOR_STRENGTH
          p.vy += (dy / dist) * force * CURSOR_STRENGTH
        }

        // Dampen + base drift
        p.vx *= 0.995
        p.vy *= 0.995

        // Clamp speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > BASE_SPEED * 2.5) {
          p.vx = (p.vx / speed) * BASE_SPEED * 2.5
          p.vy = (p.vy / speed) * BASE_SPEED * 2.5
        }

        p.x += p.vx
        p.y += p.vy

        // Wrap edges
        if (p.x < 0)  p.x = w
        if (p.x > w)  p.x = 0
        if (p.y < 0)  p.y = h
        if (p.y > h)  p.y = 0
      }

      // Draw connections
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx   = ps[i].x - ps[j].x
          const dy   = ps[i].y - ps[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > MAX_DIST) continue
          const alpha = (1 - dist / MAX_DIST) * LINE_OPACITY
          ctx.beginPath()
          ctx.moveTo(ps[i].x, ps[i].y)
          ctx.lineTo(ps[j].x, ps[j].y)
          ctx.strokeStyle = `rgba(${lineR},${lineG},${lineB},${alpha})`
          ctx.lineWidth   = 0.6
          ctx.stroke()
        }
      }

      // Draw dots
      ctx.fillStyle = dotCol
      for (const p of ps) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.6,
      }}
    />
  )
}

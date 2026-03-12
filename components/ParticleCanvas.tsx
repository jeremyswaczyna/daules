'use client'

import { useEffect, useRef } from 'react'

// ── tunables ────────────────────────────────────────────────
const NODE_COUNT       = 150
const BASE_SPEED       = 0.07        // very gentle drift
const SPEED_VARIANCE   = 0.4
const CONNECT_DIST     = 95
const WAVE_INTERVAL    = 7500        // long pause — sparse, rare events
const WAVE_HOPS        = 4           // small spread
const HOP_DELAY        = 340         // deliberate, slow propagation
const DECAY            = 0.0012      // slow fade — nodes stay lit much longer
const SKIP_PROB        = 0.60        // slightly more spread
const MAX_ACTIVE       = 17          // more lights alive at once
const MOTION_BLUR      = 0.12        // heavy trail = dreamy motion blur
// ────────────────────────────────────────────────────────────

type Node = {
  x: number; y: number
  vx: number; vy: number
  activation: number     // 0–1, eased in smoothly
  targetAct: number      // what activation wants to become
  strength: number       // per-node peak (randomised)
  fade: number           // slow breathing pulse
  r: number
  decayRate: number
  fuzzySeeds: { angle: number; dist: number; r: number }[]  // hairy tendrils
}

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let waveTimer: ReturnType<typeof setInterval>
    let nodes: Node[] = []
    const dpr = window.devicePixelRatio || 1

    // ── setup ──────────────────────────────────────────────
    const makeFuzzySeeds = () =>
      Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
        angle: Math.random() * Math.PI * 2,
        dist:  0.5 + Math.random() * 1.0,   // closer, tighter halo
        r:     0.2 + Math.random() * 0.35,  // smaller — whisper-thin
      }))

    const initNodes = (w: number, h: number) => {
      nodes = Array.from({ length: NODE_COUNT }, () => {
        const speed = BASE_SPEED * (0.4 + Math.random() * SPEED_VARIANCE)
        const angle = Math.random() * Math.PI * 2
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          activation: 0,
          targetAct: 0,
          strength: 0.35 + Math.random() * 0.35,   // brighter peak: 0.35–0.70
          fade: Math.random(),
          r: 1.0 + Math.random() * 0.7,
          decayRate: DECAY * (0.7 + Math.random() * 0.6),
          fuzzySeeds: makeFuzzySeeds(),
        }
      })
    }

    const resize = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width  = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (nodes.length === 0) initNodes(w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // ── BFS activation wave ────────────────────────────────
    const bfsWave = (startIdx?: number) => {
      // count currently active nodes — respect cap
      const activeCount = nodes.filter(n => n.targetAct > 0.05).length
      if (activeCount > MAX_ACTIVE * 0.75) return   // too many lit, skip this wave

      const start = startIdx ?? Math.floor(Math.random() * NODE_COUNT)
      let frontier = [start]
      const visited = new Set([start])
      let hop = 0

      const step = () => {
        if (hop > WAVE_HOPS || frontier.length === 0) return

        // only activate if we're still under the cap
        const currentlyActive = nodes.filter(n => n.targetAct > 0.05).length
        const slotsLeft = MAX_ACTIVE - currentlyActive
        if (slotsLeft <= 0) return

        // pick a subset of frontier (slow, deliberate feel)
        const chosen = frontier
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(frontier.length, Math.max(1, slotsLeft)))

        chosen.forEach(i => {
          // bloom gently from near-zero → no sudden pop
          const bloomTarget = nodes[i].strength * (0.4 + Math.random() * 0.45)
          nodes[i].targetAct = Math.min(nodes[i].strength, bloomTarget)
        })

        const next: number[] = []
        chosen.forEach(i => {
          for (let j = 0; j < NODE_COUNT; j++) {
            if (visited.has(j)) continue
            if (Math.random() < SKIP_PROB) continue
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            if (dx * dx + dy * dy < CONNECT_DIST * CONNECT_DIST) {
              next.push(j)
              visited.add(j)
            }
          }
        })

        frontier = next
        hop++
        setTimeout(step, HOP_DELAY * (0.9 + Math.random() * 0.5))
      }
      step()
    }

    // staggered, single wave at a time
    waveTimer = setInterval(() => {
      bfsWave()
    }, WAVE_INTERVAL)

    // gentle delayed start — no immediate blast
    setTimeout(() => bfsWave(), 1200)

    // ── render loop ───────────────────────────────────────
    const draw = () => {
      const w = W(), h = H()

      // motion blur: paint semi-transparent black over previous frame
      ctx.fillStyle = `rgba(0,0,0,${MOTION_BLUR})`
      ctx.fillRect(0, 0, w, h)

      // update nodes
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i]
        n.x += n.vx + (Math.random() - 0.5) * 0.04
        n.y += n.vy + (Math.random() - 0.5) * 0.04
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1

        // very slow ease-in — lights bloom gradually, not instantly
        n.activation += (n.targetAct - n.activation) * 0.022

        // decay target slowly
        n.targetAct = Math.max(0, n.targetAct - n.decayRate)
        n.activation = Math.max(0, n.activation)

        n.fade = (n.fade + 0.0012) % 1
      }

      // edges — only between nodes with some activation
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const boost = (nodes[i].activation + nodes[j].activation) * 0.5
          if (boost < 0.04) continue   // skip dim pairs entirely

          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d2 = dx * dx + dy * dy
          if (d2 > CONNECT_DIST * CONNECT_DIST) continue

          const prox = 1 - Math.sqrt(d2) / CONNECT_DIST
          ctx.strokeStyle = `rgba(200,200,200,${prox * 0.3 + boost * 0.25})`
          ctx.lineWidth   = 0.4
          ctx.beginPath()
          ctx.moveTo(nodes[i].x, nodes[i].y)
          ctx.lineTo(nodes[j].x, nodes[j].y)
          ctx.stroke()
        }
      }

      // resting dim edges (very subtle)
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const boost = (nodes[i].activation + nodes[j].activation) * 0.5
          if (boost >= 0.04) continue
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d2 = dx * dx + dy * dy
          if (d2 > CONNECT_DIST * CONNECT_DIST) continue
          const prox = 1 - Math.sqrt(d2) / CONNECT_DIST
          ctx.strokeStyle = `rgba(255,255,255,${prox * 0.045})`
          ctx.lineWidth   = 0.25
          ctx.beginPath()
          ctx.moveTo(nodes[i].x, nodes[i].y)
          ctx.lineTo(nodes[j].x, nodes[j].y)
          ctx.stroke()
        }
      }

      // dots
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i]
        const act = n.activation
        const r   = n.r + act * 0.8

        if (act > 0.04) {
          // outer soft glow — wide, very dim, atmospheric
          const glowR = r * 14
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR)
          g.addColorStop(0,   `rgba(210,210,210,${act * 0.08})`)
          g.addColorStop(0.35,`rgba(200,200,200,${act * 0.03})`)
          g.addColorStop(1,   'rgba(200,200,200,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2)
          ctx.fill()

          // ── hairy / fuzzy micro-halo ──────────────────────
          n.fuzzySeeds.forEach(seed => {
            const angle = seed.angle + n.fade * Math.PI * 0.25   // slow wobble
            const d     = r * seed.dist * (0.7 + act * 0.5)
            const px    = n.x + Math.cos(angle) * d
            const py    = n.y + Math.sin(angle) * d
            const pr    = seed.r * (0.4 + act * 0.5)
            const fg = ctx.createRadialGradient(px, py, 0, px, py, pr * 3)
            fg.addColorStop(0, `rgba(215,215,215,${act * 0.35})`)   // softer opacity
            fg.addColorStop(1, 'rgba(215,215,215,0)')
            ctx.fillStyle = fg
            ctx.beginPath()
            ctx.arc(px, py, pr * 3, 0, Math.PI * 2)
            ctx.fill()
          })
        }

        // core dot — radial gradient for softness
        const restAlpha   = 0.08 + n.fade * 0.06
        const activeAlpha = 0.38 + act * 0.20   // softer peak brightness
        const dotAlpha = act > 0.04 ? activeAlpha : restAlpha
        const dotColor = act > 0.04 ? '210,210,210' : '140,140,140'

        const cg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 1.8)
        cg.addColorStop(0,   `rgba(${dotColor},${dotAlpha})`)
        cg.addColorStop(0.5, `rgba(${dotColor},${dotAlpha * 0.5})`)
        cg.addColorStop(1,   `rgba(${dotColor},0)`)
        ctx.fillStyle = cg
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 1.8, 0, Math.PI * 2)
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      clearInterval(waveTimer)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}

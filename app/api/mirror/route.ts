import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { collection, getDocs, query, orderBy, limit, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trade, MirrorReport } from '@/types'
import {
  calcWinRate, calcNetPnL, calcAvgR, calcProfitFactor,
  calcDrawdown, calcAvgWin, calcAvgLoss, calcStreakStats,
  calcBehavioralDNA, DNA_TRAITS, discoverPatterns,
} from '@/lib/calculations'

interface MirrorRequestBody {
  uid: string
  accountId: string
  accountName?: string
}

function buildMirrorContext(trades: Trade[], accountName: string): string {
  const wr      = calcWinRate(trades)
  const netPnL  = calcNetPnL(trades)
  const avgR    = calcAvgR(trades)
  const pf      = calcProfitFactor(trades)
  const dd      = calcDrawdown(trades)
  const avgWin  = calcAvgWin(trades)
  const avgLoss = calcAvgLoss(trades)
  const streak  = calcStreakStats(trades)
  const dna     = calcBehavioralDNA(trades)
  const patterns = discoverPatterns(trades)

  const dnaLines = DNA_TRAITS.map(t => `  ${t.label}: ${dna[t.key]}/100 (${t.desc})`).join('\n')

  const topPatterns = patterns.slice(0, 5).map(p =>
    `  - ${p.title}: ${p.description} [${p.confidence} confidence, $${p.pnlImpact.toFixed(0)} P&L impact]`
  ).join('\n')

  const setupMap = new Map<string, { pnl: number; count: number; wins: number }>()
  for (const t of trades) {
    for (const s of t.setup) {
      const e = setupMap.get(s) ?? { pnl: 0, count: 0, wins: 0 }
      setupMap.set(s, { pnl: e.pnl + t.pnl, count: e.count + 1, wins: e.wins + (t.pnl > 0 ? 1 : 0) })
    }
  }
  const setupLines = Array.from(setupMap.entries())
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .slice(0, 5)
    .map(([name, d]) => `  ${name}: ${d.count}t, ${((d.wins/d.count)*100).toFixed(0)}% WR, $${d.pnl.toFixed(0)}`)
    .join('\n')

  const emotionTrades = trades.filter(t => t.emotionPre)
  const emotionLines = emotionTrades.length >= 3
    ? ['focused','neutral','anxious','impulsive','euphoric']
        .map(em => {
          const emT = emotionTrades.filter(t => t.emotionPre === em)
          if (emT.length === 0) return null
          const emWR = calcWinRate(emT)
          return `  ${em}: ${emT.length} trades, ${emWR.toFixed(0)}% WR`
        })
        .filter(Boolean)
        .join('\n')
    : '  No emotional data logged yet'

  const mistakeMap = new Map<string, number>()
  for (const t of trades) {
    for (const m of t.mistakes) {
      mistakeMap.set(m, (mistakeMap.get(m) ?? 0) + 1)
    }
  }
  const topMistakes = Array.from(mistakeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m, c]) => `  ${m}: ${c}x`)
    .join('\n') || '  None tagged'

  return `
ACCOUNT: ${accountName}
PERIOD: ${trades.length} trades analyzed

CORE METRICS:
  Win rate: ${wr.toFixed(1)}%
  Net P&L: $${netPnL.toFixed(2)}
  Avg R: ${avgR.toFixed(2)}
  Profit factor: ${pf === Infinity ? '∞' : pf.toFixed(2)}
  Max drawdown: $${dd.toFixed(2)}
  Avg win: $${avgWin.toFixed(2)} | Avg loss: $${avgLoss.toFixed(2)}

STREAK INTELLIGENCE:
  Current streak: ${streak.currentStreak > 0 ? `+${streak.currentStreak} wins` : streak.currentStreak < 0 ? `${Math.abs(streak.currentStreak)} losses` : 'flat'}
  Longest win streak: ${streak.longestWin} | Longest loss streak: ${streak.longestLoss}
  Win rate after a loss: ${streak.winRateAfterLoss.toFixed(0)}%
  Win rate after a win: ${streak.winRateAfterWin.toFixed(0)}%

BEHAVIORAL DNA (0-100):
${dnaLines}

TOP SETUPS:
${setupLines || '  No setup tags used'}

TOP MISTAKES:
${topMistakes}

EMOTIONAL PERFORMANCE:
${emotionLines}

DISCOVERED PATTERNS:
${topPatterns || '  Not enough data for statistical patterns yet'}
`.trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as MirrorRequestBody
    const { uid, accountId, accountName = 'your account' } = body

    if (!uid || !accountId) {
      return NextResponse.json({ error: 'uid and accountId are required' }, { status: 400 })
    }

    const tradesRef = collection(db, 'users', uid, 'accounts', accountId, 'trades')
    const q = query(tradesRef, orderBy('date', 'desc'), limit(300))
    const snapshot = await getDocs(q)
    const trades = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Trade))

    if (trades.length < 10) {
      return NextResponse.json({ error: 'Log at least 10 trades to generate The Mirror' }, { status: 422 })
    }

    // Last 60 days, fallback to all
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const recentTrades = trades.filter(t => new Date(t.date) >= cutoff)
    const tradesToAnalyze = recentTrades.length >= 10 ? recentTrades : trades.slice(0, 100)

    const context = buildMirrorContext(tradesToAnalyze, accountName)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1800,
      messages: [
        {
          role: 'user',
          content: `You are a world-class discretionary trading coach writing a monthly performance letter — "The Mirror" — to a serious retail trader. Your tone is warm, direct, and honest. You use data to confront patterns the trader may not want to see, and also celebrate genuine strengths.

Write a 4-paragraph coaching letter based on this trading data:

${context}

Structure your letter exactly like this (no headings, no bullet points — pure prose):

Paragraph 1 — PERFORMANCE PULSE (3-4 sentences): Open with the most honest single sentence about this period. Then give context: what the numbers actually say, compared to what a healthy trader's numbers look like. Be specific with figures.

Paragraph 2 — THE BEHAVIORAL MIRROR (4-5 sentences): Reflect back the trader's behavioral DNA. What is the data revealing about their psychology, discipline, and habits? Reference specific DNA scores and emotional patterns if present. Be like a therapist who is also a trader.

Paragraph 3 — PATTERNS THAT DEFINE YOU (3-4 sentences): Highlight the most impactful pattern discovered — the single strongest edge or the single biggest drag. Make it personal and specific. This is the insight they should act on first.

Paragraph 4 — YOUR THREE DIRECTIVES (2-3 sentences intro + exactly 3 numbered directives): Close with forward-looking, specific, measurable action items. Each directive should be one sentence that begins with a verb.

Return only the letter text — no JSON, no markdown, no labels. Just the 4 paragraphs.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const narrative = content.text.trim()
    const period = new Date().toISOString().slice(0, 7) // YYYY-MM

    const reportData: Omit<MirrorReport, 'id'> = {
      uid,
      accountId,
      period,
      narrative,
      tradeCount: tradesToAnalyze.length,
      createdAt: new Date().toISOString(),
    }

    const mirrorsRef = collection(db, 'users', uid, 'mirrors')
    const docRef = await addDoc(mirrorsRef, reportData)
    const report: MirrorReport = { id: docRef.id, ...reportData }

    return NextResponse.json({ report })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

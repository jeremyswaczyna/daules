import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { collection, getDocs, query, orderBy, limit, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trade, Insight } from '@/types'

interface InsightRequestBody {
  uid: string
  accountId: string
}

function buildTradesSummary(trades: Trade[]): string {
  if (trades.length === 0) return 'No trades available.'

  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl < 0)
  const winRate = (wins.length / trades.length) * 100
  const netPnL = trades.reduce((s, t) => s + t.pnl, 0)
  const avgR = trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length

  // Setup performance
  const setupMap = new Map<string, { pnl: number; count: number; wins: number }>()
  for (const trade of trades) {
    for (const setup of trade.setup) {
      const e = setupMap.get(setup) ?? { pnl: 0, count: 0, wins: 0 }
      setupMap.set(setup, {
        pnl: e.pnl + trade.pnl,
        count: e.count + 1,
        wins: e.wins + (trade.pnl > 0 ? 1 : 0),
      })
    }
  }
  const setupSummary = Array.from(setupMap.entries())
    .map(([name, d]) => `${name}: ${d.count} trades, ${((d.wins / d.count) * 100).toFixed(0)}% WR, $${d.pnl.toFixed(0)} PnL`)
    .join('; ')

  // Mistake frequency
  const mistakeMap = new Map<string, number>()
  for (const trade of trades) {
    for (const m of trade.mistakes) {
      mistakeMap.set(m, (mistakeMap.get(m) ?? 0) + 1)
    }
  }
  const topMistakes = Array.from(mistakeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m, c]) => `${m}: ${c}x`)
    .join(', ')

  // Session breakdown
  const sessionMap = new Map<string, { pnl: number; count: number }>()
  for (const trade of trades) {
    const e = sessionMap.get(trade.session) ?? { pnl: 0, count: 0 }
    sessionMap.set(trade.session, { pnl: e.pnl + trade.pnl, count: e.count + 1 })
  }
  const sessionSummary = Array.from(sessionMap.entries())
    .map(([s, d]) => `${s}: ${d.count} trades, $${d.pnl.toFixed(0)} PnL`)
    .join('; ')

  return `
Trading Performance Summary (last 90 days, ${trades.length} trades):
- Win rate: ${winRate.toFixed(1)}%
- Net P&L: $${netPnL.toFixed(2)}
- Average R: ${avgR.toFixed(2)}
- Wins: ${wins.length}, Losses: ${losses.length}
- Average win: $${wins.length > 0 ? (wins.reduce((s, t) => s + t.pnl, 0) / wins.length).toFixed(2) : '0'}
- Average loss: $${losses.length > 0 ? (Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)).toFixed(2) : '0'}
- Setup performance: ${setupSummary || 'No setup tags used'}
- Top mistakes: ${topMistakes || 'No mistakes tagged'}
- Session breakdown: ${sessionSummary || 'No session data'}
  `.trim()
}

const INSIGHT_ICONS = ['trending', 'alert', 'target', 'brain']

export async function POST(request: Request) {
  try {
    const body = await request.json() as InsightRequestBody
    const { uid, accountId } = body

    if (!uid || !accountId) {
      return NextResponse.json(
        { error: 'uid and accountId are required' },
        { status: 400 }
      )
    }

    // Fetch trades from Firestore
    const tradesRef = collection(db, 'users', uid, 'accounts', accountId, 'trades')
    const q = query(tradesRef, orderBy('date', 'desc'), limit(200))
    const snapshot = await getDocs(q)
    const trades = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Trade))

    if (trades.length < 10) {
      return NextResponse.json(
        { error: 'Log at least 10 trades to generate insights' },
        { status: 422 }
      )
    }

    // Filter to last 90 days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const recentTrades = trades.filter((t) => new Date(t.date) >= cutoff)
    const tradesToAnalyze = recentTrades.length >= 10 ? recentTrades : trades.slice(0, 50)

    const summary = buildTradesSummary(tradesToAnalyze)

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a professional trading coach analyzing a trader's performance data. Based on this data, provide exactly 4 actionable behavioral insights.

${summary}

Return a JSON array with exactly 4 objects. Each object must have:
- "title": string (max 8 words, specific and actionable)
- "body": string (2-3 sentences, data-driven, behavioral focus)
- "icon": one of ["trending", "alert", "target", "brain"]

Return only the JSON array, no other text.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response from Claude')
    }

    let parsedInsights: Array<{ title: string; body: string; icon: string }>
    try {
      const text = content.text.trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found')
      parsedInsights = JSON.parse(jsonMatch[0]) as typeof parsedInsights
    } catch {
      throw new Error('Failed to parse insights from Claude response')
    }

    if (!Array.isArray(parsedInsights) || parsedInsights.length === 0) {
      throw new Error('Invalid insights format')
    }

    // Save to Firestore
    const insightsRef = collection(db, 'users', uid, 'insights')
    const savedInsights: Insight[] = []

    for (let i = 0; i < Math.min(parsedInsights.length, 4); i++) {
      const insight = parsedInsights[i]
      const insightData: Omit<Insight, 'id'> = {
        uid,
        accountId,
        title: String(insight.title ?? '').slice(0, 100),
        body: String(insight.body ?? '').slice(0, 500),
        icon: INSIGHT_ICONS.includes(insight.icon) ? insight.icon : 'sparkles',
        createdAt: new Date().toISOString(),
      }
      const docRef = await addDoc(insightsRef, insightData)
      savedInsights.push({ id: docRef.id, ...insightData })
    }

    return NextResponse.json({ insights: savedInsights })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

'use client'

import { useEffect, useState } from 'react'
import { useAccount } from '@/lib/account-context'
import { getTrades } from '@/lib/firestore/trades'
import { getMirrors } from '@/lib/firestore/mirrors'
import type { MirrorReport } from '@/types'
import { format } from 'date-fns'

// ── Paragraph helpers ──────────────────────────────────────────────────────
function NarrativeBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {paragraphs.map((para, i) => {
        // Detect the directives paragraph (contains numbered list)
        const hasDirectives = /^\s*[123]\.\s/.test(para)

        if (hasDirectives) {
          const [intro, ...rest] = para.split(/(?=\n\s*[123]\.\s)/)
          const directives = rest.join('\n').match(/[123]\.\s[^\n]+/g) ?? []
          const directiveColors = ['#6ee7a0', '#fbbf24', '#818cf8']
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {intro && (
                <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.75, color: 'var(--fg-muted)', letterSpacing: '-0.01em' }}>
                  {intro.trim()}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {directives.map((d, di) => (
                  <div key={di} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', borderRadius: 10,
                    background: `${directiveColors[di]}0d`,
                    border: `1px solid ${directiveColors[di]}30`,
                  }}>
                    <div style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                      background: `${directiveColors[di]}20`,
                      border: `1px solid ${directiveColors[di]}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.625rem', fontWeight: 700, color: directiveColors[di],
                      marginTop: 1,
                    }}>
                      {di + 1}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                      {d.replace(/^[123]\.\s/, '')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
          <p key={i} style={{
            margin: 0,
            fontSize: '0.9375rem',
            lineHeight: 1.75,
            color: i === 0 ? 'var(--fg)' : 'var(--fg-muted)',
            letterSpacing: '-0.01em',
            fontWeight: i === 0 ? 400 : 400,
          }}>
            {para.trim()}
          </p>
        )
      })}
    </div>
  )
}

function ReportCard({ report, active, onClick }: { report: MirrorReport; active: boolean; onClick: () => void }) {
  const dt = (() => {
    try { return format(new Date(report.createdAt), 'MMM d, yyyy') } catch { return report.createdAt }
  })()
  const periodLabel = (() => {
    try { return format(new Date(report.period + '-01'), 'MMMM yyyy') } catch { return report.period }
  })()

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        padding: '12px 16px', borderRadius: 10,
        background: active ? 'var(--nav-active-bg)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--green)' : 'transparent'}`,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: active ? 500 : 400, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
        {periodLabel}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
        {dt} · {report.tradeCount} trades
      </p>
    </button>
  )
}

function LoadingPulse() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[120, 80, 100, 140].map((h, i) => (
        <div key={i} style={{
          height: h, borderRadius: 8,
          background: 'var(--bg-sub,rgba(0,0,0,0.04))',
          animation: 'pulse 1.8s ease-in-out infinite',
          animationDelay: `${i * 0.12}s`,
        }} />
      ))}
    </div>
  )
}

export default function InsightsPage() {
  const { selectedAccount, user } = useAccount()
  const [reports, setReports] = useState<MirrorReport[]>([])
  const [tradeCount, setTradeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      getMirrors(user.uid),
      selectedAccount ? getTrades(user.uid, selectedAccount.id) : Promise.resolve([]),
    ])
      .then(([mirrorData, tradeData]) => {
        setReports(mirrorData)
        setTradeCount(tradeData.length)
        if (mirrorData.length > 0) setActiveId(mirrorData[0].id)
      })
      .catch(() => { setReports([]); setTradeCount(0) })
      .finally(() => setLoading(false))
  }, [user, selectedAccount])

  const handleGenerate = async () => {
    if (!user || !selectedAccount) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          accountId: selectedAccount.id,
          accountName: selectedAccount.name,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to generate report')
      }
      const data = await res.json() as { report: MirrorReport }
      const newReports = [data.report, ...reports]
      setReports(newReports)
      setActiveId(data.report.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = tradeCount >= 10
  const activeReport = reports.find(r => r.id === activeId) ?? reports[0] ?? null

  const periodLabel = activeReport
    ? (() => {
        try { return format(new Date(activeReport.period + '-01'), 'MMMM yyyy') } catch { return activeReport.period }
      })()
    : null

  const generatedAt = activeReport
    ? (() => {
        try { return format(new Date(activeReport.createdAt), 'MMMM d, yyyy') } catch { return activeReport.createdAt }
      })()
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.04em' }}>
            The Mirror
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            Your personal trading coach — an honest narrative report on your performance
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 18px',
            borderRadius: 10,
            border: `1px solid ${canGenerate ? 'var(--green)' : 'var(--border)'}`,
            background: canGenerate ? 'var(--green-bg)' : 'transparent',
            color: canGenerate ? 'var(--green)' : 'var(--fg-muted)',
            fontSize: '0.8125rem', fontWeight: 500,
            cursor: canGenerate ? 'pointer' : 'not-allowed',
            opacity: generating ? 0.65 : 1,
            fontFamily: 'inherit',
            letterSpacing: '-0.015em',
            transition: 'opacity 0.15s',
          }}
        >
          {generating ? (
            <>
              <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid var(--green)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
              Generating…
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.875rem' }}>✦</span>
              New Report
            </>
          )}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.8125rem', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {!canGenerate && (
        <div style={{
          padding: '16px 18px', borderRadius: 12,
          background: 'var(--bg-sub,rgba(0,0,0,0.03))',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: '1rem', marginTop: 1 }}>🔒</span>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              {10 - tradeCount} more {10 - tradeCount === 1 ? 'trade' : 'trades'} to unlock The Mirror
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.55 }}>
              You have {tradeCount} trades logged. The Mirror needs at least 10 trades to deliver meaningful coaching insights.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '32px 36px',
        }}>
          <LoadingPulse />
        </div>
      ) : reports.length === 0 ? (
        /* Empty state */
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '64px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--bg-sub,rgba(0,0,0,0.04))',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
          }}>
            🪞
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.025em' }}>
              No reports yet
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--fg-muted)', maxWidth: 340, lineHeight: 1.6 }}>
              {canGenerate
                ? 'Click "New Report" above to generate your first coaching letter from your trading data.'
                : 'Log at least 10 trades and then generate your first Mirror report.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-4 items-start">
          {/* Sidebar — report history */}
          {reports.length > 1 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '8px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <p style={{ padding: '6px 16px 8px', margin: 0, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
                Reports
              </p>
              {reports.map(r => (
                <ReportCard
                  key={r.id}
                  report={r}
                  active={r.id === (activeId ?? reports[0]?.id)}
                  onClick={() => setActiveId(r.id)}
                />
              ))}
            </div>
          )}

          {/* Main letter */}
          <div
            className={reports.length > 1 ? 'lg:col-span-3' : 'lg:col-span-4'}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}
          >
            {/* Letter header */}
            <div style={{
              padding: '22px 32px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1rem' }}>🪞</span>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
                    The Mirror
                  </p>
                  {periodLabel && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 20,
                      background: 'var(--green-bg)', border: '1px solid rgba(22,163,74,0.2)',
                      fontSize: '0.6875rem', fontWeight: 500, color: 'var(--green)',
                    }}>
                      {periodLabel}
                    </span>
                  )}
                </div>
                {generatedAt && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--fg-dim)', letterSpacing: '-0.01em' }}>
                    Generated {generatedAt} · {activeReport?.tradeCount} trades analyzed
                  </p>
                )}
              </div>
            </div>

            {/* Letter body */}
            <div style={{ padding: '28px 32px 36px' }}>
              {generating && !activeReport ? (
                <LoadingPulse />
              ) : activeReport ? (
                <NarrativeBody text={activeReport.narrative} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  )
}

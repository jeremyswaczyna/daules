'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const confirmBg    = variant === 'destructive' ? 'rgba(220,38,38,0.12)' : 'var(--fg)'
  const confirmColor = variant === 'destructive' ? '#f87171' : 'var(--bg)'
  const confirmBd    = variant === 'destructive' ? '1px solid rgba(220,38,38,0.35)' : 'none'

  const content = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'cdFadeIn 0.18s ease both',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 24px 20px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'cdSlideIn 0.28s cubic-bezier(0.34,1.4,0.64,1) both',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <h3 style={{
          margin: 0, fontSize: '1rem', fontWeight: 600,
          color: 'var(--fg)', letterSpacing: '-0.03em',
        }}>
          {title}
        </h3>
        <p style={{
          margin: '0 0 12px', fontSize: '0.875rem',
          color: 'var(--fg-muted)', lineHeight: 1.5,
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 9999,
              background: 'var(--bg-sub)', border: '1px solid var(--border)',
              color: 'var(--fg-muted)', fontSize: '0.875rem', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 9999,
              background: confirmBg, border: confirmBd,
              color: confirmColor, fontSize: '0.875rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cdFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cdSlideIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  )

  return createPortal(content, document.body)
}

'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Upload, Trash2, ExternalLink, Loader, X } from 'lucide-react'
import { uploadCertificate, deleteCertificate } from '@/lib/storage/certificates'
import { updateAccount } from '@/lib/firestore/accounts'
import type { Account, AccountCertificate } from '@/types'

interface Props {
  account:   Account
  onUpdated: (updated: Account) => void
}

export default function CertificateUpload({ account, onUpdated }: Props) {
  const inputRef       = useRef<HTMLInputElement>(null)
  const [uploading,    setUploading]    = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [error,        setError]        = useState('')
  const [dragOver,     setDragOver]     = useState(false)
  const [previewCert,  setPreviewCert]  = useState<AccountCertificate | null>(null)

  const certs      = account.certificates ?? []
  const showPrompt = (account.status === 'Passed' || account.type === 'funded') && certs.length === 0

  const handleFile = async (file: File) => {
    if (!file.type.includes('pdf')) { setError('Only PDF files are supported'); return }
    setError('')
    setUploading(true)
    setProgress(0)
    try {
      const url      = await uploadCertificate(account.uid, account.id, file, pct => setProgress(pct))
      const newCert: AccountCertificate = {
        name:       file.name,
        url,
        uploadedAt: new Date().toISOString(),
      }
      const updated: Account = { ...account, certificates: [...certs, newCert] }
      await updateAccount(account.uid, account.id, { certificates: updated.certificates })
      onUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (cert: AccountCertificate) => {
    const updated: Account = {
      ...account,
      certificates: certs.filter(c => c.url !== cert.url),
    }
    await updateAccount(account.uid, account.id, { certificates: updated.certificates })
    deleteCertificate(cert.url).catch(() => {})
    onUpdated(updated)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Status-triggered dropzone (Passed/Funded, no certs yet) ─── */}
      {showPrompt && !uploading && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            padding: '20px 16px',
            borderRadius: 10,
            border: `1.5px dashed ${dragOver ? 'var(--fg-dim)' : 'rgba(74,222,128,0.35)'}`,
            background: dragOver ? 'rgba(74,222,128,0.04)' : 'rgba(74,222,128,0.02)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(74,222,128,0.05)'
            e.currentTarget.style.borderColor = 'rgba(74,222,128,0.55)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(74,222,128,0.02)'
            e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)'
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.22)',
          }}>
            <Upload size={14} style={{ color: '#4ade80' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              Upload Passing Letter
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--fg-muted)' }}>
              PDF — drag & drop or click
            </p>
          </div>
        </div>
      )}

      {/* ── Upload progress ──────────────────────────────────── */}
      {uploading && (
        <div style={{
          padding: '12px 14px', borderRadius: 9,
          background: 'var(--bg-sub)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Loader size={13} style={{ color: 'var(--fg-muted)', animation: 'certSpin 1s linear infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{
              height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 99, width: `${progress}%`,
                background: '#4ade80',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', flexShrink: 0 }}>
            {progress}%
          </span>
        </div>
      )}

      {/* ── Certificate chips (horizontal scroll) ───────────── */}
      {certs.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}>
          {certs.map(cert => (
            <CertChip
              key={cert.url}
              cert={cert}
              onPreview={() => setPreviewCert(cert)}
              onDelete={() => handleDelete(cert)}
            />
          ))}
        </div>
      )}

      {/* ── Add more button (when certs already exist) ──────── */}
      {(certs.length > 0 || (!showPrompt && !uploading)) && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 7, alignSelf: 'flex-start',
            background: 'transparent', border: '1px dashed var(--border)',
            color: 'var(--fg-muted)', fontSize: '0.75rem',
            cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            transition: 'border-color 0.12s, color 0.12s',
            opacity: uploading ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor = 'var(--fg-dim)'; e.currentTarget.style.color = 'var(--fg)' } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)' }}
        >
          <Upload size={11} />
          {certs.length > 0 ? 'Add another' : 'Attach certificate PDF'}
        </button>
      )}

      {error && (
        <p style={{ fontSize: '0.6875rem', color: 'var(--red)', margin: 0 }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      <style>{`
        @keyframes certSpin { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── PDF preview modal ────────────────────────────────── */}
      {previewCert && typeof document !== 'undefined' && createPortal(
        <PDFPreviewModal cert={previewCert} onClose={() => setPreviewCert(null)} />,
        document.body
      )}
    </div>
  )
}

// ── Certificate chip ──────────────────────────────────────────────────────────
function CertChip({ cert, onPreview, onDelete }: {
  cert:      AccountCertificate
  onPreview: () => void
  onDelete:  () => void
}) {
  const [hov, setHov] = useState(false)
  const short = cert.name.length > 22 ? cert.name.slice(0, 20) + '…' : cert.name

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 10px', borderRadius: 8, flexShrink: 0,
        background: hov ? 'var(--bg-sub)' : 'var(--bg-card)',
        border: '1px solid var(--border)',
        transition: 'background 0.12s',
        cursor: 'default',
      }}
    >
      <FileText size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      <button
        onClick={onPreview}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: '0.75rem', color: 'var(--fg)', fontFamily: 'inherit',
          letterSpacing: '-0.01em', maxWidth: 160,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
        title={cert.name}
      >
        {short}
      </button>
      <a
        href={cert.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        style={{ color: 'var(--fg-dim)', display: 'flex', flexShrink: 0 }}
      >
        <ExternalLink size={11} />
      </a>
      <button
        onClick={onDelete}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--fg-xdim)', display: 'flex', flexShrink: 0,
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-xdim)' }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ── PDF preview modal ─────────────────────────────────────────────────────────
function PDFPreviewModal({ cert, onClose }: {
  cert:    AccountCertificate
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: 'certBdIn 0.18s ease both',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 760,
          height: 'calc(100vh - 80px)',
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 14, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
          animation: 'certCardIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <FileText size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <span style={{
              fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)',
              letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cert.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <a
              href={cert.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7,
                background: 'var(--bg-sub)', border: '1px solid var(--border)',
                color: 'var(--fg-muted)', fontSize: '0.75rem', fontFamily: 'inherit',
                textDecoration: 'none', transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--fg)'
                el.style.borderColor = 'var(--fg-dim)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--fg-muted)'
                el.style.borderColor = 'var(--border)'
              }}
            >
              <ExternalLink size={11} />
              Open
            </a>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-sub)', border: '1px solid var(--border)',
                color: 'var(--fg-dim)', cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-dim)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* PDF embed */}
        <object
          data={cert.url}
          type="application/pdf"
          style={{ flex: 1, width: '100%', border: 'none', minHeight: 0 }}
        >
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: 40, color: 'var(--fg-muted)',
          }}>
            <FileText size={32} style={{ opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              PDF preview not available in this browser.
            </p>
            <a
              href={cert.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--fg)', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Open in new tab →
            </a>
          </div>
        </object>
      </div>

      <style>{`
        @keyframes certBdIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes certCardIn {
          from { opacity:0; transform: scale(0.95) translateY(10px) }
          to   { opacity:1; transform: scale(1)    translateY(0)    }
        }
      `}</style>
    </div>
  )
}

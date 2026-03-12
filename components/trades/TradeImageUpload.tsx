'use client'

import { useRef, useState } from 'react'
import { X, ImagePlus, Loader } from 'lucide-react'
import { uploadTradeImage, deleteTradeImage } from '@/lib/storage/trades'

const MAX_IMAGES = 5

interface UploadingItem {
  tempId: string
  name: string
  progress: number
  preview: string
}

interface Props {
  uid: string
  urls: string[]
  onChange: (urls: string[]) => void
}

export default function TradeImageUpload({ uid, urls, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<UploadingItem[]>([])
  const [error, setError] = useState('')

  const canAddMore = urls.length + uploading.length < MAX_IMAGES

  const handleFiles = async (files: FileList) => {
    setError('')
    const fileArr = Array.from(files).slice(0, MAX_IMAGES - urls.length - uploading.length)
    if (fileArr.length === 0) return

    const items: UploadingItem[] = fileArr.map(f => ({
      tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      progress: 0,
      preview: URL.createObjectURL(f),
    }))
    setUploading(prev => [...prev, ...items])

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i]
      const item = items[i]
      try {
        const url = await uploadTradeImage(uid, file, item.tempId, pct => {
          setUploading(prev =>
            prev.map(u => u.tempId === item.tempId ? { ...u, progress: pct } : u)
          )
        })
        onChange([...urls, url])
        URL.revokeObjectURL(item.preview)
        setUploading(prev => prev.filter(u => u.tempId !== item.tempId))
      } catch {
        setError(`Failed to upload ${file.name}`)
        setUploading(prev => prev.filter(u => u.tempId !== item.tempId))
      }
    }
  }

  const handleRemove = async (url: string) => {
    onChange(urls.filter(u => u !== url))
    try { await deleteTradeImage(url) } catch { /* no-op */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Thumbnail grid */}
      {(urls.length > 0 || uploading.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {/* Uploaded images */}
          {urls.map(url => (
            <div key={url} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={url} alt="Trade screenshot"
                style={{ width: '100%', height: '100%', objectFit: 'cover', border: '1px solid var(--border)' }}
              />
              <button
                onClick={() => handleRemove(url)}
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.65)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#fff',
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Uploading previews */}
          {uploading.map(item => (
            <div key={item.tempId} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={item.preview} alt="Uploading"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, border: '1px solid var(--border)' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.45)',
                gap: 4,
              }}>
                <Loader size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.5625rem', color: '#fff', fontWeight: 600 }}>{item.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {canAddMore && (
        <button
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8,
            background: 'var(--bg-sub)', border: '1px dashed var(--border)',
            color: 'var(--fg-muted)', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: 'inherit',
            transition: 'border-color 0.12s, color 0.12s',
            alignSelf: 'flex-start',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--fg-dim)'
            e.currentTarget.style.color = 'var(--fg)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--fg-muted)'
          }}
        >
          <ImagePlus size={13} />
          Add screenshot
          {MAX_IMAGES - urls.length - uploading.length < MAX_IMAGES && (
            <span style={{ opacity: 0.55 }}>({MAX_IMAGES - urls.length - uploading.length} left)</span>
          )}
        </button>
      )}

      {error && (
        <p style={{ fontSize: '0.6875rem', color: 'var(--red)', margin: 0 }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files) handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

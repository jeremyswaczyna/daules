'use client'

import { useRef, useState } from 'react'
import { updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { uploadAvatar } from '@/lib/storage/avatars'
import type { User } from 'firebase/auth'

interface Props {
  user: User
  onUpdated: (photoURL: string) => void
}

export default function ProfilePictureUpload({ user, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setProgress(0)
    try {
      const url = await uploadAvatar(user.uid, file, pct => setProgress(pct))
      await updateProfile(auth.currentUser!, { photoURL: url })
      onUpdated(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setProgress(null)
    }
  }

  const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'U'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* Avatar preview */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={displayName}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              objectFit: 'cover', border: '2px solid var(--border)',
            }}
          />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', fontWeight: 600, color: 'var(--bg)',
            border: '2px solid var(--border)',
          }}>
            {initial}
          </div>
        )}

        {/* Progress ring overlay */}
        {progress !== null && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#fff' }}>
              {progress}%
            </span>
          </div>
        )}
      </div>

      {/* Upload button + info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Profile Picture
        </p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--fg-dim)', margin: '0 0 10px' }}>
          JPG, PNG or GIF · max 10 MB
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          style={{
            padding: '6px 14px', borderRadius: 9999, border: '1px solid var(--border)',
            background: 'var(--bg-sub)', color: 'var(--fg)',
            fontSize: '0.75rem', cursor: progress !== null ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: progress !== null ? 0.6 : 1,
          }}
        >
          {progress !== null ? `Uploading ${progress}%` : 'Change photo'}
        </button>
        {error && (
          <p style={{ fontSize: '0.6875rem', color: 'var(--red)', marginTop: 6 }}>{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

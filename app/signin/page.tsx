'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import ParticleCanvas from '@/components/ParticleCanvas'
import DaulesLogo from '@/components/ui/DaulesLogo'

// ── palettes ───────────────────────────────────────────────────────────────
const DARK = {
  bg:                '#0d0d0d',
  fg:                '#fff',
  fgMuted:           'rgba(255,255,255,0.42)',
  fgDim:             'rgba(255,255,255,0.20)',
  fgXdim:            'rgba(255,255,255,0.11)',
  border:            'rgba(255,255,255,0.07)',
  cardBg:            'rgba(6,6,6,0.88)',
  cardShadow:        '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
  cardLine:          'linear-gradient(90deg,transparent,rgba(255,255,255,.10) 40%,rgba(255,255,255,.10) 60%,transparent)',
  vignette:          'radial-gradient(ellipse 75% 75% at 50% 50%,transparent 25%,rgba(0,0,0,.60) 100%)',
  submitBg:          'rgba(255,255,255,0.94)',
  submitBgHover:     'rgba(255,255,255,0.80)',
  submitFg:          '#080808',
  inputFg:           '#fff',
  labelFg:           'rgba(255,255,255,0.24)',
  labelFgFocus:      'rgba(255,255,255,0.38)',
  inputBg:           'rgba(255,255,255,0.03)',
  inputBgFocus:      'rgba(255,255,255,0.06)',
  inputBorder:       'rgba(255,255,255,0.07)',
  inputBorderFocus:  'rgba(255,255,255,0.16)',
  gBg:               'rgba(255,255,255,0.04)',
  gBgHover:          'rgba(255,255,255,0.07)',
  gBorder:           'rgba(255,255,255,0.08)',
  gBorderHover:      'rgba(255,255,255,0.13)',
  gFg:               'rgba(255,255,255,0.62)',
  gFgHover:          'rgba(255,255,255,0.85)',
  toggleUl:          'rgba(255,255,255,0.18)',
  optionBg:          '#111',
  font:              "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
}

const LIGHT = {
  bg:                '#f4f3f1',
  fg:                '#0d0d0d',
  fgMuted:           'rgba(0,0,0,0.48)',
  fgDim:             'rgba(0,0,0,0.32)',
  fgXdim:            'rgba(0,0,0,0.10)',
  border:            'rgba(0,0,0,0.09)',
  cardBg:            'rgba(252,251,249,0.88)',
  cardShadow:        '0 20px 56px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(255,255,255,0.55)',
  cardLine:          'linear-gradient(90deg,transparent,rgba(0,0,0,.06) 40%,rgba(0,0,0,.06) 60%,transparent)',
  vignette:          'radial-gradient(ellipse 75% 75% at 50% 50%,transparent 25%,rgba(210,208,204,.55) 100%)',
  submitBg:          '#0d0d0d',
  submitBgHover:     '#2a2a2a',
  submitFg:          '#fff',
  inputFg:           '#0d0d0d',
  labelFg:           'rgba(0,0,0,0.36)',
  labelFgFocus:      'rgba(0,0,0,0.56)',
  inputBg:           'rgba(0,0,0,0.025)',
  inputBgFocus:      'rgba(0,0,0,0.05)',
  inputBorder:       'rgba(0,0,0,0.09)',
  inputBorderFocus:  'rgba(0,0,0,0.22)',
  gBg:               'rgba(0,0,0,0.03)',
  gBgHover:          'rgba(0,0,0,0.06)',
  gBorder:           'rgba(0,0,0,0.10)',
  gBorderHover:      'rgba(0,0,0,0.18)',
  gFg:               'rgba(0,0,0,0.52)',
  gFgHover:          'rgba(0,0,0,0.80)',
  toggleUl:          'rgba(0,0,0,0.18)',
  optionBg:          '#fff',
  font:              "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
}
// ───────────────────────────────────────────────────────────────────────────

const EXPERIENCE_LEVELS = [
  { value: '',             label: 'Select level…' },
  { value: 'beginner',     label: 'Beginner — less than 1 year' },
  { value: 'intermediate', label: 'Intermediate — 1–3 years' },
  { value: 'advanced',     label: 'Advanced — 3–7 years' },
  { value: 'professional', label: 'Professional — 7+ years' },
]

export default function SignInPage() {
  const router = useRouter()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mode,  setMode]  = useState<'signin' | 'signup'>('signin')

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [fullName,   setFullName]   = useState('')
  const [dob,        setDob]        = useState('')
  const [experience, setExperience] = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [resetSent,  setResetSent]  = useState(false)

  // Sync data-theme → ParticleCanvas reads it
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const C = theme === 'dark' ? DARK : LIGHT

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next)
    setError('')
    if (next === 'signin') { setFullName(''); setDob(''); setExperience('') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        if (fullName.trim()) await updateProfile(cred.user, { displayName: fullName.trim() })
      }
      router.push('/dashboard')
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Authentication failed'
      setError(raw.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/g, '').trim())
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email above to reset your password.'); return }
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Reset failed'
      setError(raw.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/g, '').trim())
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      router.push('/dashboard')
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(raw.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/g, '').trim())
    } finally {
      setLoading(false)
    }
  }

  const isSignUp = mode === 'signup'

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.font,
      WebkitFontSmoothing: 'antialiased',
      overflow: 'hidden',
      padding: '40px 20px',
      transition: 'background 0.3s ease',
    }}>

      {/* Particle canvas */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.95 }}>
        <ParticleCanvas />
      </div>

      {/* Vignette */}
      <div style={{
        position: 'fixed', inset: 0,
        background: C.vignette,
        pointerEvents: 'none', zIndex: 1,
        transition: 'background 0.3s ease',
      }} />

      {/* Dynamic notch */}
      <DynamicNotch theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />

      {/* Card */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: isSignUp ? 420 : 390,
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: C.cardShadow,
        overflow: 'hidden',
        transition: 'max-width 0.3s ease, background 0.3s ease, box-shadow 0.3s ease',
      }}>

        {/* Top edge shimmer */}
        <div style={{ height: 1, background: C.cardLine }} />

        <div style={{ padding: isSignUp ? '32px 34px 30px' : '36px 34px 34px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            {/* Logo mark — icon only, no text */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 54, height: 54, borderRadius: 14,
              background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              marginBottom: 18,
              transition: 'background 0.3s',
            }}>
              <DaulesLogo size={30} color={C.fg} />
            </div>
            <span style={{
              display: 'block',
              fontSize: '0.625rem',
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              color: C.fgDim,
              marginBottom: 6,
              fontWeight: 600,
              transition: 'color 0.3s',
            }}>
              {isSignUp ? 'Create account' : 'Welcome back'}
            </span>
            {isSignUp && (
              <p style={{
                margin: '4px 0 0',
                fontSize: '0.8125rem',
                color: C.fgMuted,
                letterSpacing: '-0.01em',
                lineHeight: 1.5,
                transition: 'color 0.3s',
              }}>
                Start tracking your trades and building better habits.
              </p>
            )}
          </div>

          {/* Google */}
          <GoogleButton onClick={handleGoogle} disabled={loading} C={C} />

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.fgXdim, transition: 'background 0.3s' }} />
            <span style={{
              fontSize: '0.625rem', letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.fgDim, transition: 'color 0.3s',
            }}>or</span>
            <div style={{ flex: 1, height: 1, background: C.fgXdim, transition: 'background 0.3s' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>

            {isSignUp && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Full name" type="text" value={fullName}
                  placeholder="Your name" onChange={setFullName} required={false} C={C} />
                <SelectField label="Experience" value={experience}
                  options={EXPERIENCE_LEVELS} onChange={setExperience} C={C} />
              </div>
            )}

            {isSignUp && (
              <Field label="Date of birth" type="date" value={dob}
                placeholder="" onChange={setDob} required={false} C={C} />
            )}

            <Field label="Email" type="email" value={email}
              placeholder="you@example.com" onChange={setEmail} C={C} />
            <Field label="Password" type="password" value={password}
              placeholder="••••••••" onChange={setPassword} C={C} />

            {/* Remember me + Forgot password — sign-in only */}
            {!isSignUp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: 13, height: 13, accentColor: C.fg, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: C.fgDim, letterSpacing: '-0.01em', transition: 'color 0.3s' }}>
                    Remember me
                  </span>
                </label>
                <div style={{ flex: 1 }} />
                {resetSent
                  ? <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>Reset email sent</span>
                  : (
                    <button type="button" onClick={handleForgotPassword} style={{
                      background: 'none', border: 'none', padding: 0,
                      fontSize: '0.8rem', color: C.fgDim, cursor: 'pointer',
                      letterSpacing: '-0.01em', fontFamily: C.font,
                      transition: 'color 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.fgMuted }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.fgDim }}
                    >
                      Forgot password?
                    </button>
                  )
                }
              </div>
            )}

            {error && (
              <p style={{
                margin: '1px 0 0', fontSize: '0.8125rem',
                color: '#ef4444', letterSpacing: '-0.01em', lineHeight: 1.4,
              }}>
                {error}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                marginTop: 6, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0', minHeight: 44,
                background: loading ? C.submitBgHover : C.submitBg,
                border: 'none', borderRadius: 11,
                color: C.submitFg,
                fontSize: '0.875rem', fontWeight: 500,
                letterSpacing: '-0.02em',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: C.font,
                transition: 'background 0.15s, transform 0.1s',
                boxShadow: theme === 'light' ? '0 1px 4px rgba(0,0,0,0.16)' : '0 1px 4px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.submitBgHover }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.submitBg }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {loading
                ? <DaulesLogo size={18} color={C.submitFg} loading={true} />
                : isSignUp ? 'Create account' : 'Sign in'
              }
            </button>
          </form>

          {/* Toggle */}
          <p style={{
            marginTop: 22, textAlign: 'center',
            fontSize: '0.8125rem', color: C.fgDim, letterSpacing: '-0.01em',
            transition: 'color 0.3s',
          }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
              style={{
                background: 'none', border: 'none',
                color: C.fgMuted, fontSize: '0.8125rem',
                letterSpacing: '-0.01em', cursor: 'pointer',
                fontFamily: C.font, padding: 0,
                textDecoration: 'underline', textUnderlineOffset: 3,
                textDecorationColor: C.toggleUl,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = C.fg }}
              onMouseLeave={e => { e.currentTarget.style.color = C.fgMuted }}
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Dynamic Notch ──────────────────────────────────────────────────────────
function DynamicNotch({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 18px 11px',
        background: 'rgba(8,8,8,0.92)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderTop: 'none',
        borderRadius: '0 0 18px 18px',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.30), inset 0 -1px 0 rgba(255,255,255,0.04)',
        transition: 'box-shadow 0.2s',
        userSelect: 'none',
      }}
    >
      {/* Logo icon only */}
      <a
        href="/home.html"
        style={{
          display: 'flex', alignItems: 'center',
          textDecoration: 'none',
          color: 'rgba(255,255,255,0.82)',
          transition: 'color 0.15s, opacity 0.15s',
          opacity: 0.82,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.82' }}
      >
        <DaulesLogo size={16} color="rgba(255,255,255,0.90)" />
      </a>

      {/* Separator */}
      <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.10)' }} />

      {/* Theme toggle */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 6,
          background: hovered ? 'rgba(255,255,255,0.10)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.70)',
          transition: 'background 0.15s, color 0.15s',
          padding: 0,
        }}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  )
}


function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5"  />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ── Google button ──────────────────────────────────────────────────────────
function GoogleButton({ onClick, disabled, C }: {
  onClick: () => void
  disabled: boolean
  C: typeof DARK
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 10, padding: '10px 16px',
        background: hover ? C.gBgHover : C.gBg,
        border: `1px solid ${hover ? C.gBorderHover : C.gBorder}`,
        borderRadius: 11,
        color: hover ? C.gFgHover : C.gFg,
        fontSize: '0.875rem', fontWeight: 400, letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: "'Inter', sans-serif",
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335" />
      </svg>
      Continue with Google
    </button>
  )
}

// ── Field ──────────────────────────────────────────────────────────────────
function Field({ label, type, value, placeholder, onChange, required = true, C }: {
  label: string; type: string; value: string; placeholder: string
  onChange: (v: string) => void; required?: boolean; C: typeof DARK
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.625rem', fontWeight: 500,
        letterSpacing: '0.10em', textTransform: 'uppercase',
        color: focused ? C.labelFgFocus : C.labelFg,
        marginBottom: 7, transition: 'color 0.15s',
      }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder} required={required}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '9px 12px',
          background: focused ? C.inputBgFocus : C.inputBg,
          border: `1px solid ${focused ? C.inputBorderFocus : C.inputBorder}`,
          borderRadius: 10, color: C.inputFg,
          fontSize: '0.875rem', fontFamily: "'Inter', sans-serif",
          outline: 'none', letterSpacing: '-0.01em', boxSizing: 'border-box',
          transition: 'border-color 0.15s, background 0.15s, color 0.15s',
          colorScheme: 'dark',
        }}
      />
    </div>
  )
}

// ── SelectField ────────────────────────────────────────────────────────────
function SelectField({ label, value, options, onChange, C }: {
  label: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void; C: typeof DARK
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.625rem', fontWeight: 500,
        letterSpacing: '0.10em', textTransform: 'uppercase',
        color: focused ? C.labelFgFocus : C.labelFg,
        marginBottom: 7, transition: 'color 0.15s',
      }}>
        {label}
      </label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '9px 12px',
          background: focused ? C.inputBgFocus : C.inputBg,
          border: `1px solid ${focused ? C.inputBorderFocus : C.inputBorder}`,
          borderRadius: 10,
          color: value ? C.inputFg : C.labelFg,
          fontSize: '0.875rem', fontFamily: "'Inter', sans-serif",
          outline: 'none', letterSpacing: '-0.01em', boxSizing: 'border-box',
          cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
          transition: 'border-color 0.15s, background 0.15s, color 0.15s',
          colorScheme: 'dark',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}
            style={{ background: C.optionBg, color: C.inputFg }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

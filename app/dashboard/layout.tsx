'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getAccounts } from '@/lib/firestore/accounts'
import { AccountContext } from '@/lib/account-context'
import type { Account } from '@/types'
import Sidebar from '@/components/dashboard/Sidebar'
import TopBar from '@/components/dashboard/TopBar'
import PageTransition from '@/components/dashboard/PageTransition'
import SubtleNeuralBackground from '@/components/dashboard/SubtleNeuralBackground'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    const stored = localStorage.getItem('daules-theme') as 'light' | 'dark' | null
    const initial = stored ?? 'light'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('daules-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }
  return { theme, toggleTheme }
}

const TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/trades': 'Trades',
  '/dashboard/performance': 'Performance',
  '/dashboard/accounts': 'Accounts',
  '/dashboard/playbook': 'Playbook',
  '/dashboard/review': 'Review',
  '/dashboard/insights': 'Insights',
  '/dashboard/settings': 'Settings',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [cumulative, setCumulative] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { router.push('/signin'); return }
      setUser(firebaseUser)
      setAuthLoading(false)
      try {
        const accs = await getAccounts(firebaseUser.uid)
        setAccounts(accs)
        if (accs.length > 0) setSelectedAccount(accs[0])
      } catch { /* no accounts yet */ }
    })
    return () => unsub()
  }, [router])

  const handleSignOut = async () => { await signOut(auth); router.push('/signin') }

  // null selection = cumulative mode
  const handleSelectAccount = (acc: Account | null) => {
    if (acc === null) { setCumulative(true); setSelectedAccount(null) }
    else { setCumulative(false); setSelectedAccount(acc) }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--fg)', animation: 'spin 0.6s linear infinite' }} />
      </div>
    )
  }
  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', color: 'var(--fg)', position: 'relative' }}>
      <SubtleNeuralBackground />
      <Sidebar
        user={user}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onSelectAccount={handleSelectAccount}
        cumulative={cumulative}
        pathname={pathname}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={handleSignOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} pageTitle={TITLES[pathname]} />
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          <AccountContext.Provider value={{ selectedAccount, setSelectedAccount, accounts, user }}>
            <PageTransition>{children}</PageTransition>
          </AccountContext.Provider>
        </main>
      </div>
    </div>
  )
}

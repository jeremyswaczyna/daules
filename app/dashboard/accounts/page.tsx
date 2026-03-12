'use client'

import { useState, useEffect } from 'react'
import { useAccount } from '@/lib/account-context'
import { getAccounts } from '@/lib/firestore/accounts'
import type { Account } from '@/types'
import AccountsPageView from '@/components/accounts/AccountsPageView'

export default function AccountsPage() {
  const { user, accounts: ctxAccounts } = useAccount()

  // Seed from context (already loaded by the layout) to avoid a loading flash.
  // Then immediately re-fetch to guarantee fresh data.
  const [accounts, setAccounts] = useState<Account[]>(ctxAccounts)
  const [loading,  setLoading]  = useState(ctxAccounts.length === 0)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getAccounts(user.uid)
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '2px solid var(--border)', borderTopColor: 'var(--fg)',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) return null

  return (
    <AccountsPageView
      accounts={accounts}
      uid={user.uid}
      onAccountsChange={setAccounts}
    />
  )
}

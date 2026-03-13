'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount } from '@/lib/account-context'
import { getAccounts, updateAccount } from '@/lib/firestore/accounts'
import AccountWorkspaceLayout from '@/components/accounts/workspace/AccountWorkspaceLayout'
import type { Account } from '@/types'

export default function AccountWorkspacePage() {
  const params           = useParams()
  const router           = useRouter()
  const { user, accounts: ctxAccounts } = useAccount()

  const accountId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null

  const [account,  setAccount]  = useState<Account | null>(
    ctxAccounts.find(a => a.id === accountId) ?? null
  )
  const [loading,  setLoading]  = useState(!account)

  useEffect(() => {
    if (!user || !accountId) return
    if (account) { setLoading(false); return }

    setLoading(true)
    getAccounts(user.uid)
      .then(all => {
        const found = all.find(a => a.id === accountId)
        if (found) setAccount(found)
        else router.replace('/dashboard/accounts')
      })
      .catch(() => router.replace('/dashboard/accounts'))
      .finally(() => setLoading(false))
  }, [user, accountId, account, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '2px solid var(--border)', borderTopColor: 'var(--fg)',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!account || !user) return null

  const handleUpdated = (updated: Account) => {
    setAccount(updated)
    // Also update Firestore
    updateAccount(user.uid, updated.id, updated).catch(() => {})
  }

  return (
    <AccountWorkspaceLayout
      account={account}
      uid={user.uid}
      onUpdated={handleUpdated}
    />
  )
}

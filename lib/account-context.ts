import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'
import type { Account } from '@/types'

export interface AccountContextValue {
  selectedAccount: Account | null
  setSelectedAccount: (account: Account | null) => void
  accounts: Account[]
  user: User | null
}

export const AccountContext = createContext<AccountContextValue>({
  selectedAccount: null,
  setSelectedAccount: () => {},
  accounts: [],
  user: null,
})

export function useAccount() {
  return useContext(AccountContext)
}

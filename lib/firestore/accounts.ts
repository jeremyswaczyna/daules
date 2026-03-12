import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Account } from '@/types'

function accountsCollection(uid: string) {
  return collection(db, 'users', uid, 'accounts')
}

export async function getAccounts(uid: string): Promise<Account[]> {
  const q = query(accountsCollection(uid), orderBy('createdAt', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Account))
}

export async function addAccount(
  uid: string,
  account: Omit<Account, 'id'>
): Promise<Account> {
  const docRef = await addDoc(accountsCollection(uid), {
    ...account,
    createdAt: new Date().toISOString(),
  })
  return { id: docRef.id, ...account }
}

export async function updateAccount(
  uid: string,
  accountId: string,
  updates: Partial<Omit<Account, 'id'>>
): Promise<void> {
  const accountDoc = doc(db, 'users', uid, 'accounts', accountId)
  await updateDoc(accountDoc, { ...updates })
}

export async function deleteAccount(uid: string, accountId: string): Promise<void> {
  const accountDoc = doc(db, 'users', uid, 'accounts', accountId)
  await deleteDoc(accountDoc)
}

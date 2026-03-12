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
import type { Trade } from '@/types'

function tradesCollection(uid: string, accountId: string) {
  return collection(db, 'users', uid, 'accounts', accountId, 'trades')
}

export async function getTrades(uid: string, accountId: string): Promise<Trade[]> {
  const q = query(tradesCollection(uid, accountId), orderBy('date', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Trade))
}

export async function addTrade(
  uid: string,
  accountId: string,
  trade: Omit<Trade, 'id'>
): Promise<Trade> {
  const docRef = await addDoc(tradesCollection(uid, accountId), {
    ...trade,
    createdAt: new Date().toISOString(),
  })
  return { id: docRef.id, ...trade }
}

export async function updateTrade(
  uid: string,
  accountId: string,
  tradeId: string,
  updates: Partial<Omit<Trade, 'id'>>
): Promise<void> {
  const tradeDoc = doc(db, 'users', uid, 'accounts', accountId, 'trades', tradeId)
  await updateDoc(tradeDoc, { ...updates })
}

export async function deleteTrade(
  uid: string,
  accountId: string,
  tradeId: string
): Promise<void> {
  const tradeDoc = doc(db, 'users', uid, 'accounts', accountId, 'trades', tradeId)
  await deleteDoc(tradeDoc)
}


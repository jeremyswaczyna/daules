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
import type { Setup } from '@/types'

function setupsCollection(uid: string) {
  return collection(db, 'users', uid, 'setups')
}

export async function getSetups(uid: string): Promise<Setup[]> {
  const q = query(setupsCollection(uid), orderBy('createdAt', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Setup))
}

export async function addSetup(
  uid: string,
  setup: Omit<Setup, 'id'>
): Promise<Setup> {
  const docRef = await addDoc(setupsCollection(uid), {
    ...setup,
    createdAt: new Date().toISOString(),
  })
  return { id: docRef.id, ...setup }
}

export async function updateSetup(
  uid: string,
  setupId: string,
  updates: Partial<Omit<Setup, 'id'>>
): Promise<void> {
  const setupDoc = doc(db, 'users', uid, 'setups', setupId)
  await updateDoc(setupDoc, { ...updates })
}

export async function deleteSetup(uid: string, setupId: string): Promise<void> {
  const setupDoc = doc(db, 'users', uid, 'setups', setupId)
  await deleteDoc(setupDoc)
}

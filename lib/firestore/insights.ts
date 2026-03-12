import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Insight } from '@/types'

function insightsCollection(uid: string) {
  return collection(db, 'users', uid, 'insights')
}

export async function getInsights(uid: string, count = 5): Promise<Insight[]> {
  const q = query(insightsCollection(uid), orderBy('createdAt', 'desc'), limit(count))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Insight))
}

export async function saveInsights(
  uid: string,
  insights: Omit<Insight, 'id'>[]
): Promise<Insight[]> {
  const saved: Insight[] = []
  for (const insight of insights) {
    const docRef = await addDoc(insightsCollection(uid), insight)
    saved.push({ id: docRef.id, ...insight })
  }
  return saved
}

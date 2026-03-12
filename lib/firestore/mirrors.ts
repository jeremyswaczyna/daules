import {
  collection, getDocs, query, orderBy, limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { MirrorReport } from '@/types'

export async function getMirrors(uid: string, maxCount = 10): Promise<MirrorReport[]> {
  const ref = collection(db, 'users', uid, 'mirrors')
  const q = query(ref, orderBy('createdAt', 'desc'), limit(maxCount))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MirrorReport))
}

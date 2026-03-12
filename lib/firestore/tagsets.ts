import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface TagSet {
  setup:         string[]
  mistakes:      string[]
  marketContext: string[]
}

const EMPTY: TagSet = { setup: [], mistakes: [], marketContext: [] }

export async function getTagSet(uid: string): Promise<TagSet> {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'tagset'))
  if (!snap.exists()) return EMPTY
  const data = snap.data()
  return {
    setup:         Array.isArray(data.setup)         ? data.setup         : [],
    mistakes:      Array.isArray(data.mistakes)      ? data.mistakes      : [],
    marketContext: Array.isArray(data.marketContext) ? data.marketContext : [],
  }
}

export async function saveTagSet(uid: string, tags: TagSet): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'settings', 'tagset'), tags, { merge: true })
}

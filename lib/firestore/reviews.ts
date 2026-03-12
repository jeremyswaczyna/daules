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
import type { Review } from '@/types'

function reviewsCollection(uid: string, accountId: string) {
  return collection(db, 'users', uid, 'accounts', accountId, 'reviews')
}

export async function getReviews(uid: string, accountId: string): Promise<Review[]> {
  const q = query(reviewsCollection(uid, accountId), orderBy('date', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Review))
}

export async function addReview(
  uid: string,
  accountId: string,
  review: Omit<Review, 'id'>
): Promise<Review> {
  const docRef = await addDoc(reviewsCollection(uid, accountId), {
    ...review,
    createdAt: new Date().toISOString(),
  })
  return { id: docRef.id, ...review }
}

export async function updateReview(
  uid: string,
  accountId: string,
  reviewId: string,
  updates: Partial<Omit<Review, 'id'>>
): Promise<void> {
  const reviewDoc = doc(db, 'users', uid, 'accounts', accountId, 'reviews', reviewId)
  await updateDoc(reviewDoc, { ...updates })
}

export async function deleteReview(
  uid: string,
  accountId: string,
  reviewId: string
): Promise<void> {
  const reviewDoc = doc(db, 'users', uid, 'accounts', accountId, 'reviews', reviewId)
  await deleteDoc(reviewDoc)
}

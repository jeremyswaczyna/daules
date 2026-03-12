import { ref, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { compressImage, validateImageFile } from './image-utils'
import { uploadViaApi } from './upload-via-api'

export async function uploadAvatar(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const validation = validateImageFile(file, 2, ['image/jpeg', 'image/png', 'image/webp'])
  if (!validation.valid) throw new Error(validation.error)

  const compressed = await compressImage(file, 400, 400, 0.85)
  const uploadFile = compressed instanceof File ? compressed : new File([compressed], file.name, { type: 'image/jpeg' })

  return uploadViaApi(uploadFile, `avatars/${uid}.jpg`, onProgress)
}

export async function deleteAvatar(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`))
  } catch { /* no-op if doesn't exist */ }
}

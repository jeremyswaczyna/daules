import { ref, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { compressImage, validateImageFile } from './image-utils'
import { uploadViaApi } from './upload-via-api'

export async function uploadTradeImage(
  uid: string,
  file: File,
  tempId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const validation = validateImageFile(file, 10)
  if (!validation.valid) throw new Error(validation.error)

  // Compress unless GIF
  const payload = file.type !== 'image/gif'
    ? await compressImage(file, 1600, 1600, 0.88)
    : file

  const ext        = file.name.split('.').pop() ?? 'jpg'
  const uploadFile = payload instanceof File
    ? payload
    : new File([payload], `${tempId}.${ext}`, { type: file.type })

  return uploadViaApi(uploadFile, `trades/${uid}/pending/${tempId}.${ext}`, onProgress)
}

export async function deleteTradeImage(url: string): Promise<void> {
  try {
    const path = extractStoragePath(url)
    if (path) await deleteObject(ref(storage, path))
  } catch { /* no-op */ }
}

function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/o\/([^?]+)/)
    if (!match) return null
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

import { ref, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { uploadViaApi } from './upload-via-api'

const MAX_PDF_MB = 10

export async function uploadCertificate(
  uid: string,
  accountId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported')
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`PDF must be under ${MAX_PDF_MB}MB`)

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const storagePath = `certificates/${uid}/${accountId}/${safeName}`

  return uploadViaApi(file, storagePath, onProgress)
}

export async function deleteCertificate(url: string): Promise<void> {
  try {
    const match = url.match(/\/o\/([^?]+)/)
    if (!match) return
    const path = decodeURIComponent(match[1])
    await deleteObject(ref(storage, path))
  } catch { /* no-op */ }
}

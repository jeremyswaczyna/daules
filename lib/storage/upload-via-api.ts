import { auth } from '@/lib/firebase'

/**
 * Upload a file through the /api/upload Next.js route (server-side → Firebase Storage).
 * This bypasses Firebase Storage CORS restrictions entirely.
 * Real upload progress is tracked via XHR.
 */
export function uploadViaApi(
  file: File,
  storagePath: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) { reject(new Error('Not authenticated')); return }

      const idToken = await currentUser.getIdToken()

      const formData = new FormData()
      formData.append('file',    file)
      formData.append('path',    storagePath)
      formData.append('idToken', idToken)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable && e.total > 0) {
          // XHR upload tracks sending to our server (0-85%), reserve 85-100% for Firebase leg
          onProgress?.(Math.round((e.loaded / e.total) * 85))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { url, error } = JSON.parse(xhr.responseText)
            if (error) { reject(new Error(error)); return }
            onProgress?.(100)
            resolve(url)
          } catch {
            reject(new Error('Invalid server response'))
          }
        } else {
          try {
            const { error } = JSON.parse(xhr.responseText)
            reject(new Error(error || `Upload failed (${xhr.status})`))
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`))
          }
        }
      })

      xhr.addEventListener('error',   () => reject(new Error('Network error during upload')))
      xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))

      xhr.open('POST', '/api/upload')
      xhr.timeout = 120_000  // 2 min
      xhr.send(formData)
    } catch (e) {
      reject(e)
    }
  })
}

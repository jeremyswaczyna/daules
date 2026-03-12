const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function validateImageFile(
  file: File,
  maxSizeMB = 10,
  allowedTypes = ALLOWED_TYPES,
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Unsupported file type. Allowed: JPG, PNG, WebP, GIF` }
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File too large. Max ${maxSizeMB}MB` }
  }
  return { valid: true }
}

export function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85,
): Promise<Blob> {
  return new Promise(resolve => {
    // Always fall back to the original file if anything fails — never reject
    const fallback = () => { URL.revokeObjectURL(url); resolve(file) }

    const img = new Image()
    const url = URL.createObjectURL(file)

    // Safety timeout — if the image hasn't loaded in 8s, use the original
    const timer = setTimeout(fallback, 8000)

    img.onload = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      try {
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          blob => resolve(blob ?? file),
          file.type === 'image/gif' ? 'image/gif' : 'image/jpeg',
          quality,
        )
      } catch {
        resolve(file)
      }
    }
    img.onerror = () => { clearTimeout(timer); fallback() }
    img.src = url
  })
}

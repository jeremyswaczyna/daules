import { NextRequest, NextResponse } from 'next/server'

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

// Firebase Storage REST API upload — runs on the server so there are no CORS issues
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file    = formData.get('file')    as File   | null
    const path    = formData.get('path')    as string | null
    const idToken = formData.get('idToken') as string | null

    if (!file || !path || !idToken) {
      return NextResponse.json({ error: 'Missing file, path, or idToken' }, { status: 400 })
    }
    if (!BUCKET) {
      return NextResponse.json({ error: 'Storage bucket not configured' }, { status: 500 })
    }

    const encodedPath = encodeURIComponent(path)
    const uploadUrl   = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`

    const bytes = await file.arrayBuffer()

    const storageRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${idToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: bytes,
    })

    if (!storageRes.ok) {
      const errText = await storageRes.text()
      console.error('[upload/route] Firebase Storage error:', errText)
      return NextResponse.json(
        { error: `Storage upload failed: ${storageRes.status}` },
        { status: storageRes.status },
      )
    }

    const data: { name: string; downloadTokens?: string } = await storageRes.json()
    const token = data.downloadTokens ?? ''
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${token}`

    return NextResponse.json({ url: downloadUrl })
  } catch (err) {
    console.error('[upload/route] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

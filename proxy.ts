import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth protection is handled client-side via Firebase onAuthStateChanged
// in the dashboard layout. This proxy just passes requests through.
export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}

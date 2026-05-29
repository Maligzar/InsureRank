import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password']
const API_AUTH_PREFIX = '/api/auth'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  if (pathname.startsWith(API_AUTH_PREFIX)) return NextResponse.next()

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|workbox).*)'],
}

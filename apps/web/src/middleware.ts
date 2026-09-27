import { type NextRequest, NextResponse } from 'next/server'

// Pages are for signed-in users only; /login is the one door. The API guards itself (401).
// NOTE: checks the cookie is present, not its signature — edge runtime has no node:crypto.
// A forged or expired cookie gets the page shell, every API call 401s and the page bounces to
// /login. Verify the HMAC here with Web Crypto if the shell itself ever becomes sensitive.
export function middleware(req: NextRequest) {
  const signedIn = req.cookies.has('p400_session')
  const onLogin = req.nextUrl.pathname === '/login'
  if (signedIn || onLogin) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  // Everything except the API, Next internals and files with an extension (fonts, openapi.yaml…).
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}

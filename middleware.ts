import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from './lib/payday-auth';

// Routes that don't require auth
const PUBLIC_PAYDAY = ['/payday/login', '/payday/register'];
// API routes handle their own 401s — middleware only covers page routes
const PAYDAY_API = '/api/payday/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept /payday page routes (not API routes — they self-guard)
  if (!pathname.startsWith('/payday') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Auth pages are always public
  if (PUBLIC_PAYDAY.some(p => pathname.startsWith(p)) || pathname.startsWith(PAYDAY_API)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/payday/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/payday/:path*'],
};

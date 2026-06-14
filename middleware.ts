import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'payday_session';
const PUBLIC_PAYDAY = ['/payday/login', '/payday/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/payday')) return NextResponse.next();
  if (PUBLIC_PAYDAY.some(p => pathname.startsWith(p))) return NextResponse.next();

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

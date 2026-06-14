import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { verifyPassword, createSession, SESSION_COOKIE } from '@/lib/payday-auth';

const SESSION_DAYS = 30;

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

  const db = getDb();
  const result = await db.execute({ sql: 'SELECT id, password_hash FROM users WHERE email=?', args: [email.toLowerCase()] });
  const user = result.rows[0];

  // Always run verifyPassword to prevent timing attacks
  const dummyHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const ok = await verifyPassword(password, user ? (user.password_hash as string) : dummyHash);

  if (!user || !ok) return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });

  const token = await createSession(user.id as string);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

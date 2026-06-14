import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/payday-db';
import { hashPassword, createSession, SESSION_COOKIE } from '@/lib/payday-auth';

const SESSION_DAYS = 30;

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  const db = getDb();
  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email=?', args: [email.toLowerCase()] });
  if (existing.rows.length > 0) return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?,?,?,?)',
    args: [id, email.toLowerCase(), passwordHash, new Date().toISOString()],
  });

  const token = await createSession(id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

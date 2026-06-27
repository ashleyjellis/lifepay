import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { exchangeCode } from '@/lib/truelayer';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL('/payday/login', req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/payday/accounts?error=denied', req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO truelayer_connections (id, user_id, access_token, refresh_token, expires_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              access_token = excluded.access_token,
              refresh_token = excluded.refresh_token,
              expires_at = excluded.expires_at`,
      args: [randomUUID(), user.id, tokens.access_token, tokens.refresh_token, expiresAt],
    });
    return NextResponse.redirect(new URL('/payday/accounts', req.url));
  } catch (e) {
    console.error('TrueLayer callback error:', e);
    return NextResponse.redirect(new URL('/payday/accounts?error=failed', req.url));
  }
}

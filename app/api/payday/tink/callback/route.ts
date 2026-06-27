import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { exchangeCode } from '@/lib/tink';
import { getDb } from '@/lib/payday-db';

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
      sql: `UPDATE bank_connections
            SET access_token=?, refresh_token=?, expires_at=?
            WHERE user_id=? AND provider='tink'`,
      args: [tokens.access_token, tokens.refresh_token, expiresAt, user.id],
    });
    return NextResponse.redirect(new URL('/payday/accounts', req.url));
  } catch (e) {
    console.error('Tink callback error:', e);
    return NextResponse.redirect(new URL('/payday/accounts?error=failed', req.url));
  }
}

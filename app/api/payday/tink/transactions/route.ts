import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { fetchTransactions, refreshUserToken } from '@/lib/tink';
import { getDb } from '@/lib/payday-db';

async function getValidToken(userId: string): Promise<string | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT access_token, refresh_token, expires_at FROM bank_connections
          WHERE user_id=? AND provider='tink' AND access_token != ''`,
    args: [userId],
  });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  const expiresAt = new Date(row.expires_at as string);
  if (expiresAt.getTime() - Date.now() < 120_000) {
    try {
      const tokens = await refreshUserToken(row.refresh_token as string);
      const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await db.execute({
        sql: `UPDATE bank_connections SET access_token=?, refresh_token=?, expires_at=? WHERE user_id=? AND provider='tink'`,
        args: [tokens.access_token, tokens.refresh_token, newExpiry, userId],
      });
      return tokens.access_token;
    } catch { return null; }
  }
  return row.access_token as string;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const token = await getValidToken(user.id);
  if (!token) return NextResponse.json({ error: 'Not connected' }, { status: 404 });

  try {
    const transactions = await fetchTransactions(token, accountId);
    return NextResponse.json({ transactions });
  } catch (e) {
    console.error('Tink transactions error:', e);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

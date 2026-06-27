import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { fetchAccounts, fetchBalance, refreshAccessToken } from '@/lib/truelayer';
import { getDb } from '@/lib/payday-db';

async function getValidToken(userId: string): Promise<string | null> {
  const db = getDb();
  const r = await db.execute({
    sql: 'SELECT access_token, refresh_token, expires_at FROM truelayer_connections WHERE user_id=?',
    args: [userId],
  });
  if (!r.rows.length) return null;

  const row = r.rows[0];
  const expiresAt = new Date(row.expires_at as string);
  // Refresh if within 2 minutes of expiry
  if (expiresAt.getTime() - Date.now() < 120_000) {
    try {
      const tokens = await refreshAccessToken(row.refresh_token as string);
      const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await db.execute({
        sql: 'UPDATE truelayer_connections SET access_token=?, refresh_token=?, expires_at=? WHERE user_id=?',
        args: [tokens.access_token, tokens.refresh_token, newExpiry, userId],
      });
      return tokens.access_token;
    } catch {
      return null;
    }
  }
  return row.access_token as string;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await getValidToken(user.id);
  if (!token) return NextResponse.json({ connected: false, accounts: [] });

  try {
    const accounts = await fetchAccounts(token);
    // Fetch balances in parallel
    const withBalances = await Promise.all(
      accounts.map(async (a) => {
        const balance = await fetchBalance(token, a.account_id);
        return { ...a, balance };
      })
    );
    return NextResponse.json({ connected: true, accounts: withBalances });
  } catch (e) {
    console.error('TrueLayer accounts error:', e);
    return NextResponse.json({ connected: true, accounts: [], error: 'Failed to fetch accounts' });
  }
}

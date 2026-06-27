import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { createTinkUser, buildLinkUrl } from '@/lib/tink';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Check if we already have a Tink user ID for this app user
  const existing = await db.execute({
    sql: 'SELECT provider_user_id FROM bank_connections WHERE user_id=? AND provider=?',
    args: [user.id, 'tink'],
  });

  let tinkUserId: string;

  if (existing.rows.length && existing.rows[0].provider_user_id) {
    tinkUserId = existing.rows[0].provider_user_id as string;
  } else {
    // Create a new Tink user keyed to our user id
    tinkUserId = await createTinkUser(user.id);
    // Persist the Tink user ID (tokens come later at callback)
    await db.execute({
      sql: `INSERT INTO bank_connections (id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at)
            VALUES (?, ?, 'tink', ?, '', '', '')
            ON CONFLICT(user_id) DO UPDATE SET provider_user_id=excluded.provider_user_id`,
      args: [randomUUID(), user.id, tinkUserId],
    });
  }

  const linkUrl = await buildLinkUrl(tinkUserId);
  return NextResponse.json({ linkUrl });
}

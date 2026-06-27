import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { createTinkUser, buildLinkUrl } from '@/lib/tink';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Always create a fresh Tink user — avoids stale IDs from previous failed attempts
  let tinkUserId: string;
  try {
    tinkUserId = await createTinkUser(user.id);
    console.log('[Tink connect] created user:', tinkUserId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // 409 = user already exists — extract their existing Tink user ID from DB
    if (msg.includes('409') || msg.includes('already exists')) {
      const existing = await db.execute({
        sql: 'SELECT provider_user_id FROM bank_connections WHERE user_id=? AND provider=?',
        args: [user.id, 'tink'],
      });
      if (existing.rows.length && existing.rows[0].provider_user_id) {
        tinkUserId = existing.rows[0].provider_user_id as string;
        console.log('[Tink connect] reusing existing user:', tinkUserId);
      } else {
        return NextResponse.json({ error: 'User exists in Tink but no ID stored. Please disconnect and retry.' }, { status: 500 });
      }
    } else {
      console.error('[Tink connect] createUser error:', msg);
      return NextResponse.json({ error: `Tink user creation failed: ${msg}` }, { status: 500 });
    }
  }

  // Persist / update the Tink user ID
  await db.execute({
    sql: `INSERT INTO bank_connections (id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at)
          VALUES (?, ?, 'tink', ?, '', '', '')
          ON CONFLICT(user_id) DO UPDATE SET provider_user_id=excluded.provider_user_id`,
    args: [randomUUID(), user.id, tinkUserId],
  });

  try {
    const linkUrl = await buildLinkUrl(tinkUserId);
    console.log('[Tink connect] link URL built OK');
    return NextResponse.json({ linkUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Tink connect] buildLinkUrl error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

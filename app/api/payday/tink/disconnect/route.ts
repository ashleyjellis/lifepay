import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { getDb } from '@/lib/payday-db';

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  await db.execute({
    sql: `DELETE FROM bank_connections WHERE user_id=? AND provider='tink'`,
    args: [user.id],
  });
  return NextResponse.json({ ok: true });
}

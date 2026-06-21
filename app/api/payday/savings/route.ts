import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { getAuthUser } from '@/lib/payday-auth';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json(null, { status: 401 });
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });
  const db = getDb();

  // Sum allocations per pot across ALL locked sessions for this household
  const allocs = await db.execute({
    sql: `SELECT sa.pot_id, SUM(sa.amount) as total_saved
          FROM session_allocations sa
          JOIN payday_sessions ps ON sa.session_id = ps.id
          WHERE ps.household_id = ? AND ps.locked_at IS NOT NULL
          GROUP BY sa.pot_id`,
    args: [householdId],
  });

  const savingsMap: Record<string, number> = {};
  for (const row of allocs.rows) {
    savingsMap[row.pot_id as string] = row.total_saved as number;
  }
  return NextResponse.json(savingsMap);
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const db = getDb();
  await db.execute({
    sql: 'UPDATE savings_pots SET current_balance=? WHERE id=?',
    args: [body.currentBalance ?? null, body.id],
  });
  return NextResponse.json({ ok: true });
}

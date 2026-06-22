import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { getAdminUser } from '@/lib/payday-auth';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();
  const users = await db.execute(`
    SELECT u.id, u.email, u.created_at, u.is_admin,
      (SELECT COUNT(*) FROM auth_sessions s WHERE s.user_id = u.id AND s.expires_at > datetime('now')) as active_sessions,
      (SELECT COUNT(*) FROM households h WHERE h.user_id = u.id) as household_count
    FROM users u
    ORDER BY u.created_at DESC
  `);

  const enriched = await Promise.all(users.rows.map(async (u) => {
    const households = await db.execute({
      sql: `SELECT h.id, h.name, h.mode,
        (SELECT COUNT(*) FROM payday_sessions ps WHERE ps.household_id = h.id) as session_count,
        (SELECT COUNT(*) FROM savings_pots sp WHERE sp.household_id = h.id) as pot_count
        FROM households h WHERE h.user_id = ?`,
      args: [u.id as string],
    });
    return { ...u, households: households.rows };
  }));

  return NextResponse.json(enriched);
}

export async function DELETE(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // Prevent self-deletion
  if (userId === admin.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });

  const db = getDb();

  await clearUserData(userId, db);

  // Delete auth sessions and user
  await db.execute({ sql: 'DELETE FROM auth_sessions WHERE user_id=?', args: [userId] });
  await db.execute({ sql: 'DELETE FROM users WHERE id=?', args: [userId] });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { userId, isAdmin } = body;
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const db = getDb();
  await db.execute({
    sql: 'UPDATE users SET is_admin=? WHERE id=?',
    args: [isAdmin ? 1 : 0, userId],
  });
  return NextResponse.json({ ok: true });
}

async function clearUserData(userId: string, db: ReturnType<typeof getDb>) {
  const households = await db.execute({
    sql: 'SELECT id FROM households WHERE user_id=?',
    args: [userId],
  });
  const householdIds = households.rows.map(r => r.id as string);

  for (const hid of householdIds) {
    const pots = await db.execute({ sql: 'SELECT id FROM savings_pots WHERE household_id=?', args: [hid] });
    const potIds = pots.rows.map(r => r.id as string);
    const sessions = await db.execute({ sql: 'SELECT id FROM payday_sessions WHERE household_id=?', args: [hid] });
    const sessionIds = sessions.rows.map(r => r.id as string);

    for (const sid of sessionIds) {
      await db.execute({ sql: 'DELETE FROM session_allocations WHERE session_id=?', args: [sid] });
    }
    for (const pid of potIds) {
      await db.execute({ sql: 'DELETE FROM session_allocations WHERE pot_id=?', args: [pid] });
    }
    for (const sid of sessionIds) {
      await db.execute({ sql: 'DELETE FROM session_bills WHERE session_id=?', args: [sid] });
    }
    await db.execute({ sql: 'DELETE FROM payday_sessions WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM wealth_snapshots WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM savings_pots WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM bills WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM debt_repayments WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM forecast_events WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM forecast_year_contributions WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM forecast_settings WHERE household_id=?', args: [hid] });
    await db.execute({ sql: 'DELETE FROM households WHERE id=?', args: [hid] });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const db = getDb();
  await clearUserData(userId, db);
  return NextResponse.json({ ok: true });
}

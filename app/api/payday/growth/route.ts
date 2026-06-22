import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { getAuthUser } from '@/lib/payday-auth';
import { randomUUID } from 'crypto';

async function assertHousehold(householdId: string, userId: string) {
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT id FROM households WHERE id=? AND user_id=?', args: [householdId, userId] });
  return r.rows.length > 0;
}

// GET ?householdId=&year=&month=   → snapshots for that month
// GET ?householdId=&year=&annual=1 → all snapshots for that year
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json([], { status: 401 });
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const annual = searchParams.get('annual');
  if (!householdId || !(await assertHousehold(householdId, user.id))) return NextResponse.json([], { status: 403 });
  const db = getDb();
  if (annual) {
    const r = await db.execute({
      sql: 'SELECT * FROM wealth_snapshots WHERE household_id=? AND year=? ORDER BY month, pot_id',
      args: [householdId, year],
    });
    return NextResponse.json(r.rows);
  }
  const r = await db.execute({
    sql: 'SELECT * FROM wealth_snapshots WHERE household_id=? AND year=? AND month=?',
    args: [householdId, year, month],
  });
  return NextResponse.json(r.rows);
}

// POST — upsert a snapshot row
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  if (!(await assertHousehold(body.householdId, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getDb();
  // Check if row exists
  const existing = await db.execute({
    sql: 'SELECT id FROM wealth_snapshots WHERE pot_id=? AND year=? AND month=?',
    args: [body.potId, body.year, body.month],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE wealth_snapshots SET start_balance=?, money_in=?, transfer_out=?, end_balance=? WHERE pot_id=? AND year=? AND month=?',
      args: [body.startBalance, body.moneyIn, body.transferOut, body.endBalance, body.potId, body.year, body.month],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO wealth_snapshots (id, pot_id, household_id, year, month, start_balance, money_in, transfer_out, end_balance) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [randomUUID(), body.potId, body.householdId, body.year, body.month, body.startBalance, body.moneyIn, body.transferOut, body.endBalance],
    });
  }
  return NextResponse.json({ ok: true });
}

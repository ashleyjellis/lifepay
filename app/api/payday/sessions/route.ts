import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { getAuthUser } from '@/lib/payday-auth';
import { randomUUID } from 'crypto';

async function assertHousehold(householdId: string, userId: string) {
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT id FROM households WHERE id=? AND user_id=?', args: [householdId, userId] });
  return r.rows.length > 0;
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json([], { status: 401 });
  const { searchParams } = new URL(req.url);
  const db = getDb();
  const id = searchParams.get('id');

  if (id) {
    // Verify session belongs to user
    const s = await db.execute({ sql: 'SELECT household_id FROM payday_sessions WHERE id=?', args: [id] });
    if (!s.rows[0] || !(await assertHousehold(s.rows[0].household_id as string, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const [session, bills, allocs] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM payday_sessions WHERE id=?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM session_bills WHERE session_id=?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM session_allocations WHERE session_id=?', args: [id] }),
    ]);
    return NextResponse.json({ session: session.rows[0], bills: bills.rows, allocations: allocs.rows });
  }

  const householdId = searchParams.get('householdId');
  if (!householdId || !(await assertHousehold(householdId, user.id))) return NextResponse.json([], { status: 403 });
  const result = await db.execute({
    sql: 'SELECT * FROM payday_sessions WHERE household_id=? ORDER BY date DESC',
    args: [householdId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  if (!(await assertHousehold(body.householdId, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();
  const sessionId = randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO payday_sessions (id, household_id, date, income_a, income_b, starting_balance, spending_a, spending_b, travel_a, travel_b, locked_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      sessionId, body.householdId, body.date,
      body.incomeA ?? 0, body.incomeB ?? 0,
      body.startingBalance ?? 0,
      body.spendingA ?? 0, body.spendingB ?? 0,
      body.travelA ?? 0, body.travelB ?? 0,
      body.lock ? now : null,
    ],
  });

  for (const b of body.bills ?? []) {
    await db.execute({
      sql: 'INSERT INTO session_bills (id, session_id, bill_id, name, amount, category) VALUES (?,?,?,?,?,?)',
      args: [randomUUID(), sessionId, b.billId ?? null, b.name, b.amount, b.category],
    });
  }
  for (const a of body.allocations ?? []) {
    if (a.amount > 0) {
      await db.execute({
        sql: 'INSERT INTO session_allocations (id, session_id, pot_id, amount) VALUES (?,?,?,?)',
        args: [randomUUID(), sessionId, a.potId, a.amount],
      });
    }
  }

  return NextResponse.json({ id: sessionId });
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const db = getDb();
  const s = await db.execute({ sql: 'SELECT household_id FROM payday_sessions WHERE id=?', args: [body.id] });
  if (!s.rows[0] || !(await assertHousehold(s.rows[0].household_id as string, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE payday_sessions SET income_a=?, income_b=?, starting_balance=?, spending_a=?, spending_b=?, travel_a=?, travel_b=?, locked_at=? WHERE id=?`,
    args: [body.incomeA, body.incomeB, body.startingBalance, body.spendingA, body.spendingB, body.travelA, body.travelB, body.lock ? now : null, body.id],
  });
  await db.execute({ sql: 'DELETE FROM session_bills WHERE session_id=?', args: [body.id] });
  await db.execute({ sql: 'DELETE FROM session_allocations WHERE session_id=?', args: [body.id] });
  for (const b of body.bills ?? []) {
    await db.execute({
      sql: 'INSERT INTO session_bills (id, session_id, bill_id, name, amount, category) VALUES (?,?,?,?,?,?)',
      args: [randomUUID(), body.id, b.billId ?? null, b.name, b.amount, b.category],
    });
  }
  for (const a of body.allocations ?? []) {
    if (a.amount > 0) {
      await db.execute({
        sql: 'INSERT INTO session_allocations (id, session_id, pot_id, amount) VALUES (?,?,?,?)',
        args: [randomUUID(), body.id, a.potId, a.amount],
      });
    }
  }
  return NextResponse.json({ ok: true });
}

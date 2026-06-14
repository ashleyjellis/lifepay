import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  const id = searchParams.get('id');
  const db = getDb();

  if (id) {
    const [session, bills, allocs] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM payday_sessions WHERE id=?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM session_bills WHERE session_id=?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM session_allocations WHERE session_id=?', args: [id] }),
    ]);
    return NextResponse.json({ session: session.rows[0], bills: bills.rows, allocations: allocs.rows });
  }

  if (!householdId) return NextResponse.json([], { status: 400 });
  const result = await db.execute({
    sql: 'SELECT * FROM payday_sessions WHERE household_id=? ORDER BY date DESC',
    args: [householdId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
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

  if (body.bills?.length) {
    for (const b of body.bills) {
      await db.execute({
        sql: 'INSERT INTO session_bills (id, session_id, bill_id, name, amount, category) VALUES (?,?,?,?,?,?)',
        args: [randomUUID(), sessionId, b.billId ?? null, b.name, b.amount, b.category],
      });
    }
  }

  if (body.allocations?.length) {
    for (const a of body.allocations) {
      if (a.amount > 0) {
        await db.execute({
          sql: 'INSERT INTO session_allocations (id, session_id, pot_id, amount) VALUES (?,?,?,?)',
          args: [randomUUID(), sessionId, a.potId, a.amount],
        });
      }
    }
  }

  return NextResponse.json({ id: sessionId });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const db = getDb();
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

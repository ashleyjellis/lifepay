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
  const householdId = searchParams.get('householdId');
  if (!householdId || !(await assertHousehold(householdId, user.id))) return NextResponse.json([], { status: 403 });
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM savings_pots WHERE household_id=? ORDER BY sort_order, name',
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
  const id = randomUUID();
  await db.execute({
    sql: 'INSERT INTO savings_pots (id, household_id, name, target_amount, color, sort_order) VALUES (?,?,?,?,?,?)',
    args: [id, body.householdId, body.name, body.targetAmount ?? null, body.color ?? '#6366f1', body.sortOrder ?? 0],
  });
  const result = await db.execute({ sql: 'SELECT * FROM savings_pots WHERE id=?', args: [id] });
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const db = getDb();
  const pot = await db.execute({ sql: 'SELECT household_id FROM savings_pots WHERE id=?', args: [body.id] });
  if (!pot.rows[0] || !(await assertHousehold(pot.rows[0].household_id as string, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db.execute({
    sql: 'UPDATE savings_pots SET name=?, target_amount=?, color=?, sort_order=? WHERE id=?',
    args: [body.name, body.targetAmount ?? null, body.color, body.sortOrder ?? 0, body.id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  const pot = await db.execute({ sql: 'SELECT household_id FROM savings_pots WHERE id=?', args: [id] });
  if (!pot.rows[0] || !(await assertHousehold(pot.rows[0].household_id as string, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db.execute({ sql: 'DELETE FROM savings_pots WHERE id=?', args: [id] });
  return NextResponse.json({ ok: true });
}

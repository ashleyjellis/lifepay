import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  if (!householdId) return NextResponse.json([], { status: 400 });
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM savings_pots WHERE household_id=? ORDER BY sort_order, name',
    args: [householdId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
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
  const body = await req.json();
  const db = getDb();
  await db.execute({
    sql: 'UPDATE savings_pots SET name=?, target_amount=?, color=?, sort_order=? WHERE id=?',
    args: [body.name, body.targetAmount ?? null, body.color, body.sortOrder ?? 0, body.id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM savings_pots WHERE id=?', args: [id] });
  return NextResponse.json({ ok: true });
}

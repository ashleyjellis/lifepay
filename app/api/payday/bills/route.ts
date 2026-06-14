import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  if (!householdId) return NextResponse.json([], { status: 400 });
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM bills WHERE household_id=? ORDER BY category, name',
    args: [householdId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const db = getDb();
  const id = randomUUID();
  await db.execute({
    sql: 'INSERT INTO bills (id, household_id, name, amount, category, active) VALUES (?,?,?,?,?,1)',
    args: [id, body.householdId, body.name, body.amount, body.category],
  });
  const result = await db.execute({ sql: 'SELECT * FROM bills WHERE id=?', args: [id] });
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const db = getDb();
  await db.execute({
    sql: 'UPDATE bills SET name=?, amount=?, category=?, active=? WHERE id=?',
    args: [body.name, body.amount, body.category, body.active ? 1 : 0, body.id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM bills WHERE id=?', args: [id] });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/payday-db';
import { randomUUID } from 'crypto';

export async function GET() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM households ORDER BY created_at DESC LIMIT 1');
  return NextResponse.json(result.rows[0] ?? null);
}

export async function POST(req: Request) {
  const body = await req.json();
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO households (id, name, mode, person_a_name, person_b_name, created_at) VALUES (?,?,?,?,?,?)',
    args: [id, body.name, body.mode, body.personAName ?? 'Person A', body.personBName ?? 'Person B', now],
  });
  const result = await db.execute({ sql: 'SELECT * FROM households WHERE id=?', args: [id] });
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const db = getDb();
  await db.execute({
    sql: 'UPDATE households SET name=?, mode=?, person_a_name=?, person_b_name=? WHERE id=?',
    args: [body.name, body.mode, body.personAName, body.personBName, body.id],
  });
  return NextResponse.json({ ok: true });
}

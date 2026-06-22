import { NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/payday-db';
import { getAuthUser } from '@/lib/payday-auth';
import { randomUUID } from 'crypto';

async function auth() {
  await initSchema();
  const user = await getAuthUser();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await auth();
  if (!user) return NextResponse.json(null, { status: 401 });
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM households WHERE user_id=? ORDER BY created_at DESC LIMIT 1',
    args: [user.id],
  });
  return NextResponse.json(result.rows[0] ?? null);
}

export async function POST(req: Request) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO households
            (id, user_id, name, mode, person_a_name, person_b_name,
             joint_split_a, default_spending_a, default_spending_b,
             default_transport_a, default_transport_b, payday_day, payday_day_b, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, user.id,
      body.name, body.mode,
      body.personAName ?? 'Person A',
      body.personBName ?? 'Person B',
      body.jointSplitA ?? 50,
      body.defaultSpendingA ?? 0,
      body.defaultSpendingB ?? 0,
      body.defaultTransportA ?? 0,
      body.defaultTransportB ?? 0,
      body.paydayDay ?? 25,
      body.paydayDayB ?? body.paydayDay ?? 25,
      now,
    ],
  });
  const result = await db.execute({ sql: 'SELECT * FROM households WHERE id=?', args: [id] });
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: Request) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const db = getDb();
  await db.execute({
    sql: `UPDATE households SET
            name=?, mode=?, person_a_name=?, person_b_name=?,
            joint_split_a=?, default_spending_a=?, default_spending_b=?,
            default_transport_a=?, default_transport_b=?, payday_day=?, payday_day_b=?
          WHERE id=? AND user_id=?`,
    args: [
      body.name, body.mode,
      body.personAName, body.personBName,
      body.jointSplitA ?? 50,
      body.defaultSpendingA ?? 0,
      body.defaultSpendingB ?? 0,
      body.defaultTransportA ?? 0,
      body.defaultTransportB ?? 0,
      body.paydayDay ?? 25,
      body.paydayDayB ?? body.paydayDay ?? 25,
      body.id, user.id,
    ],
  });
  return NextResponse.json({ ok: true });
}

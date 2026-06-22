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
  if (!user) return NextResponse.json({}, { status: 401 });
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  if (!householdId || !(await assertHousehold(householdId, user.id))) return NextResponse.json({}, { status: 403 });
  const db = getDb();
  const [settingsRes, eventsRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM forecast_settings WHERE household_id=?', args: [householdId] }),
    db.execute({ sql: 'SELECT * FROM forecast_events WHERE household_id=? ORDER BY year, name', args: [householdId] }),
  ]);
  return NextResponse.json({ settings: settingsRes.rows[0] ?? null, events: eventsRes.rows });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  if (!(await assertHousehold(body.householdId, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getDb();
  if (body.type === 'settings') {
    const existing = await db.execute({ sql: 'SELECT id FROM forecast_settings WHERE household_id=?', args: [body.householdId] });
    if (existing.rows.length > 0) {
      await db.execute({
        sql: 'UPDATE forecast_settings SET growth_rate=?, person_a_monthly=?, person_b_monthly=?, person_a_bonus=?, person_b_bonus=?, horizon=?, start_year=? WHERE household_id=?',
        args: [body.growthRate ?? 5.0, body.personAMonthly ?? 0, body.personBMonthly ?? 0, body.personABonus ?? 0, body.personBBonus ?? 0, body.horizon ?? 10, body.startYear ?? new Date().getFullYear(), body.householdId],
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO forecast_settings (id, household_id, growth_rate, person_a_monthly, person_b_monthly, person_a_bonus, person_b_bonus, horizon, start_year) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [randomUUID(), body.householdId, body.growthRate ?? 5.0, body.personAMonthly ?? 0, body.personBMonthly ?? 0, body.personABonus ?? 0, body.personBBonus ?? 0, body.horizon ?? 10, body.startYear ?? new Date().getFullYear()],
      });
    }
    const updated = await db.execute({ sql: 'SELECT * FROM forecast_settings WHERE household_id=?', args: [body.householdId] });
    return NextResponse.json(updated.rows[0]);
  }
  if (body.type === 'event') {
    const id = randomUUID();
    await db.execute({
      sql: 'INSERT INTO forecast_events (id, household_id, name, year, amount) VALUES (?,?,?,?,?)',
      args: [id, body.householdId, body.name, body.year, body.amount ?? 0],
    });
    const created = await db.execute({ sql: 'SELECT * FROM forecast_events WHERE id=?', args: [id] });
    return NextResponse.json(created.rows[0]);
  }
  return NextResponse.json({ error: 'unknown type' }, { status: 400 });
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const db = getDb();
  const event = await db.execute({ sql: 'SELECT household_id FROM forecast_events WHERE id=?', args: [body.id] });
  if (!event.rows[0] || !(await assertHousehold(event.rows[0].household_id as string, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db.execute({
    sql: 'UPDATE forecast_events SET name=?, year=?, amount=? WHERE id=?',
    args: [body.name, body.year, body.amount ?? 0, body.id],
  });
  const updated = await db.execute({ sql: 'SELECT * FROM forecast_events WHERE id=?', args: [body.id] });
  return NextResponse.json(updated.rows[0]);
}

export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  const event = await db.execute({ sql: 'SELECT household_id FROM forecast_events WHERE id=?', args: [id] });
  if (!event.rows[0] || !(await assertHousehold(event.rows[0].household_id as string, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db.execute({ sql: 'DELETE FROM forecast_events WHERE id=?', args: [id] });
  return NextResponse.json({ ok: true });
}

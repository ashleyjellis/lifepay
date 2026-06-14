import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/payday-db';

export async function POST() {
  try {
    await initSchema();
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

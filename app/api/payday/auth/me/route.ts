import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json(null, { status: 401 });
  return NextResponse.json({ id: user.id, email: user.email });
}

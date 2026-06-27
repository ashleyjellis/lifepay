import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/payday-auth';
import { buildAuthUrl } from '@/lib/truelayer';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // state = user id so we can verify on callback (simple PoC; use HMAC in production)
  const authUrl = buildAuthUrl(user.id);
  return NextResponse.json({ authUrl });
}

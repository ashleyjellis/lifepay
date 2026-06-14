import { randomUUID, scrypt, timingSafeEqual, randomBytes } from 'crypto';
import { promisify } from 'util';
import { getDb } from './payday-db';
import { cookies } from 'next/headers';

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = 'payday_session';
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const hashBuf = Buffer.from(hash, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuf, derived);
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.execute({
    sql: 'INSERT INTO auth_sessions (id, user_id, token, expires_at, created_at) VALUES (?,?,?,?,?)',
    args: [id, userId, token, expires.toISOString(), now.toISOString()],
  });
  return token;
}

export async function getUserFromToken(token: string): Promise<{ id: string; email: string } | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT u.id, u.email FROM users u
          JOIN auth_sessions s ON s.user_id = u.id
          WHERE s.token = ? AND s.expires_at > ?`,
    args: [token, new Date().toISOString()],
  });
  if (!result.rows[0]) return null;
  return { id: result.rows[0].id as string, email: result.rows[0].email as string };
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM auth_sessions WHERE token=?', args: [token] });
}

// Server-side helper — reads the session cookie and returns the user
export async function getAuthUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserFromToken(token);
}

import { createClient } from '@libsql/client';

let _client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL is not set');
    _client = createClient({ url, authToken });
  }
  return _client;
}

export async function initSchema() {
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('solo','partner')),
      person_a_name TEXT NOT NULL DEFAULT 'Person A',
      person_b_name TEXT NOT NULL DEFAULT 'Person B',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('joint_fixed','joint_extra','individual_a','individual_b')),
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS savings_pots (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS payday_sessions (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      date TEXT NOT NULL,
      income_a REAL NOT NULL DEFAULT 0,
      income_b REAL NOT NULL DEFAULT 0,
      starting_balance REAL NOT NULL DEFAULT 0,
      spending_a REAL NOT NULL DEFAULT 0,
      spending_b REAL NOT NULL DEFAULT 0,
      travel_a REAL NOT NULL DEFAULT 0,
      travel_b REAL NOT NULL DEFAULT 0,
      locked_at TEXT,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS session_bills (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      bill_id TEXT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES payday_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS session_allocations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      pot_id TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (session_id) REFERENCES payday_sessions(id),
      FOREIGN KEY (pot_id) REFERENCES savings_pots(id)
    );
  `);
}

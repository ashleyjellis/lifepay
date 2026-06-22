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

  // Base tables — safe to re-run (IF NOT EXISTS)
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('solo','partner')),
      person_a_name TEXT NOT NULL DEFAULT 'Person A',
      person_b_name TEXT NOT NULL DEFAULT 'Person B',
      joint_split_a INTEGER NOT NULL DEFAULT 50,
      default_spending_a REAL NOT NULL DEFAULT 0,
      default_spending_b REAL NOT NULL DEFAULT 0,
      default_transport_a REAL NOT NULL DEFAULT 0,
      default_transport_b REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS debt_repayments (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      person TEXT NOT NULL CHECK(person IN ('a','b')),
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS savings_pots (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL,
      target_months INTEGER,
      color TEXT NOT NULL DEFAULT '#6366f1',
      owner TEXT NOT NULL DEFAULT 'joint',
      pot_type TEXT NOT NULL DEFAULT 'short_term',
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

    CREATE TABLE IF NOT EXISTS wealth_snapshots (
      id TEXT PRIMARY KEY,
      pot_id TEXT NOT NULL,
      household_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      start_balance REAL NOT NULL DEFAULT 0,
      money_in REAL NOT NULL DEFAULT 0,
      transfer_out REAL NOT NULL DEFAULT 0,
      end_balance REAL NOT NULL DEFAULT 0,
      UNIQUE(pot_id, year, month),
      FOREIGN KEY (pot_id) REFERENCES savings_pots(id),
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS forecast_settings (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL UNIQUE,
      growth_rate REAL NOT NULL DEFAULT 5.0,
      person_a_monthly REAL NOT NULL DEFAULT 0,
      person_b_monthly REAL NOT NULL DEFAULT 0,
      person_a_bonus REAL NOT NULL DEFAULT 0,
      person_b_bonus REAL NOT NULL DEFAULT 0,
      horizon INTEGER NOT NULL DEFAULT 10,
      start_year INTEGER NOT NULL DEFAULT 2026,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS forecast_events (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS forecast_year_contributions (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      person_a_monthly REAL,
      person_b_monthly REAL,
      person_a_bonus REAL,
      person_b_bonus REAL,
      UNIQUE(household_id, year),
      FOREIGN KEY (household_id) REFERENCES households(id)
    );
  `);

  // Migrations — each wrapped so re-runs are safe
  const migrations = [
    'ALTER TABLE households ADD COLUMN user_id TEXT NOT NULL DEFAULT ""',
    'ALTER TABLE households ADD COLUMN joint_split_a INTEGER NOT NULL DEFAULT 50',
    'ALTER TABLE households ADD COLUMN default_spending_a REAL NOT NULL DEFAULT 0',
    'ALTER TABLE households ADD COLUMN default_spending_b REAL NOT NULL DEFAULT 0',
    'ALTER TABLE households ADD COLUMN default_transport_a REAL NOT NULL DEFAULT 0',
    'ALTER TABLE households ADD COLUMN default_transport_b REAL NOT NULL DEFAULT 0',
    'ALTER TABLE savings_pots ADD COLUMN owner TEXT NOT NULL DEFAULT "joint"',
    'ALTER TABLE savings_pots ADD COLUMN pot_type TEXT NOT NULL DEFAULT "short_term"',
    'ALTER TABLE savings_pots ADD COLUMN target_months INTEGER',
    'ALTER TABLE households ADD COLUMN payday_day INTEGER NOT NULL DEFAULT 25',
    'ALTER TABLE savings_pots ADD COLUMN account_type TEXT',
    'ALTER TABLE savings_pots ADD COLUMN provider TEXT',
    'ALTER TABLE savings_pots ADD COLUMN current_balance REAL',
    'ALTER TABLE savings_pots ADD COLUMN target_date TEXT',
  ];

  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* already exists */ }
  }
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Household { id: string; name: string; }
interface Session { id: string; date: string; locked_at: string | null; income_a: number; income_b: number; }

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// The payday happening THIS month covers NEXT month's budget.
// So the currently lockable budget month is always next calendar month.
function lockableMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PaydayHome() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dbError, setDbError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const initRes = await fetch('/api/payday/init', { method: 'POST' });
        if (!initRes.ok) {
          const d = await initRes.json();
          setDbError(d.error ?? 'Database error');
          setLoading(false);
          return;
        }
        const hRes = await fetch('/api/payday/households');
        if (hRes.status === 401) { router.replace('/payday/login'); return; }
        const hh = hRes.ok ? await hRes.json() : null;
        if (!hh) { router.replace('/payday/setup'); return; }
        setHousehold(hh);

        const sRes = await fetch(`/api/payday/sessions?householdId=${hh.id}`);
        const all: Session[] = sRes.ok ? await sRes.json() : [];
        setSessions(all.sort((a, b) => b.date.localeCompare(a.date)));
      } catch {
        setDbError('Could not connect to database. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      }
      setLoading(false);
    }
    load();
  }, [router]);

  if (dbError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-[#faf9f7]">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm border border-red-100">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2 text-red-700">Database not configured</h1>
          <p className="text-gray-600 text-sm mb-4">{dbError}</p>
          <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 space-y-1">
            <div>TURSO_DATABASE_URL=libsql://...</div>
            <div>TURSO_AUTH_TOKEN=eyJ...</div>
          </div>
          <Link href="/" className="mt-6 inline-block text-sm text-gray-500 hover:text-gray-700">← Back to LifeCash</Link>
        </div>
      </div>
    );
  }

  if (loading || !household) {
    return <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]"><div className="text-gray-400 text-sm">Loading...</div></div>;
  }

  const upcoming = lockableMonth();
  const upcomingSession = sessions.find(s => s.date.startsWith(upcoming));
  const pastSessions = sessions.filter(s => !s.date.startsWith(upcoming) && s.locked_at);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{household.name}</div>
            <div className="font-semibold text-sm">Payday</div>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/payday/history" className="text-xs text-gray-400 hover:text-gray-600">History</Link>
            <Link href="/payday/setup" className="text-xs text-gray-400 hover:text-gray-600">Setup</Link>
            <button onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Upcoming / current lockable payday */}
        <div>
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Upcoming payday</div>
          <div className="bg-[#1a1a1a] text-white rounded-2xl p-6">
            <div className="text-xs text-gray-400 mb-1">Budget period</div>
            <div className="text-2xl font-bold mb-1">{monthLabel(upcoming)}</div>
            <div className="text-xs text-gray-400 mb-5">
              {upcomingSession?.locked_at
                ? `Locked in · ${new Date(upcomingSession.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
                : 'Not yet set up — ready for your payday sit-down'}
            </div>
            {upcomingSession?.locked_at ? (
              <Link href={`/payday/dashboard/${upcomingSession.id}`}
                className="inline-block bg-white text-[#1a1a1a] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                View dashboard →
              </Link>
            ) : (
              <Link href="/payday/session"
                className="inline-block bg-white text-[#1a1a1a] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                {upcomingSession ? 'Continue setting up →' : 'Set up payday →'}
              </Link>
            )}
          </div>
        </div>

        {/* Past paydays */}
        {pastSessions.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Previous paydays</div>
            <div className="space-y-2">
              {pastSessions.map(s => {
                const ym = s.date.slice(0, 7);
                // The session date's month covers the NEXT month
                const [y, m] = ym.split('-').map(Number);
                const coversDate = new Date(y, m, 1); // next month
                const covers = coversDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                const paid = new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const income = Number(s.income_a) + Number(s.income_b);
                return (
                  <Link key={s.id} href={`/payday/dashboard/${s.id}`}
                    className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3.5 hover:border-gray-300 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{covers}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Paid {paid} · {income > 0 ? `£${income.toLocaleString('en-GB')} in` : 'locked'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Locked</span>
                      <span className="text-gray-300 text-sm">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📅</div>
            <p className="text-sm">No paydays locked in yet. Set up your first one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

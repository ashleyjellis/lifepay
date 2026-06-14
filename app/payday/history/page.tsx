'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Household {
  id: string;
  name: string;
  mode: 'solo' | 'partner';
}

interface Session {
  id: string;
  date: string;
  income_a: number;
  income_b: number;
  starting_balance: number;
  locked_at: string | null;
}

interface Pot {
  id: string;
  name: string;
  color: string;
}

interface Alloc {
  pot_id: string;
  amount: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export default function HistoryPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [sessionDetails, setSessionDetails] = useState<Record<string, Alloc[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const hRes = await fetch('/api/payday/households');
      if (!hRes.ok) { setLoading(false); return; }
      const hh: Household = await hRes.json();
      if (!hh) { setLoading(false); return; }
      setHousehold(hh);

      const [sRes, pRes] = await Promise.all([
        fetch(`/api/payday/sessions?householdId=${hh.id}`),
        fetch(`/api/payday/pots?householdId=${hh.id}`),
      ]);
      const sess: Session[] = await sRes.json();
      const pts: Pot[] = await pRes.json();
      setSessions(sess.filter(s => s.locked_at));
      setPots(pts);

      // Load allocations for each session
      const details: Record<string, Alloc[]> = {};
      await Promise.all(sess.filter(s => s.locked_at).map(async s => {
        const r = await fetch(`/api/payday/sessions?id=${s.id}`);
        const data = await r.json();
        details[s.id] = (data.allocations ?? []).map((a: { pot_id: string; amount: number }) => ({ pot_id: a.pot_id, amount: Number(a.amount) }));
      }));
      setSessionDetails(details);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 text-sm">Loading...</div></div>;
  }

  const chartData = sessions.map(s => {
    const totalIn = Number(s.income_a) + Number(s.income_b) + Number(s.starting_balance);
    const saved = (sessionDetails[s.id] ?? []).reduce((sum, a) => sum + a.amount, 0);
    const savingsRate = totalIn > 0 ? Math.round((saved / totalIn) * 100) : 0;
    return { date: fmtDate(s.date), totalIn, saved, savingsRate };
  }).reverse();

  const potTotals = pots.map(pot => {
    const total = sessions.reduce((sum, s) => {
      const a = (sessionDetails[s.id] ?? []).find(x => x.pot_id === pot.id);
      return sum + (a?.amount ?? 0);
    }, 0);
    return { ...pot, total };
  }).filter(p => p.total > 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{household?.name}</div>
            <div className="font-semibold text-sm">History</div>
          </div>
          <Link href="/payday/session" className="text-xs text-gray-400 hover:text-gray-600">← New session</Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {sessions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm">No completed sessions yet.</p>
            <Link href="/payday/session" className="text-sm text-gray-600 hover:text-gray-900 underline mt-2 inline-block">Start your first payday →</Link>
          </div>
        ) : (
          <>
            {/* Income chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly income</h3>
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `£${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Bar dataKey="totalIn" name="Total in" fill="#1a1a1a" radius={[4,4,0,0]} />
                    <Bar dataKey="saved" name="Saved" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Savings rate */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Savings rate</h3>
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Bar dataKey="savingsRate" name="Savings rate" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pot accumulation */}
            {potTotals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">All-time pot totals</h3>
                <div className="space-y-2">
                  {potTotals.sort((a, b) => b.total - a.total).map(pot => {
                    const max = Math.max(...potTotals.map(p => p.total));
                    return (
                      <div key={pot.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-700 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: pot.color }} />
                            {pot.name}
                          </span>
                          <span className="font-semibold">{fmt(pot.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(pot.total / max) * 100}%`, background: pot.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Session log */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Session log</h3>
              <div className="space-y-2">
                {sessions.map(s => {
                  const totalIn = Number(s.income_a) + Number(s.income_b) + Number(s.starting_balance);
                  const saved = (sessionDetails[s.id] ?? []).reduce((sum, a) => sum + a.amount, 0);
                  return (
                    <div key={s.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Saved {fmt(saved)}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-700">{fmt(totalIn)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

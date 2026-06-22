'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'] });

// ── Types ─────────────────────────────────────────────────────────────────────

interface Household {
  id: string;
  name: string;
  mode: 'solo' | 'partner';
  person_a_name: string;
  person_b_name: string;
  payday_day: number;
}

interface Pot {
  id: string;
  name: string;
  pot_type: string;
  account_type: string | null;
  provider: string | null;
  current_balance: number | null;
  owner: string;
  color: string;
}

interface RowData {
  startBalance: string;
  moneyIn: string;
  transferOut: string;
  endBalance: string;
}

interface Snapshot {
  id: string;
  pot_id: string;
  household_id: string;
  year: number;
  month: number;
  start_balance: number;
  money_in: number;
  transfer_out: number;
  end_balance: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function accountTypeLabel(t: string | null) {
  switch (t) {
    case 'savings_account': return 'Savings Account';
    case 'cash_isa': return 'Cash ISA';
    case 'stocks_isa': return 'S&S ISA';
    case 'lisa': return 'LISA';
    case 'pension': return 'Pension';
    default: return 'Other';
  }
}

function accountTypeIcon(t: string | null) {
  switch (t) {
    case 'savings_account': return '🏦';
    case 'cash_isa': return '💰';
    case 'stocks_isa': return '📈';
    case 'lisa': return '🏠';
    case 'pension': return '🛡️';
    default: return '💼';
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const INPUT_CLS = 'border-b border-[#e6e9e7] bg-transparent text-sm font-semibold outline-none w-28 focus:border-[#7bae7f]';

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
  const [rows, setRows] = useState<Record<string, RowData>>({});
  const [annualSnapshots, setAnnualSnapshots] = useState<Snapshot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load household + pots
  useEffect(() => {
    async function load() {
      const hRes = await fetch('/api/payday/households');
      if (hRes.status === 401) { router.push('/payday/login'); return; }
      const hData = await hRes.json();
      if (!hData || (Array.isArray(hData) && hData.length === 0)) {
        router.push('/payday/setup');
        return;
      }
      const h: Household = Array.isArray(hData) ? hData[0] : hData;
      setHousehold(h);

      const potsRes = await fetch(`/api/payday/pots?householdId=${h.id}`);
      if (potsRes.ok) {
        const allPots: Pot[] = await potsRes.json();
        setPots(allPots.filter(p => p.pot_type === 'long_term'));
      }
      setLoading(false);
    }
    load();
  }, [router]);

  // Load snapshots when year/month/viewMode changes
  useEffect(() => {
    if (!household) return;
    if (viewMode === 'annual') {
      fetch(`/api/payday/growth?householdId=${household.id}&year=${selectedYear}&annual=1`)
        .then(r => r.json())
        .then(data => setAnnualSnapshots(Array.isArray(data) ? data : []));
    } else {
      fetch(`/api/payday/growth?householdId=${household.id}&year=${selectedYear}&month=${selectedMonth}`)
        .then(r => r.json())
        .then((snapshots: Snapshot[]) => {
          if (!Array.isArray(snapshots)) return;
          // Also fetch previous month's snapshots for start balance defaults
          const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
          const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
          fetch(`/api/payday/growth?householdId=${household.id}&year=${prevYear}&month=${prevMonth}`)
            .then(r => r.json())
            .then((prevSnapshots: Snapshot[]) => {
              if (!Array.isArray(prevSnapshots)) prevSnapshots = [];
              const newRows: Record<string, RowData> = {};
              pots.forEach(pot => {
                const snap = snapshots.find(s => s.pot_id === pot.id);
                const prevSnap = prevSnapshots.find(s => s.pot_id === pot.id);
                if (snap) {
                  newRows[pot.id] = {
                    startBalance: String(snap.start_balance),
                    moneyIn: String(snap.money_in),
                    transferOut: String(snap.transfer_out),
                    endBalance: String(snap.end_balance),
                  };
                } else {
                  const defaultStart = prevSnap
                    ? prevSnap.end_balance
                    : (pot.current_balance ?? 0);
                  newRows[pot.id] = {
                    startBalance: String(defaultStart),
                    moneyIn: '0',
                    transferOut: '0',
                    endBalance: String(pot.current_balance ?? 0),
                  };
                }
              });
              setRows(newRows);
              setDirty(false);
            });
        });
    }
  }, [household, selectedYear, selectedMonth, viewMode, pots]);

  function updateRow(potId: string, field: keyof RowData, value: string) {
    setRows(prev => ({ ...prev, [potId]: { ...prev[potId], [field]: value } }));
    setDirty(true);
  }

  function fillFromCurrentBalance() {
    setRows(prev => {
      const next = { ...prev };
      pots.forEach(pot => {
        next[pot.id] = { ...next[pot.id], endBalance: String(pot.current_balance ?? 0) };
      });
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    await Promise.all(pots.map(async pot => {
      const row = rows[pot.id];
      if (!row) return;
      await fetch('/api/payday/growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: household.id,
          potId: pot.id,
          year: selectedYear,
          month: selectedMonth,
          startBalance: parseFloat(row.startBalance) || 0,
          moneyIn: parseFloat(row.moneyIn) || 0,
          transferOut: parseFloat(row.transferOut) || 0,
          endBalance: parseFloat(row.endBalance) || 0,
        }),
      });
      // Also sync end balance → pot current_balance
      await fetch('/api/payday/savings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pot.id, currentBalance: parseFloat(row.endBalance) || 0 }),
      });
    }));
    setSaving(false);
    setDirty(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  }

  function handleCancel() {
    setDirty(false);
    // Re-trigger load by flipping month then back
    const m = selectedMonth;
    setSelectedMonth(m === 1 ? 2 : 1);
    setTimeout(() => setSelectedMonth(m), 0);
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalWealth = pots.reduce((sum, pot) => {
    const endBal = parseFloat(rows[pot.id]?.endBalance ?? '0') || 0;
    return sum + endBal;
  }, 0);

  const totalGrowth = pots.reduce((sum, pot) => {
    const row = rows[pot.id];
    if (!row) return sum;
    const end = parseFloat(row.endBalance) || 0;
    const start = parseFloat(row.startBalance) || 0;
    const moneyIn = parseFloat(row.moneyIn) || 0;
    const transferOut = parseFloat(row.transferOut) || 0;
    return sum + (end - start - moneyIn + transferOut);
  }, 0);

  const totalStart = pots.reduce((sum, pot) => sum + (parseFloat(rows[pot.id]?.startBalance ?? '0') || 0), 0);
  const growthPct = totalStart > 0 ? ((totalGrowth / totalStart) * 100) : 0;

  // ── Annual view calculations ───────────────────────────────────────────────

  function getAnnualRow(pot: Pot) {
    const potSnaps = annualSnapshots.filter(s => s.pot_id === pot.id);
    if (potSnaps.length === 0) return null;
    const sorted = [...potSnaps].sort((a, b) => a.month - b.month);
    const yearStart = sorted[0].start_balance;
    const current = sorted[sorted.length - 1].end_balance;
    const totalMoneyIn = sorted.reduce((s, r) => s + r.money_in, 0);
    const totalTransferOut = sorted.reduce((s, r) => s + r.transfer_out, 0);
    const trueGrowth = current - yearStart - totalMoneyIn + totalTransferOut;
    return { yearStart, current, trueGrowth };
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className} flex items-center justify-center`}>
        <p className="text-[#717970]">Loading…</p>
      </div>
    );
  }

  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      {/* Header */}
      <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
          <div className="flex gap-5 items-center">
            <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Paydays</Link>
            <Link href="/payday/savings" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Short Savings</Link>
            <Link href="/payday/growth" className="text-sm text-[#396940] font-semibold transition-colors">Growth</Link>
            <Link href="/payday/setup" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Setup</Link>
            <button
              onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 pt-6 pb-24">
        {/* Page title + update button */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2b1a]">Growth</h1>
            <p className="text-sm text-[#717970] mt-0.5">Track your wealth month by month</p>
          </div>
          <button
            onClick={fillFromCurrentBalance}
            className="text-sm bg-white border border-[#c1c9be] text-[#414940] rounded-full px-4 py-2 hover:border-[#396940] transition-colors font-medium"
          >
            Update Balances
          </button>
        </div>

        {/* Year + view toggle + month pills */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-white border border-[#c1c9be] rounded-xl px-3 py-1.5 text-sm font-medium text-[#2d3130] focus:outline-none focus:ring-2 focus:ring-[#7bae7f]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="flex items-center gap-1 bg-white border border-[#c1c9be] rounded-xl p-1">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'monthly' ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('annual')}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'annual' ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Month pills (monthly view only) */}
        {viewMode === 'monthly' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
            {MONTH_NAMES.map((name, i) => {
              const m = i + 1;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedMonth === m
                      ? 'bg-[#396940] text-white'
                      : 'bg-white border border-[#c1c9be] text-[#414940] hover:border-[#396940]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {pots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e6e9e7] p-10 text-center">
            <p className="text-3xl mb-3">📈</p>
            <h2 className="text-lg font-bold text-[#1a2b1a] mb-2">No investment pots set up yet</h2>
            <p className="text-sm text-[#717970] mb-5">Add them in Short Savings to start tracking growth.</p>
            <Link href="/payday/savings" className="bg-[#396940] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#2d5533] transition-colors">
              Go to Short Savings
            </Link>
          </div>
        ) : viewMode === 'monthly' ? (
          /* ── Monthly table ── */
          <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#e6e9e7]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Product</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">Start Balance</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">In (New Money)</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">Transfer/Out</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">End Balance</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">True Growth</th>
                </tr>
              </thead>
              <tbody>
                {pots.map(pot => {
                  const row = rows[pot.id] ?? { startBalance: '0', moneyIn: '0', transferOut: '0', endBalance: '0' };
                  const end = parseFloat(row.endBalance) || 0;
                  const start = parseFloat(row.startBalance) || 0;
                  const moneyIn = parseFloat(row.moneyIn) || 0;
                  const transferOut = parseFloat(row.transferOut) || 0;
                  const trueGrowth = end - start - moneyIn + transferOut;
                  const growthPctRow = start > 0 ? ((trueGrowth / start) * 100) : 0;
                  const growthColor = trueGrowth >= 0 ? '#396940' : '#ba1a1a';

                  return (
                    <tr key={pot.id} className="border-b border-[#f0f2f0] hover:bg-[#fafcfa] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{accountTypeIcon(pot.account_type)}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#1a2b1a]">{pot.provider ?? pot.name}</p>
                            <p className="text-xs text-[#717970]">{accountTypeLabel(pot.account_type)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input
                            type="number"
                            value={row.startBalance}
                            onChange={e => updateRow(pot.id, 'startBalance', e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input
                            type="number"
                            value={row.moneyIn}
                            onChange={e => updateRow(pot.id, 'moneyIn', e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input
                            type="number"
                            value={row.transferOut}
                            onChange={e => updateRow(pot.id, 'transferOut', e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input
                            type="number"
                            value={row.endBalance}
                            onChange={e => updateRow(pot.id, 'endBalance', e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm font-bold" style={{ color: growthColor }}>
                          {trueGrowth >= 0 ? '+' : ''}£{fmt(trueGrowth)}
                        </p>
                        <p className="text-xs" style={{ color: growthColor }}>
                          {trueGrowth >= 0 ? '+' : ''}{growthPctRow.toFixed(2)}%
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Annual table ── */
          <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[#e6e9e7]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Product</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">Year Start</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">Current Value</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">True Growth YTD</th>
                </tr>
              </thead>
              <tbody>
                {pots.map(pot => {
                  const annual = getAnnualRow(pot);
                  if (!annual) {
                    return (
                      <tr key={pot.id} className="border-b border-[#f0f2f0]">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{accountTypeIcon(pot.account_type)}</span>
                            <div>
                              <p className="text-sm font-semibold text-[#1a2b1a]">{pot.provider ?? pot.name}</p>
                              <p className="text-xs text-[#717970]">{accountTypeLabel(pot.account_type)}</p>
                            </div>
                          </div>
                        </td>
                        <td colSpan={3} className="py-4 px-3 text-sm text-[#9ba99a]">No data for {selectedYear}</td>
                      </tr>
                    );
                  }
                  const growthColor = annual.trueGrowth >= 0 ? '#396940' : '#ba1a1a';
                  const growthPctAnnual = annual.yearStart > 0 ? ((annual.trueGrowth / annual.yearStart) * 100) : 0;
                  return (
                    <tr key={pot.id} className="border-b border-[#f0f2f0] hover:bg-[#fafcfa] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{accountTypeIcon(pot.account_type)}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#1a2b1a]">{pot.provider ?? pot.name}</p>
                            <p className="text-xs text-[#717970]">{accountTypeLabel(pot.account_type)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-sm font-semibold text-[#1a2b1a]">£{fmt(annual.yearStart)}</td>
                      <td className="py-4 px-3 text-sm font-semibold text-[#1a2b1a]">£{fmt(annual.current)}</td>
                      <td className="py-4 px-4">
                        <p className="text-sm font-bold" style={{ color: growthColor }}>
                          {annual.trueGrowth >= 0 ? '+' : ''}£{fmt(annual.trueGrowth)}
                        </p>
                        <p className="text-xs" style={{ color: growthColor }}>
                          {annual.trueGrowth >= 0 ? '+' : ''}{growthPctAnnual.toFixed(2)}%
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom bar (monthly view only) */}
      {viewMode === 'monthly' && pots.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e6e9e7] z-20">
          <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide">Total Wealth</p>
                <p className="text-lg font-bold text-[#1a2b1a]">£{fmt(totalWealth)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide">True Growth</p>
                <p className="text-lg font-bold" style={{ color: totalGrowth >= 0 ? '#396940' : '#ba1a1a' }}>
                  {totalGrowth >= 0 ? '+' : ''}£{fmt(totalGrowth)}
                  <span className="text-sm font-medium ml-1">
                    ({totalGrowth >= 0 ? '+' : ''}{growthPct.toFixed(2)}%)
                  </span>
                </p>
              </div>
              {savedFeedback && (
                <span className="text-sm text-[#7bae7f] font-semibold">Saved ✓</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {dirty && (
                <button
                  onClick={handleCancel}
                  className="px-5 py-2 rounded-full text-sm font-semibold border-2 border-[#c1c9be] text-[#414940] hover:border-[#396940] transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-full text-sm font-semibold bg-[#396940] text-white hover:bg-[#2d5533] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Save ${MONTH_FULL[selectedMonth - 1]} Update`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

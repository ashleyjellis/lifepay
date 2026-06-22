'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'] });

// ── Types ────────────────────────────────────────────────────────────────────

interface Household {
  id: string;
  name: string;
  mode: 'solo' | 'partner';
  person_a_name: string;
  person_b_name: string;
}

interface Pot {
  id: string;
  household_id: string;
  name: string;
  target_amount: number | null;
  target_months: number | null;
  color: string;
  owner: string;
  pot_type: 'short_term' | 'long_term';
  sort_order: number;
  account_type: string | null;
  provider: string | null;
  current_balance: number | null;
}

type SavingsMap = Record<string, number>;

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

function targetDateLabel(targetMonths: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + targetMonths);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ── GoalCard ─────────────────────────────────────────────────────────────────

function GoalCard({ pot, totalSaved }: { pot: Pot; totalSaved: number }) {
  const target = pot.target_amount ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((totalSaved / target) * 100)) : 0;

  return (
    <div className="bg-white rounded-2xl border border-[#e6e9e7] p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{ width: 12, height: 12, background: pot.color }}
          />
          <span className="font-semibold text-[#1a2b1a] text-sm">{pot.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[#9ba99a]">
          <span className="text-base">⊞</span>
          <span className="text-base">⋮</span>
        </div>
      </div>

      {pot.target_months != null && (
        <p className="text-xs text-[#717970] mb-3 ml-5">
          by {targetDateLabel(pot.target_months)}
        </p>
      )}
      {pot.target_months == null && pot.target_amount != null && (
        <p className="text-xs text-[#717970] mb-3 ml-5">
          £{fmt(pot.target_amount)} goal
        </p>
      )}

      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#717970]">Progress</span>
        <span className="text-xs font-semibold text-[#396940]">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#e6e9e7] overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-[#7bae7f] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div>
        <p className="text-xs text-[#717970] mb-0.5">Current Saved</p>
        <p className="text-lg font-bold text-[#1a2b1a]">£{fmt(totalSaved)}</p>
        {pot.target_amount != null && (
          <p className="text-xs text-[#9ba99a]">Goal: £{fmt(pot.target_amount)}</p>
        )}
      </div>
    </div>
  );
}

function AddGoalCard() {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-[#c1c9be] p-4 flex flex-col items-center justify-center min-h-[140px] text-[#9ba99a] cursor-pointer hover:border-[#7bae7f] hover:text-[#7bae7f] transition-colors">
      <span className="text-2xl mb-1">+</span>
      <span className="text-sm">Add Goal</span>
    </div>
  );
}

// ── WealthCard ────────────────────────────────────────────────────────────────

function WealthCard({
  pot,
  lastPayday,
  onBalanceUpdate,
}: {
  pot: Pot;
  lastPayday: number;
  onBalanceUpdate: (id: string, balance: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(pot.current_balance ?? 0));
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const val = parseFloat(inputVal) || 0;
    setEditing(false);
    await fetch('/api/payday/savings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pot.id, currentBalance: val }),
    });
    onBalanceUpdate(pot.id, val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const balance = pot.current_balance ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-[#e6e9e7] p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{accountTypeIcon(pot.account_type)}</span>
          <div>
            <p className="text-xs text-[#717970]">{accountTypeLabel(pot.account_type)}</p>
            <p className="font-semibold text-[#1a2b1a] text-sm">{pot.provider ?? pot.name}</p>
          </div>
        </div>
        {lastPayday > 0 && (
          <span className="bg-[#e8f5e9] text-[#2e7d32] rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
            Last payday: £{fmt(lastPayday)}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs text-[#717970] mb-1">Current Balance</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-[#396940] font-bold">£</span>
            <input
              ref={inputRef}
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={save}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              className="text-lg font-bold text-[#1a2b1a] border-b-2 border-[#7bae7f] outline-none w-32 bg-transparent"
            />
          </div>
        ) : (
          <button
            onClick={() => { setInputVal(String(balance)); setEditing(true); }}
            className="text-lg font-bold text-[#1a2b1a] hover:text-[#396940] transition-colors text-left"
          >
            £{fmt(balance)}
            {saved && <span className="ml-2 text-xs text-[#7bae7f] font-normal">Saved ✓</span>}
          </button>
        )}
      </div>
    </div>
  );
}

function AddWealthCard() {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-[#c1c9be] p-4 flex flex-col items-center justify-center min-h-[100px] text-[#9ba99a] cursor-pointer hover:border-[#7bae7f] hover:text-[#7bae7f] transition-colors">
      <span className="text-xl mb-1">⊞</span>
      <span className="text-sm">Add Wealth Product</span>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v4H3z"/><path d="M3 11h18v2H3z"/><path d="M3 17h18v4H3z"/>
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

// ── Status badge helpers ───────────────────────────────────────────────────────

function goalStatus(pct: number, targetMonths: number | null): { label: string; color: string; icon: string } {
  if (pct >= 100) return { label: 'Complete', color: '#396940', icon: '✓' };
  if (targetMonths != null && targetMonths <= 0) return { label: 'Overdue', color: '#ba1a1a', icon: '!' };
  if (pct >= 75) return { label: 'On track', color: '#396940', icon: '✓' };
  if (pct >= 40) return { label: 'Behind', color: '#c07000', icon: '△' };
  return { label: 'Behind', color: '#ba1a1a', icon: '△' };
}

// ── Table views ────────────────────────────────────────────────────────────────

function GoalTableRow({ pot, totalSaved, ownerLabel, ownerInitial }: {
  pot: Pot; totalSaved: number; ownerLabel: string; ownerInitial: string;
}) {
  const target = pot.target_amount ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((totalSaved / target) * 100)) : 0;
  const monthly = pot.target_months && pot.target_months > 0 && target > 0
    ? Math.round((target - totalSaved) / pot.target_months)
    : null;
  const status = goalStatus(pct, pot.target_months);

  return (
    <tr className="border-b border-[#f0f2f0] hover:bg-[#fafcfa] transition-colors">
      <td className="py-4 px-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold" style={{ background: pot.color }}>
          {ownerInitial}
        </span>
      </td>
      <td className="py-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1a2b1a]">{pot.name}</span>
        </div>
      </td>
      <td className="py-4 px-2 text-sm text-[#414940]">
        {pot.target_months != null ? targetDateLabel(pot.target_months) : '—'}
      </td>
      <td className="py-4 px-2 min-w-[120px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-[#e6e9e7] overflow-hidden min-w-[60px]">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 75 ? '#7bae7f' : pct >= 40 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <span className="text-xs font-semibold text-[#717970] w-8 shrink-0">{pct}%</span>
        </div>
      </td>
      <td className="py-4 px-2 text-sm text-[#414940]">
        {target > 0 ? `£${target.toLocaleString('en-GB')}` : '—'}
      </td>
      <td className="py-4 px-2 text-sm text-[#414940]">
        {monthly != null ? `£${monthly.toLocaleString('en-GB')}` : '—'}
      </td>
      <td className="py-4 px-2">
        <span className="text-lg font-bold text-[#1a2b1a]">£{fmt(totalSaved)}</span>
      </td>
      <td className="py-4 px-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: status.color + '18', color: status.color }}>
          {status.icon} {status.label}
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3 text-[#9ba99a]">
          <button className="hover:text-[#396940] transition-colors"><PencilIcon /></button>
          <button className="hover:text-[#ba1a1a] transition-colors"><TrashIcon /></button>
        </div>
      </td>
    </tr>
  );
}

function WealthTableRow({ pot, lastPayday, onBalanceUpdate, ownerInitial }: {
  pot: Pot; lastPayday: number; ownerInitial: string;
  onBalanceUpdate: (id: string, balance: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(pot.current_balance ?? 0));
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function save() {
    const val = parseFloat(inputVal) || 0;
    setEditing(false);
    await fetch('/api/payday/savings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pot.id, currentBalance: val }) });
    onBalanceUpdate(pot.id, val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const balance = pot.current_balance ?? 0;

  return (
    <tr className="border-b border-[#f0f2f0] hover:bg-[#fafcfa] transition-colors">
      <td className="py-4 px-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#396940] text-white text-xs font-bold">
          {ownerInitial}
        </span>
      </td>
      <td className="py-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{accountTypeIcon(pot.account_type)}</span>
          <span className="text-sm font-semibold text-[#1a2b1a]">{accountTypeLabel(pot.account_type)}</span>
        </div>
      </td>
      <td className="py-4 px-2 text-sm text-[#414940] font-medium">{pot.provider ?? pot.name}</td>
      <td className="py-4 px-2">
        {lastPayday > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e8f5e9] text-[#2e7d32]">
            Last payday: £{lastPayday.toLocaleString('en-GB')}
          </span>
        )}
      </td>
      <td className="py-4 px-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-[#396940] font-bold text-sm">£</span>
            <input ref={inputRef} type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
              onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              className="text-lg font-bold text-[#1a2b1a] border-b-2 border-[#7bae7f] outline-none w-28 bg-transparent" />
          </div>
        ) : (
          <button onClick={() => { setInputVal(String(balance)); setEditing(true); }}
            className="text-lg font-bold text-[#1a2b1a] hover:text-[#396940] transition-colors text-left">
            £{fmt(balance)}{saved && <span className="ml-2 text-xs text-[#7bae7f] font-normal">✓</span>}
          </button>
        )}
      </td>
      <td className="py-4 px-4">
        <button className="text-[#9ba99a] hover:text-[#414940] transition-colors">•••</button>
      </td>
    </tr>
  );
}

export default function SavingsPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [savingsMap, setSavingsMap] = useState<SavingsMap>({});
  const [filterOwner, setFilterOwner] = useState<'all' | 'person_a' | 'person_b' | 'joint'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Household
      const hRes = await fetch('/api/payday/households');
      if (hRes.status === 401) { router.push('/payday/login'); return; }
      const hData = await hRes.json();
      if (!hData || (Array.isArray(hData) && hData.length === 0)) {
        router.push('/payday/setup');
        return;
      }
      const h: Household = Array.isArray(hData) ? hData[0] : hData;
      setHousehold(h);

      // Pots
      const [potsRes, savingsRes] = await Promise.all([
        fetch(`/api/payday/pots?householdId=${h.id}`),
        fetch(`/api/payday/savings?householdId=${h.id}`),
      ]);
      if (potsRes.ok) setPots(await potsRes.json());
      if (savingsRes.ok) setSavingsMap(await savingsRes.json());
      setLoading(false);
    }
    load();
  }, [router]);

  function handleBalanceUpdate(id: string, balance: number) {
    setPots(prev => prev.map(p => p.id === id ? { ...p, current_balance: balance } : p));
  }

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className} flex items-center justify-center`}>
        <p className="text-[#717970]">Loading…</p>
      </div>
    );
  }

  const shortTermPots = pots.filter(p => p.pot_type === 'short_term');
  const longTermPots = pots.filter(p => p.pot_type === 'long_term');

  const filteredShort = filterOwner === 'all'
    ? shortTermPots
    : shortTermPots.filter(p => p.owner === filterOwner);

  const filteredLong = filterOwner === 'all'
    ? longTermPots
    : longTermPots.filter(p => p.owner === filterOwner);

  // Short-term grouping: target_months <= 3 → THIS MONTH, else COMING UP
  const thisMonth = filteredShort.filter(p => p.target_months != null && p.target_months <= 3);
  const comingUp = filteredShort.filter(p => p.target_months == null || p.target_months > 3);

  // Long-term grouped by owner
  const ltOwners = ['person_a', 'person_b', 'joint'] as const;

  function ownerLabel(owner: string) {
    if (!household) return owner;
    if (owner === 'person_a') return `${household.person_a_name}'s Portfolio`;
    if (owner === 'person_b') return `${household.person_b_name}'s Portfolio`;
    return 'Joint Portfolio';
  }

  function ownerInitial(owner: string) {
    if (!household) return owner[0].toUpperCase();
    if (owner === 'person_a') return household.person_a_name[0].toUpperCase();
    if (owner === 'person_b') return household.person_b_name[0].toUpperCase();
    return 'J';
  }

  const hasPartner = household?.mode === 'partner';
  const activeGoalsCount = filteredShort.length;

  const filterPills: { key: 'all' | 'person_a' | 'person_b' | 'joint'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'person_a', label: household?.person_a_name ?? 'Person A' },
    ...(hasPartner ? [{ key: 'person_b' as const, label: household?.person_b_name ?? 'Person B' }] : []),
    { key: 'joint', label: 'Joint' },
  ];

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      {/* Header */}
      <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
          <div className="flex gap-5 items-center">
            <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Paydays</Link>
            <Link href="/payday/savings" className="text-sm text-[#396940] font-semibold transition-colors">Savings & Wealth</Link>
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

      <div className="max-w-3xl mx-auto px-5 pt-6 pb-12">
        <h1 className="text-2xl font-bold text-[#1a2b1a] mb-5">Savings & Wealth</h1>

        {/* Filter pills + view toggle */}
        <div className="flex items-center justify-between gap-2 mb-7 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {filterPills.map(pill => (
              <button key={pill.key} onClick={() => setFilterOwner(pill.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterOwner === pill.key ? 'bg-[#396940] text-white' : 'bg-white border border-[#c1c9be] text-[#414940] hover:border-[#396940]'
                }`}>
                {pill.label}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white border border-[#c1c9be] rounded-xl p-1">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}
              title="Grid view">
              <GridIcon />
            </button>
            <button onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}
              title="Table view">
              <TableIcon />
            </button>
          </div>
        </div>

        {/* ── Section 1: Short-term Goals ── */}
        <div className="mb-9">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1a2b1a]">Short-term Goals</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#7bae7f] font-medium">{activeGoalsCount} Active {activeGoalsCount === 1 ? 'Goal' : 'Goals'}</span>
              <Link href="/payday/setup" className="flex items-center gap-1 text-sm text-[#7bae7f] font-semibold hover:text-[#396940] transition-colors">
                <span className="text-base">⊕</span> Add Goal
              </Link>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <>
              {thisMonth.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#9ba99a] uppercase tracking-widest mb-2">This Month</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {thisMonth.map(pot => <GoalCard key={pot.id} pot={pot} totalSaved={savingsMap[pot.id] ?? 0} />)}
                  </div>
                </div>
              )}
              {comingUp.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#9ba99a] uppercase tracking-widest mb-2">Coming Up</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {comingUp.map(pot => <GoalCard key={pot.id} pot={pot} totalSaved={savingsMap[pot.id] ?? 0} />)}
                  </div>
                </div>
              )}
              {filteredShort.length === 0 && <p className="text-sm text-[#9ba99a] mb-3">No short-term goals yet.</p>}
              <div className="mt-2 max-w-xs"><AddGoalCard /></div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e6e9e7]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Owner</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Goal Name</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Deadline</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Progress</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Target</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Monthly</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Current Saved</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {thisMonth.length > 0 && (
                    <tr><td colSpan={9} className="px-4 pt-4 pb-1 text-xs font-semibold text-[#9ba99a] uppercase tracking-widest bg-[#f7faf8]">This Month</td></tr>
                  )}
                  {thisMonth.map(pot => (
                    <GoalTableRow key={pot.id} pot={pot} totalSaved={savingsMap[pot.id] ?? 0}
                      ownerLabel={ownerLabel(pot.owner)} ownerInitial={ownerInitial(pot.owner)} />
                  ))}
                  {comingUp.length > 0 && (
                    <tr><td colSpan={9} className="px-4 pt-4 pb-1 text-xs font-semibold text-[#9ba99a] uppercase tracking-widest bg-[#f7faf8]">Coming Up</td></tr>
                  )}
                  {comingUp.map(pot => (
                    <GoalTableRow key={pot.id} pot={pot} totalSaved={savingsMap[pot.id] ?? 0}
                      ownerLabel={ownerLabel(pot.owner)} ownerInitial={ownerInitial(pot.owner)} />
                  ))}
                  {filteredShort.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-sm text-[#9ba99a]">No short-term goals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 2: Wealth & Growth ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1a2b1a]">Wealth & Growth</h2>
            <Link href="/payday/setup" className="flex items-center gap-1 text-sm text-[#7bae7f] font-semibold hover:text-[#396940] transition-colors">
              <span className="text-base">⊞</span> Add Wealth Product
            </Link>
          </div>

          {viewMode === 'grid' ? (
            <>
              {ltOwners.map(owner => {
                const ownerPots = filteredLong.filter(p => p.owner === owner);
                if (ownerPots.length === 0) return null;
                return (
                  <div key={owner} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#396940] text-white text-xs font-bold">{ownerInitial(owner)}</span>
                      <span className="font-semibold text-[#1a2b1a] text-sm">{ownerLabel(owner)}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ownerPots.map(pot => <WealthCard key={pot.id} pot={pot} lastPayday={savingsMap[pot.id] ?? 0} onBalanceUpdate={handleBalanceUpdate} />)}
                    </div>
                  </div>
                );
              })}
              {filteredLong.length === 0 && <p className="text-sm text-[#9ba99a] mb-3">No wealth products yet.</p>}
              <div className="mt-2 max-w-xs"><AddWealthCard /></div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e6e9e7]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Owner</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Product Name</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Provider</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Activity</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-[#717970] uppercase tracking-wide">Current Balance</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLong.map(pot => (
                    <WealthTableRow key={pot.id} pot={pot} lastPayday={savingsMap[pot.id] ?? 0}
                      ownerInitial={ownerInitial(pot.owner)} onBalanceUpdate={handleBalanceUpdate} />
                  ))}
                  {filteredLong.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-[#9ba99a]">No wealth products yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

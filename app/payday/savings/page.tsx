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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SavingsPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [savingsMap, setSavingsMap] = useState<SavingsMap>({});
  const [filterOwner, setFilterOwner] = useState<'all' | 'person_a' | 'person_b' | 'joint'>('all');
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

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-7">
          {filterPills.map(pill => (
            <button
              key={pill.key}
              onClick={() => setFilterOwner(pill.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterOwner === pill.key
                  ? 'bg-[#396940] text-white'
                  : 'bg-white border border-[#c1c9be] text-[#414940] hover:border-[#396940]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* ── Section 1: Short-term Goals ── */}
        <div className="mb-9">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1a2b1a]">Short-term Goals</h2>
            <span className="text-sm text-[#7bae7f] font-medium">{activeGoalsCount} Active {activeGoalsCount === 1 ? 'Goal' : 'Goals'}</span>
          </div>

          {thisMonth.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[#9ba99a] uppercase tracking-widest mb-2">This Month</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {thisMonth.map(pot => (
                  <GoalCard key={pot.id} pot={pot} totalSaved={savingsMap[pot.id] ?? 0} />
                ))}
              </div>
            </div>
          )}

          {comingUp.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[#9ba99a] uppercase tracking-widest mb-2">Coming Up</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {comingUp.map(pot => (
                  <GoalCard key={pot.id} pot={pot} totalSaved={savingsMap[pot.id] ?? 0} />
                ))}
              </div>
            </div>
          )}

          {filteredShort.length === 0 && (
            <p className="text-sm text-[#9ba99a] mb-3">No short-term goals yet.</p>
          )}

          <div className="mt-2 max-w-xs">
            <AddGoalCard />
          </div>
        </div>

        {/* ── Section 2: Wealth & Growth ── */}
        <div>
          <h2 className="text-lg font-bold text-[#1a2b1a] mb-4">Wealth & Growth</h2>

          {ltOwners.map(owner => {
            const ownerPots = filteredLong.filter(p => p.owner === owner);
            if (ownerPots.length === 0) return null;
            return (
              <div key={owner} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#396940] text-white text-xs font-bold">
                    {ownerInitial(owner)}
                  </span>
                  <span className="font-semibold text-[#1a2b1a] text-sm">{ownerLabel(owner)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ownerPots.map(pot => (
                    <WealthCard
                      key={pot.id}
                      pot={pot}
                      lastPayday={savingsMap[pot.id] ?? 0}
                      onBalanceUpdate={handleBalanceUpdate}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filteredLong.length === 0 && (
            <p className="text-sm text-[#9ba99a] mb-3">No wealth products yet.</p>
          )}

          <div className="mt-2 max-w-xs">
            <AddWealthCard />
          </div>
        </div>
      </div>
    </div>
  );
}

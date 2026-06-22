'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'] });

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'savings_account', label: 'Savings', color: '#10b981' },
  { value: 'cash_isa', label: 'Cash ISA', color: '#3b82f6' },
  { value: 'stocks_isa', label: 'S&S ISA', color: '#6366f1' },
  { value: 'lisa', label: 'LISA', color: '#8b5cf6' },
  { value: 'pension', label: 'Pension', color: '#64748b' },
  { value: 'other', label: 'Other', color: '#f59e0b' },
];

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
  target_amount: number | null;
  target_months: number | null;
  target_date: string | null;
  sort_order: number;
  household_id: string;
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
const MODAL_BACKDROP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm';
const MODAL_CARD = 'bg-white rounded-3xl p-7 max-w-md w-full mx-4 shadow-2xl';
const LABEL_CLS = 'text-xs font-semibold text-[#717970] uppercase tracking-wide mb-2';
const MINPUT_CLS = 'w-full bg-[#f0f0eb] border-0 rounded-2xl px-4 py-3 text-sm font-medium text-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#7bae7f]';
const BTN_PRIMARY = 'bg-[#396940] text-white py-3 rounded-full font-semibold hover:bg-[#2d5533] transition-colors';
const BTN_SECONDARY = 'border-2 border-[#c1c9be] text-[#414940] py-3 rounded-full font-semibold hover:border-[#396940] transition-colors';

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── InvestModal ────────────────────────────────────────────────────────────────

function InvestModal({
  open, pot, household, onClose, onSave,
}: {
  open: boolean; pot: Pot | null; household: Household;
  onClose: () => void; onSave: (p: Pot) => void;
}) {
  const [accountType, setAccountType] = useState('savings_account');
  const [provider, setProvider] = useState('');
  const [label, setLabel] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [owner, setOwner] = useState<'person_a' | 'person_b' | 'joint'>('person_a');
  const [contribution, setContribution] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (pot) {
      setAccountType(pot.account_type || 'savings_account');
      setProvider(pot.provider || '');
      setLabel(pot.name);
      setNameEdited(true);
      setOwner((pot.owner as 'person_a' | 'person_b' | 'joint') || 'person_a');
      setContribution(pot.target_amount != null ? String(pot.target_amount) : '');
      setCurrentBalance(pot.current_balance != null ? String(pot.current_balance) : '');
    } else {
      setAccountType('savings_account');
      setProvider('');
      setLabel('');
      setNameEdited(false);
      setOwner('person_a');
      setContribution('');
      setCurrentBalance('');
    }
  }, [open, pot]);

  useEffect(() => {
    if (!nameEdited) {
      const typeLabel = ACCOUNT_TYPES.find(a => a.value === accountType)?.label || '';
      setLabel(provider ? `${provider} ${typeLabel}` : typeLabel);
    }
  }, [accountType, provider, nameEdited]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    const typeColor = ACCOUNT_TYPES.find(a => a.value === accountType)?.color || '#6366f1';
    const body = {
      householdId: household.id,
      name: label,
      owner,
      targetAmount: parseFloat(contribution) || null,
      targetMonths: null,
      targetDate: null,
      color: typeColor,
      potType: 'long_term',
      accountType,
      provider: provider || null,
      ...(pot ? { id: pot.id } : {}),
    };
    const res = await fetch('/api/payday/pots', {
      method: pot ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved: Pot = await res.json();
      if (currentBalance !== '') {
        await fetch('/api/payday/savings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: saved.id, currentBalance: parseFloat(currentBalance) || 0 }),
        });
        saved.current_balance = parseFloat(currentBalance) || 0;
      }
      onSave(saved);
      onClose();
    } else {
      setSaving(false);
    }
  }

  const ownerOptions: { value: 'person_a' | 'person_b' | 'joint'; label: string }[] = [
    { value: 'person_a', label: household.person_a_name },
    ...(household.mode === 'partner' ? [{ value: 'person_b' as const, label: household.person_b_name }] : []),
    { value: 'joint', label: 'Joint' },
  ];

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_CARD + ' max-h-[90vh] overflow-y-auto'} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#1a2b1a]">{pot ? 'Edit Investment' : 'Add Investment'}</h2>
          <button onClick={onClose} className="text-2xl text-[#717970] hover:text-[#1a2b1a] leading-none">×</button>
        </div>
        <div className="space-y-5">
          <div>
            <p className={LABEL_CLS}>Account type</p>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_TYPES.map(a => (
                <button key={a.value} onClick={() => setAccountType(a.value)}
                  className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${accountType === a.value ? 'text-white' : 'bg-[#f0f0eb] text-[#414940] hover:bg-[#e0e5e0]'}`}
                  style={accountType === a.value ? { background: a.color } : {}}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={LABEL_CLS}>Provider</p>
            <input type="text" value={provider} onChange={e => setProvider(e.target.value)}
              placeholder="e.g. Vanguard, Chase, Marcus" className={MINPUT_CLS} />
          </div>
          <div>
            <p className={LABEL_CLS}>Label</p>
            <input type="text" value={label} onChange={e => { setLabel(e.target.value); setNameEdited(true); }}
              placeholder="Account label" className={MINPUT_CLS} />
          </div>
          <div>
            <p className={LABEL_CLS}>Owner</p>
            <div className="flex gap-2 flex-wrap">
              {ownerOptions.map(o => (
                <button key={o.value} onClick={() => setOwner(o.value)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${owner === o.value ? 'bg-[#396940] text-white' : 'bg-[#f0f0eb] text-[#414940] hover:bg-[#e0e5e0]'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={LABEL_CLS}>Monthly contribution (optional)</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717970]">£</span>
              <input type="number" value={contribution} onChange={e => setContribution(e.target.value)}
                placeholder="0.00" className={MINPUT_CLS + ' pl-8'} />
            </div>
          </div>
          <div>
            <p className={LABEL_CLS}>Current balance (optional)</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717970]">£</span>
              <input type="number" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)}
                placeholder="0.00" className={MINPUT_CLS + ' pl-8'} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-7">
          <button onClick={onClose} className={BTN_SECONDARY + ' flex-1'}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !label.trim()} className={BTN_PRIMARY + ' flex-1 disabled:opacity-50'}>
            {saving ? 'Saving…' : pot ? 'Save Changes' : 'Add Investment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteModal ────────────────────────────────────────────────────────────────

function DeleteModal({
  open, pot, onClose, onDelete,
}: {
  open: boolean; pot: Pot | null; onClose: () => void; onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!open || !pot) return null;

  async function handleDelete() {
    if (!pot) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/payday/pots?id=${pot.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(pot.id);
        onClose();
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_CARD} onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <p className="text-[2.5rem] mb-4">🗑️</p>
          <h2 className="text-xl font-bold text-[#1a2b1a] mb-2">Delete &ldquo;{pot.name}&rdquo;?</h2>
          <p className="text-sm text-[#717970] mb-7">This will permanently remove this pot and cannot be undone.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className={BTN_SECONDARY + ' flex-1'}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 bg-[#ba1a1a] text-white py-3 rounded-full font-semibold hover:bg-[#8b1414] transition-colors disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [filterOwner, setFilterOwner] = useState<'all' | 'person_a' | 'person_b' | 'joint'>('all');
  const [investModal, setInvestModal] = useState<{ open: boolean; pot: Pot | null }>({ open: false, pot: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; pot: Pot | null }>({ open: false, pot: null });

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
                  const defaultStart = prevSnap ? prevSnap.end_balance : (pot.current_balance ?? 0);
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
    const m = selectedMonth;
    setSelectedMonth(m === 1 ? 2 : 1);
    setTimeout(() => setSelectedMonth(m), 0);
  }

  function handleInvestSave(saved: Pot) {
    setPots(prev => {
      const exists = prev.find(p => p.id === saved.id);
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
  }

  function handleDelete(id: string) {
    setPots(prev => prev.filter(p => p.id !== id));
    setRows(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalWealth = pots.reduce((sum, pot) => sum + (parseFloat(rows[pot.id]?.endBalance ?? '0') || 0), 0);

  const totalGrowth = pots.reduce((sum, pot) => {
    const row = rows[pot.id];
    if (!row) return sum;
    return sum + ((parseFloat(row.endBalance) || 0) - (parseFloat(row.startBalance) || 0) - (parseFloat(row.moneyIn) || 0) + (parseFloat(row.transferOut) || 0));
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
    return { yearStart, current, trueGrowth: current - yearStart - totalMoneyIn + totalTransferOut };
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

  const filterPills: { key: 'all' | 'person_a' | 'person_b' | 'joint'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'person_a', label: household?.person_a_name ?? 'Person A' },
    ...(household?.mode === 'partner' ? [{ key: 'person_b' as const, label: household?.person_b_name ?? 'Person B' }] : []),
    { key: 'joint', label: 'Joint' },
  ];

  const displayPots = filterOwner === 'all' ? pots : pots.filter(p => p.owner === filterOwner);

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      {/* Modals */}
      {household && (
        <InvestModal
          open={investModal.open}
          pot={investModal.pot}
          household={household}
          onClose={() => setInvestModal({ open: false, pot: null })}
          onSave={handleInvestSave}
        />
      )}
      <DeleteModal
        open={deleteModal.open}
        pot={deleteModal.pot}
        onClose={() => setDeleteModal({ open: false, pot: null })}
        onDelete={handleDelete}
      />

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
        {/* Page title + action buttons */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2b1a]">Growth</h1>
            <p className="text-sm text-[#717970] mt-0.5">Track your wealth month by month</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fillFromCurrentBalance}
              className="text-sm bg-white border border-[#c1c9be] text-[#414940] rounded-full px-4 py-2 hover:border-[#396940] transition-colors font-medium"
            >
              Update Balances
            </button>
            <button
              onClick={() => setInvestModal({ open: true, pot: null })}
              className="text-sm bg-[#396940] text-white rounded-full px-4 py-2 hover:bg-[#2d5533] transition-colors font-medium"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Year + view toggle */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-white border border-[#c1c9be] rounded-xl px-3 py-1.5 text-sm font-medium text-[#2d3130] focus:outline-none focus:ring-2 focus:ring-[#7bae7f]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="flex items-center gap-1 bg-white border border-[#c1c9be] rounded-xl p-1">
            <button onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'monthly' ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}>
              Monthly
            </button>
            <button onClick={() => setViewMode('annual')}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'annual' ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}>
              Annual
            </button>
          </div>
        </div>

        {/* Month pills (monthly view only) */}
        {viewMode === 'monthly' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
            {MONTH_NAMES.map((name, i) => {
              const m = i + 1;
              return (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedMonth === m ? 'bg-[#396940] text-white' : 'bg-white border border-[#c1c9be] text-[#414940] hover:border-[#396940]'
                  }`}>
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {/* Owner filter pills */}
        <div className="flex gap-2 flex-wrap mb-5">
          {filterPills.map(pill => (
            <button key={pill.key} onClick={() => setFilterOwner(pill.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterOwner === pill.key ? 'bg-[#396940] text-white' : 'bg-white border border-[#c1c9be] text-[#414940] hover:border-[#396940]'
              }`}>
              {pill.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {pots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e6e9e7] p-10 text-center">
            <p className="text-3xl mb-3">📈</p>
            <h2 className="text-lg font-bold text-[#1a2b1a] mb-2">No investment pots set up yet</h2>
            <p className="text-sm text-[#717970] mb-5">Add your first product to start tracking growth.</p>
            <button
              onClick={() => setInvestModal({ open: true, pot: null })}
              className="bg-[#396940] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#2d5533] transition-colors"
            >
              Add Product
            </button>
          </div>
        ) : viewMode === 'monthly' ? (
          /* ── Monthly table ── */
          <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-[#e6e9e7]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Product</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">Start Balance</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">In (New Money)</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">Transfer/Out</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">End Balance</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">True Growth</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {displayPots.map(pot => {
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
                          <input type="number" value={row.startBalance} onChange={e => updateRow(pot.id, 'startBalance', e.target.value)} className={INPUT_CLS} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input type="number" value={row.moneyIn} onChange={e => updateRow(pot.id, 'moneyIn', e.target.value)} className={INPUT_CLS} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input type="number" value={row.transferOut} onChange={e => updateRow(pot.id, 'transferOut', e.target.value)} className={INPUT_CLS} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#717970]">£</span>
                          <input type="number" value={row.endBalance} onChange={e => updateRow(pot.id, 'endBalance', e.target.value)} className={INPUT_CLS} />
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <p className="text-sm font-bold" style={{ color: growthColor }}>{trueGrowth >= 0 ? '+' : ''}£{fmt(trueGrowth)}</p>
                        <p className="text-xs" style={{ color: growthColor }}>{trueGrowth >= 0 ? '+' : ''}{growthPctRow.toFixed(2)}%</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3 text-[#9ba99a]">
                          <button onClick={() => setInvestModal({ open: true, pot })} className="hover:text-[#396940] transition-colors"><PencilIcon /></button>
                          <button onClick={() => setDeleteModal({ open: true, pot })} className="hover:text-[#ba1a1a] transition-colors"><TrashIcon /></button>
                        </div>
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
                  <th className="text-left py-3 px-3 text-xs font-semibold text-[#717970] uppercase tracking-wide">True Growth YTD</th>
                  <th className="py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {displayPots.map(pot => {
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
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3 text-[#9ba99a]">
                            <button onClick={() => setInvestModal({ open: true, pot })} className="hover:text-[#396940] transition-colors"><PencilIcon /></button>
                            <button onClick={() => setDeleteModal({ open: true, pot })} className="hover:text-[#ba1a1a] transition-colors"><TrashIcon /></button>
                          </div>
                        </td>
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
                      <td className="py-4 px-3">
                        <p className="text-sm font-bold" style={{ color: growthColor }}>{annual.trueGrowth >= 0 ? '+' : ''}£{fmt(annual.trueGrowth)}</p>
                        <p className="text-xs" style={{ color: growthColor }}>{annual.trueGrowth >= 0 ? '+' : ''}{growthPctAnnual.toFixed(2)}%</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3 text-[#9ba99a]">
                          <button onClick={() => setInvestModal({ open: true, pot })} className="hover:text-[#396940] transition-colors"><PencilIcon /></button>
                          <button onClick={() => setDeleteModal({ open: true, pot })} className="hover:text-[#ba1a1a] transition-colors"><TrashIcon /></button>
                        </div>
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
                  <span className="text-sm font-medium ml-1">({totalGrowth >= 0 ? '+' : ''}{growthPct.toFixed(2)}%)</span>
                </p>
              </div>
              {savedFeedback && <span className="text-sm text-[#7bae7f] font-semibold">Saved ✓</span>}
            </div>
            <div className="flex items-center gap-3">
              {dirty && (
                <button onClick={handleCancel}
                  className="px-5 py-2 rounded-full text-sm font-semibold border-2 border-[#c1c9be] text-[#414940] hover:border-[#396940] transition-colors">
                  Cancel
                </button>
              )}
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-full text-sm font-semibold bg-[#396940] text-white hover:bg-[#2d5533] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : `Save ${MONTH_FULL[selectedMonth - 1]} Update`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

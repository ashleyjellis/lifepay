'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'] });

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'savings_account', label: 'Savings', color: '#10b981' },
  { value: 'cash_isa', label: 'Cash ISA', color: '#3b82f6' },
  { value: 'stocks_isa', label: 'S&S ISA', color: '#6366f1' },
  { value: 'lisa', label: 'LISA', color: '#8b5cf6' },
  { value: 'pension', label: 'Pension', color: '#64748b' },
  { value: 'other', label: 'Other', color: '#f59e0b' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface Household {
  id: string; name: string; mode: 'solo' | 'partner';
  person_a_name: string; person_b_name: string; payday_day: number;
}

interface Pot {
  id: string; name: string; pot_type: string; account_type: string | null;
  provider: string | null; current_balance: number | null; owner: string;
  color: string; target_amount: number | null; target_months: number | null;
  target_date: string | null; sort_order: number; household_id: string;
}

interface ForecastSettings {
  id: string; household_id: string; growth_rate: number;
  person_a_monthly: number; person_b_monthly: number;
  person_a_bonus: number; person_b_bonus: number;
  horizon: number; start_year: number;
}

interface ForecastEvent {
  id: string; household_id: string; name: string; year: number; amount: number;
}

interface WealthSnapshot {
  pot_id: string; year: number; month: number; end_balance: number;
}

interface Session {
  id: string; date: string; locked_at: string | null; income_a: number; income_b: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtShort(n: number) {
  if (Math.abs(n) >= 1000000) return `£${(n / 1000000).toFixed(1)}m`;
  if (Math.abs(n) >= 1000) return `£${(n / 1000).toFixed(0)}k`;
  return `£${fmt(n)}`;
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

// ── Style constants ───────────────────────────────────────────────────────────

const MODAL_BACKDROP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm';
const MODAL_CARD = 'bg-white rounded-3xl p-7 max-w-md w-full mx-4 shadow-2xl';
const LABEL_CLS = 'text-xs font-semibold text-[#717970] uppercase tracking-wide mb-2';
const MINPUT_CLS = 'w-full bg-[#f0f0eb] border-0 rounded-2xl px-4 py-3 text-sm font-medium text-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#7bae7f]';
const BTN_PRIMARY = 'bg-[#396940] text-white py-3 rounded-full font-semibold hover:bg-[#2d5533] transition-colors';
const BTN_SECONDARY = 'border-2 border-[#c1c9be] text-[#414940] py-3 rounded-full font-semibold hover:border-[#396940] transition-colors';

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

// ── ContributionsModal ────────────────────────────────────────────────────────

function ContributionsModal({
  open, person, household, settings, sessions, onClose, onSave,
}: {
  open: boolean; person: 'a' | 'b'; household: Household; settings: ForecastSettings | null;
  sessions: Session[]; onClose: () => void; onSave: (updated: ForecastSettings) => void;
}) {
  const [monthly, setMonthly] = useState('');
  const [bonus, setBonus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (person === 'a') {
      setMonthly(settings?.person_a_monthly != null ? String(settings.person_a_monthly) : '0');
      setBonus(settings?.person_a_bonus != null ? String(settings.person_a_bonus) : '0');
    } else {
      setMonthly(settings?.person_b_monthly != null ? String(settings.person_b_monthly) : '0');
      setBonus(settings?.person_b_bonus != null ? String(settings.person_b_bonus) : '0');
    }
  }, [open, person, settings]);

  if (!open) return null;

  const lockedSessions = sessions.filter(s => s.locked_at);
  const avgIncome = lockedSessions.length > 0
    ? lockedSessions.reduce((sum, s) => sum + (person === 'a' ? s.income_a : s.income_b), 0) / lockedSessions.length
    : null;

  const monthlyVal = parseFloat(monthly) || 0;
  const bonusVal = parseFloat(bonus) || 0;
  const annualTotal = monthlyVal * 12 + bonusVal;
  const personName = person === 'a' ? household.person_a_name : household.person_b_name;

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    const body = {
      type: 'settings',
      householdId: household.id,
      growthRate: settings.growth_rate,
      personAMonthly: person === 'a' ? monthlyVal : settings.person_a_monthly,
      personBMonthly: person === 'b' ? monthlyVal : settings.person_b_monthly,
      personABonus: person === 'a' ? bonusVal : settings.person_a_bonus,
      personBBonus: person === 'b' ? bonusVal : settings.person_b_bonus,
      horizon: settings.horizon,
      startYear: settings.start_year,
    };
    const res = await fetch('/api/payday/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      onSave(updated as ForecastSettings);
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_CARD} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#1a2b1a]">{personName}&apos;s Contribution Assumptions</h2>
          <button onClick={onClose} className="text-2xl text-[#717970] hover:text-[#1a2b1a] leading-none">×</button>
        </div>
        <div className="space-y-5">
          <div>
            <p className={LABEL_CLS}>Monthly savings</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717970]">£</span>
              <input type="number" value={monthly} onChange={e => setMonthly(e.target.value)}
                placeholder="0" className={MINPUT_CLS + ' pl-8'} />
            </div>
            {avgIncome != null && (
              <p className="text-xs text-[#717970] mt-1.5">Avg from payday history: £{fmt(avgIncome)}/mo</p>
            )}
          </div>
          <div>
            <p className={LABEL_CLS}>Annual bonus</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717970]">£</span>
              <input type="number" value={bonus} onChange={e => setBonus(e.target.value)}
                placeholder="0" className={MINPUT_CLS + ' pl-8'} />
            </div>
          </div>
          <div className="bg-[#f7faf8] rounded-2xl px-4 py-3 text-sm text-[#717970]">
            Monthly × 12 + Bonus = <span className="font-bold text-[#1a2b1a]">£{fmt(annualTotal)}</span> /yr
          </div>
        </div>
        <div className="flex gap-3 mt-7">
          <button onClick={onClose} className={BTN_SECONDARY + ' flex-1'}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !settings} className={BTN_PRIMARY + ' flex-1 disabled:opacity-50'}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GrowthRateModal ───────────────────────────────────────────────────────────

function GrowthRateModal({
  open, settings, household, onClose, onSave,
}: {
  open: boolean; settings: ForecastSettings | null; household: Household | null;
  onClose: () => void; onSave: (updated: ForecastSettings) => void;
}) {
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRate(settings?.growth_rate != null ? String(settings.growth_rate) : '5');
  }, [open, settings]);

  if (!open || !household) return null;

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    const body = {
      type: 'settings',
      householdId: household!.id,
      growthRate: parseFloat(rate) || 5,
      personAMonthly: settings.person_a_monthly,
      personBMonthly: settings.person_b_monthly,
      personABonus: settings.person_a_bonus,
      personBBonus: settings.person_b_bonus,
      horizon: settings.horizon,
      startYear: settings.start_year,
    };
    const res = await fetch('/api/payday/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      onSave(updated as ForecastSettings);
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_CARD} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#1a2b1a]">Projected Growth Rate</h2>
          <button onClick={onClose} className="text-2xl text-[#717970] hover:text-[#1a2b1a] leading-none">×</button>
        </div>
        <div className="space-y-5">
          <div>
            <p className={LABEL_CLS}>Annual growth rate (%)</p>
            <div className="relative">
              <input type="number" value={rate} onChange={e => setRate(e.target.value)}
                placeholder="5" step="0.1" className={MINPUT_CLS + ' pr-8'} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717970]">%</span>
            </div>
          </div>
          <p className="text-sm text-[#717970]">
            This rate is applied to the starting balance each year to model organic investment growth (not including contributions).
          </p>
        </div>
        <div className="flex gap-3 mt-7">
          <button onClick={onClose} className={BTN_SECONDARY + ' flex-1'}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !settings} className={BTN_PRIMARY + ' flex-1 disabled:opacity-50'}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddEventModal ─────────────────────────────────────────────────────────────

function AddEventModal({
  open, household, years, onClose, onSave,
}: {
  open: boolean; household: Household | null; years: number[];
  onClose: () => void; onSave: (ev: ForecastEvent) => void;
}) {
  const [name, setName] = useState('');
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setYear(years[0] ?? new Date().getFullYear()); setAmount(''); }
  }, [open, years]);

  if (!open || !household) return null;

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/payday/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'event', householdId: household!.id, name, year, amount: parseFloat(amount) || 0 }),
    });
    if (res.ok) {
      const created = await res.json();
      onSave(created as ForecastEvent);
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div className={MODAL_CARD} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#1a2b1a]">Add Planned Event</h2>
          <button onClick={onClose} className="text-2xl text-[#717970] hover:text-[#1a2b1a] leading-none">×</button>
        </div>
        <div className="space-y-5">
          <div>
            <p className={LABEL_CLS}>Event name</p>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Wedding, House Move, Education" className={MINPUT_CLS} />
          </div>
          <div>
            <p className={LABEL_CLS}>Year</p>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className={MINPUT_CLS}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <p className={LABEL_CLS}>Amount</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717970]">£</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" className={MINPUT_CLS + ' pl-8'} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-7">
          <button onClick={onClose} className={BTN_SECONDARY + ' flex-1'}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className={BTN_PRIMARY + ' flex-1 disabled:opacity-50'}>
            {saving ? 'Saving…' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [settings, setSettings] = useState<ForecastSettings | null>(null);
  const [events, setEvents] = useState<ForecastEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [annualSnapshots, setAnnualSnapshots] = useState<WealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  // Modal states
  const [contribModal, setContribModal] = useState<{ open: boolean; person: 'a' | 'b' } | null>(null);
  const [growthModal, setGrowthModal] = useState(false);
  const [addEventModal, setAddEventModal] = useState(false);
  const [investModal, setInvestModal] = useState<{ open: boolean; pot: Pot | null }>({ open: false, pot: null });
  // Inline event editing
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventVal, setEditingEventVal] = useState('');
  // Setup gate balance editing
  const [setupBalances, setSetupBalances] = useState<Record<string, string>>({});

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

      const [potsRes, forecastRes, sessionsRes, snapsThisRes, snapsPrevRes] = await Promise.all([
        fetch(`/api/payday/pots?householdId=${h.id}`),
        fetch(`/api/payday/forecast?householdId=${h.id}`),
        fetch(`/api/payday/sessions?householdId=${h.id}`),
        fetch(`/api/payday/growth?householdId=${h.id}&year=${new Date().getFullYear()}&annual=1`),
        fetch(`/api/payday/growth?householdId=${h.id}&year=${new Date().getFullYear() - 1}&annual=1`),
      ]);

      let longTermPots: Pot[] = [];
      if (potsRes.ok) {
        const allPots: Pot[] = await potsRes.json();
        longTermPots = allPots.filter(p => p.pot_type === 'long_term');
        setPots(longTermPots);
        const initBalances: Record<string, string> = {};
        longTermPots.forEach(p => { initBalances[p.id] = p.current_balance != null ? String(p.current_balance) : ''; });
        setSetupBalances(initBalances);
      }

      if (forecastRes.ok) {
        const fd = await forecastRes.json();
        setSettings(fd.settings ?? null);
        setEvents(Array.isArray(fd.events) ? fd.events : []);
      }

      if (sessionsRes.ok) {
        const sd = await sessionsRes.json();
        setSessions(Array.isArray(sd) ? sd : []);
      }

      const snaps: WealthSnapshot[] = [];
      if (snapsThisRes.ok) {
        const d = await snapsThisRes.json();
        if (Array.isArray(d)) snaps.push(...d);
      }
      if (snapsPrevRes.ok) {
        const d = await snapsPrevRes.json();
        if (Array.isArray(d)) snaps.push(...d);
      }
      setAnnualSnapshots(snaps);

      // Decide whether to show setup gate
      const noBalance = longTermPots.length === 0 || longTermPots.every(p => p.current_balance == null || p.current_balance === 0);
      setShowSetup(noBalance);

      setLoading(false);
    }
    load();
  }, [router]);

  // ── Derived calculations ───────────────────────────────────────────────────

  const currentYear = new Date().getFullYear();
  const horizon = settings?.horizon ?? 10;
  const forecastYears = Array.from({ length: horizon }, (_, i) => (settings?.start_year ?? currentYear) + i);
  const startingWealth = pots.reduce((s, p) => s + (p.current_balance ?? 0), 0);

  const yearData: Array<{
    startBalance: number; annualA: number; annualB: number; contributions: number;
    plannedOut: number; projectedGrowth: number; endBalance: number; yearEvents: ForecastEvent[];
  }> = [];
  let prevEnd = startingWealth;
  for (let i = 0; i < forecastYears.length; i++) {
    const startBalance = i === 0 ? startingWealth : prevEnd;
    const annualA = ((settings?.person_a_monthly ?? 0) * 12) + (settings?.person_a_bonus ?? 0);
    const annualB = household?.mode === 'partner' ? ((settings?.person_b_monthly ?? 0) * 12) + (settings?.person_b_bonus ?? 0) : 0;
    const contributions = annualA + annualB;
    const yearEvents = events.filter(e => e.year === forecastYears[i]);
    const plannedOut = yearEvents.reduce((s, e) => s + e.amount, 0);
    const projectedGrowth = startBalance * ((settings?.growth_rate ?? 5) / 100);
    const endBalance = startBalance + contributions - plannedOut + projectedGrowth;
    prevEnd = endBalance;
    yearData.push({ startBalance, annualA, annualB, contributions, plannedOut, projectedGrowth, endBalance, yearEvents });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function saveHorizon(h: number) {
    if (!household || !settings) return;
    const body = {
      type: 'settings', householdId: household.id,
      growthRate: settings.growth_rate,
      personAMonthly: settings.person_a_monthly, personBMonthly: settings.person_b_monthly,
      personABonus: settings.person_a_bonus, personBBonus: settings.person_b_bonus,
      horizon: h, startYear: settings.start_year,
    };
    const res = await fetch('/api/payday/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { const u = await res.json(); setSettings(u as ForecastSettings); }
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/payday/forecast?id=${id}`, { method: 'DELETE' });
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  async function saveEventAmount(ev: ForecastEvent, newAmount: number) {
    const res = await fetch('/api/payday/forecast', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ev.id, name: ev.name, year: ev.year, amount: newAmount }),
    });
    if (res.ok) {
      const updated = await res.json() as ForecastEvent;
      setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
    }
  }

  async function saveSetupBalance(potId: string) {
    const val = parseFloat(setupBalances[potId]) || 0;
    await fetch('/api/payday/savings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: potId, currentBalance: val }),
    });
    setPots(prev => prev.map(p => p.id === potId ? { ...p, current_balance: val } : p));
  }

  async function handleGenerateForecast() {
    if (!household) return;
    const body = {
      type: 'settings', householdId: household.id,
      growthRate: settings?.growth_rate ?? 5,
      personAMonthly: settings?.person_a_monthly ?? 0,
      personBMonthly: settings?.person_b_monthly ?? 0,
      personABonus: settings?.person_a_bonus ?? 0,
      personBBonus: settings?.person_b_bonus ?? 0,
      horizon: settings?.horizon ?? 10,
      startYear: currentYear,
    };
    const res = await fetch('/api/payday/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { const u = await res.json(); setSettings(u as ForecastSettings); }
    setShowSetup(false);
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className} flex items-center justify-center`}>
        <p className="text-[#717970]">Loading…</p>
      </div>
    );
  }

  // ── Unique event names (for sub-rows) ────────────────────────────────────

  const uniqueEventNames = Array.from(new Set(events.map(e => e.name)));

  // ── Past years for actuals ───────────────────────────────────────────────

  const pastYears = forecastYears.filter(y => y < currentYear);

  // ── Summary bar calcs ────────────────────────────────────────────────────

  const totalMonthly = (settings?.person_a_monthly ?? 0) + (household?.mode === 'partner' ? (settings?.person_b_monthly ?? 0) : 0);
  const totalEvents = events.reduce((s, e) => s + e.amount, 0);

  // ── Setup gate ────────────────────────────────────────────────────────────

  if (showSetup) {
    const hasBalance = pots.some(p => {
      const v = parseFloat(setupBalances[p.id] ?? '');
      return !isNaN(v) && v > 0;
    });

    return (
      <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
        {/* Modals */}
        {household && (
          <InvestModal
            open={investModal.open}
            pot={investModal.pot}
            household={household}
            onClose={() => setInvestModal({ open: false, pot: null })}
            onSave={saved => {
              setPots(prev => {
                const exists = prev.find(p => p.id === saved.id);
                const next = exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
                return next;
              });
              setSetupBalances(prev => ({ ...prev, [saved.id]: saved.current_balance != null ? String(saved.current_balance) : '' }));
            }}
          />
        )}

        <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
            <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
            <div className="flex gap-5 items-center">
              <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Paydays</Link>
              <Link href="/payday/savings" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Short Savings</Link>
              <Link href="/payday/growth" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Growth</Link>
              <Link href="/payday/forecast" className="text-sm text-[#396940] font-semibold transition-colors">Forecast</Link>
              <Link href="/payday/setup" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Setup</Link>
              <button
                onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
                className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors"
              >Sign out</button>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-5 pt-12 pb-24">
          <div className="bg-white rounded-3xl border border-[#e6e9e7] p-8 text-center">
            <p className="text-4xl mb-4">📊</p>
            <h1 className="text-2xl font-bold text-[#1a2b1a] mb-2">Set up your wealth position</h1>
            <p className="text-sm text-[#717970] mb-8">Before we can model a forecast, we need to know your current savings and investment accounts and what they&apos;re worth.</p>

            {pots.length > 0 && (
              <div className="space-y-3 mb-6 text-left">
                {pots.map(pot => (
                  <div key={pot.id} className="flex items-center gap-3 bg-[#f7faf8] rounded-2xl px-4 py-3">
                    <span className="text-xl">{accountTypeIcon(pot.account_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1a2b1a] truncate">{pot.name}</p>
                      <p className="text-xs text-[#717970]">{accountTypeLabel(pot.account_type)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-[#717970]">£</span>
                      <input
                        type="number"
                        value={setupBalances[pot.id] ?? ''}
                        onChange={e => setSetupBalances(prev => ({ ...prev, [pot.id]: e.target.value }))}
                        onBlur={() => saveSetupBalance(pot.id)}
                        onKeyDown={e => { if (e.key === 'Enter') saveSetupBalance(pot.id); }}
                        placeholder="0"
                        className="w-28 bg-white border border-[#c1c9be] rounded-xl px-3 py-1.5 text-sm font-medium text-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setInvestModal({ open: true, pot: null })}
                className="w-full border-2 border-dashed border-[#c1c9be] text-[#717970] rounded-2xl py-3 text-sm font-semibold hover:border-[#396940] hover:text-[#396940] transition-colors"
              >
                + Add Account
              </button>
              <button
                disabled={!hasBalance}
                onClick={handleGenerateForecast}
                className={`w-full ${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Generate Forecast →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main forecast view ────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      {/* Modals */}
      {household && (
        <>
          <InvestModal
            open={investModal.open}
            pot={investModal.pot}
            household={household}
            onClose={() => setInvestModal({ open: false, pot: null })}
            onSave={saved => {
              setPots(prev => {
                const exists = prev.find(p => p.id === saved.id);
                return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
              });
            }}
          />
          <ContributionsModal
            open={contribModal?.open ?? false}
            person={contribModal?.person ?? 'a'}
            household={household}
            settings={settings}
            sessions={sessions}
            onClose={() => setContribModal(null)}
            onSave={updated => setSettings(updated)}
          />
          <GrowthRateModal
            open={growthModal}
            settings={settings}
            household={household}
            onClose={() => setGrowthModal(false)}
            onSave={updated => setSettings(updated)}
          />
          <AddEventModal
            open={addEventModal}
            household={household}
            years={forecastYears}
            onClose={() => setAddEventModal(false)}
            onSave={ev => setEvents(prev => [...prev, ev])}
          />
        </>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
          <div className="flex gap-5 items-center">
            <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Paydays</Link>
            <Link href="/payday/savings" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Short Savings</Link>
            <Link href="/payday/growth" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Growth</Link>
            <Link href="/payday/forecast" className="text-sm text-[#396940] font-semibold transition-colors">Forecast</Link>
            <Link href="/payday/setup" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Setup</Link>
            <button
              onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors"
            >Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 pt-6 pb-24">
        {/* Page title */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2b1a]">Forecast</h1>
            <p className="text-sm text-[#717970] mt-0.5">Your 10-year wealth projection</p>
          </div>
          {/* Horizon toggle */}
          <div className="flex items-center gap-1 bg-white border border-[#c1c9be] rounded-xl p-1">
            {[5, 10].map(h => (
              <button key={h} onClick={() => saveHorizon(h)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${horizon === h ? 'bg-[#396940] text-white' : 'text-[#717970] hover:text-[#396940]'}`}>
                {h} Year
              </button>
            ))}
          </div>
        </div>

        {/* Plan table */}
        <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-x-auto mb-5">
          <table className="w-full">
            <colgroup>
              <col style={{ minWidth: '200px' }} />
              {forecastYears.map(y => <col key={y} style={{ width: '110px' }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-[#e6e9e7]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide"></th>
                {forecastYears.map(y => (
                  <th key={y} className="py-3 px-3 text-xs font-bold text-[#717970] uppercase tracking-wide text-right">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Starting Balance */}
              <tr className="border-b border-[#f0f2f0]">
                <td className="py-3 px-4 text-sm font-bold text-[#1a2b1a]">Starting Balance</td>
                {yearData.map((yd, i) => (
                  <td key={i} className="py-3 px-3 text-sm font-bold text-[#1a2b1a] text-right">£{fmt(yd.startBalance)}</td>
                ))}
              </tr>

              {/* Row 2: Person A Contributions */}
              <tr className="border-b border-[#f0f2f0]">
                <td
                  className="py-3 px-4 text-sm italic text-[#414940] cursor-pointer hover:underline"
                  onClick={() => setContribModal({ open: true, person: 'a' })}
                >
                  {household?.person_a_name} Contributions
                </td>
                {yearData.map((yd, i) => (
                  <td key={i} className="py-3 px-3 text-sm italic text-[#414940] text-right">£{fmt(yd.annualA)}</td>
                ))}
              </tr>

              {/* Row 3: Person B Contributions (partner mode only) */}
              {household?.mode === 'partner' && (
                <tr className="border-b border-[#f0f2f0]">
                  <td
                    className="py-3 px-4 text-sm italic text-[#414940] cursor-pointer hover:underline"
                    onClick={() => setContribModal({ open: true, person: 'b' })}
                  >
                    {household.person_b_name} Contributions
                  </td>
                  {yearData.map((yd, i) => (
                    <td key={i} className="py-3 px-3 text-sm italic text-[#414940] text-right">£{fmt(yd.annualB)}</td>
                  ))}
                </tr>
              )}

              {/* Row 4: Planned Events */}
              <tr className="border-b border-[#f0f2f0]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#c07000]">🗓 Planned Events</span>
                    <button
                      onClick={() => setAddEventModal(true)}
                      className="text-xs bg-[#fef3c7] text-[#c07000] rounded-full px-2 py-0.5 font-semibold hover:bg-[#fde68a] transition-colors"
                    >+ Add</button>
                  </div>
                </td>
                {yearData.map((yd, i) => (
                  <td key={i} className="py-3 px-3 text-sm font-bold text-[#c07000] text-right">
                    {yd.plannedOut > 0 ? `£${fmt(yd.plannedOut)}` : '£0'}
                  </td>
                ))}
              </tr>

              {/* Event sub-rows */}
              {uniqueEventNames.map(evName => (
                <tr key={evName} className="border-b border-[#f0f2f0] bg-[#fffbf0]">
                  <td className="py-2 px-4 pl-8">
                    <div className="flex items-center gap-2">
                      <span className="text-sm italic text-[#9b7a00]">{evName}</span>
                      <button
                        onClick={() => {
                          const evIds = events.filter(e => e.name === evName).map(e => e.id);
                          evIds.forEach(id => deleteEvent(id));
                        }}
                        className="text-[#c07000] hover:text-[#8b3a00] transition-colors text-xs"
                        title="Delete event"
                      >×</button>
                    </div>
                  </td>
                  {forecastYears.map((y, i) => {
                    const ev = events.find(e => e.name === evName && e.year === y);
                    if (!ev) return <td key={i} className="py-2 px-3 text-sm text-[#c9c9be] text-right">—</td>;
                    return (
                      <td key={i} className="py-2 px-3 text-right">
                        {editingEventId === ev.id ? (
                          <input
                            type="number"
                            autoFocus
                            value={editingEventVal}
                            onChange={e => setEditingEventVal(e.target.value)}
                            onBlur={() => {
                              saveEventAmount(ev, parseFloat(editingEventVal) || 0);
                              setEditingEventId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                saveEventAmount(ev, parseFloat(editingEventVal) || 0);
                                setEditingEventId(null);
                              }
                              if (e.key === 'Escape') setEditingEventId(null);
                            }}
                            className="w-24 bg-white border border-[#7bae7f] rounded-lg px-2 py-0.5 text-sm text-right focus:outline-none"
                          />
                        ) : (
                          <span
                            className="text-sm italic text-[#9b7a00] cursor-pointer hover:underline"
                            onClick={() => { setEditingEventId(ev.id); setEditingEventVal(String(ev.amount)); }}
                          >
                            £{fmt(ev.amount)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Row 5: Projected Growth */}
              <tr className="border-b border-[#f0f2f0]">
                <td
                  className="py-3 px-4 cursor-pointer"
                  onClick={() => setGrowthModal(true)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#396940]">📈 Projected Growth</span>
                    <span className="text-xs text-[#717970]">({settings?.growth_rate ?? 5}%)</span>
                  </div>
                </td>
                {yearData.map((yd, i) => (
                  <td key={i} className="py-3 px-3 text-sm font-bold text-[#396940] text-right">+£{fmt(yd.projectedGrowth)}</td>
                ))}
              </tr>

              {/* Row 6: End Balance */}
              <tr>
                <td className="py-4 px-4 text-base font-bold text-[#1a2b1a] border-t border-[#c1c9be]">End Balance</td>
                {yearData.map((yd, i) => (
                  <td key={i} className="py-4 px-3 text-base font-bold text-[#1a2b1a] text-right border-t border-[#c1c9be]">£{fmt(yd.endBalance)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary bar */}
        <div className="bg-white rounded-2xl border border-[#e6e9e7] px-6 py-4 flex items-center gap-8 mt-5 flex-wrap mb-8">
          <div>
            <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide">📈 Growth Rate</p>
            <p className="text-sm font-bold text-[#1a2b1a]">{settings?.growth_rate ?? 5}% Avg.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide">💳 Monthly Sub</p>
            <p className="text-sm font-bold text-[#1a2b1a]">£{fmt(totalMonthly)} /mo</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide">🎁 Planned Events</p>
            <p className="text-sm font-bold text-[#1a2b1a]">{fmtShort(totalEvents)} total</p>
          </div>
        </div>

        {/* Actuals section */}
        <div>
          <h2 className="text-xl font-bold text-[#1a2b1a] mb-4">How are we tracking?</h2>
          {pastYears.length === 0 || annualSnapshots.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e6e9e7] p-8 text-center">
              <p className="text-sm text-[#717970]">No actuals data yet. Come back after your first Growth update.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#e6e9e7]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Year</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Plan End Balance</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Actual End Balance</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Difference</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {pastYears.map((y, idx) => {
                    const planEnd = yearData[idx]?.endBalance ?? 0;
                    // Get latest snapshot for that year
                    const yearSnaps = annualSnapshots.filter(s => s.year === y);
                    if (yearSnaps.length === 0) {
                      return (
                        <tr key={y} className="border-b border-[#f0f2f0]">
                          <td className="py-3 px-4 text-sm font-semibold text-[#1a2b1a]">{y}</td>
                          <td className="py-3 px-4 text-sm text-right text-[#1a2b1a]">£{fmt(planEnd)}</td>
                          <td colSpan={3} className="py-3 px-4 text-sm text-[#9ba99a] text-right">No data</td>
                        </tr>
                      );
                    }
                    // Sum end_balance by pot for the latest month
                    const maxMonth = Math.max(...yearSnaps.map(s => s.month));
                    const latestSnaps = yearSnaps.filter(s => s.month === maxMonth);
                    const actualEnd = latestSnaps.reduce((sum, s) => sum + s.end_balance, 0);
                    const diff = actualEnd - planEnd;
                    const variance = planEnd !== 0 ? (diff / planEnd) * 100 : 0;
                    const diffColor = diff >= 0 ? '#396940' : '#ba1a1a';
                    return (
                      <tr key={y} className="border-b border-[#f0f2f0]">
                        <td className="py-3 px-4 text-sm font-semibold text-[#1a2b1a]">{y}</td>
                        <td className="py-3 px-4 text-sm text-right text-[#1a2b1a]">£{fmt(planEnd)}</td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-[#1a2b1a]">£{fmt(actualEnd)}</td>
                        <td className="py-3 px-4 text-sm text-right font-bold" style={{ color: diffColor }}>
                          {diff >= 0 ? '+' : ''}£{fmt(diff)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold" style={{ color: diffColor }}>
                          {diff >= 0 ? '+' : ''}{variance.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

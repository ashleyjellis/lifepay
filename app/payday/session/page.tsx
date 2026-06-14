'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4 | 5;
type ExtraWho = 'both' | 'a' | 'b';

interface Household {
  id: string; name: string; mode: 'solo' | 'partner';
  person_a_name: string; person_b_name: string;
  joint_split_a: number;
  default_spending_a: number; default_spending_b: number;
  default_transport_a: number; default_transport_b: number;
}

interface Bill { id: string; name: string; amount: number; category: string; }
interface Debt { id: string; name: string; amount: number; person: 'a' | 'b'; }
interface Pot { id: string; name: string; target_amount: number | null; color: string; owner: string; pot_type: string; }
interface SessionBill { billId?: string; name: string; amount: number; category: string; _key: string; }
interface ExtraLine { _key: string; name: string; amount: string; who: ExtraWho; }

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);
const fmtShort = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
function uid() { return Math.random().toString(36).slice(2); }

function getLockableMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

const LOCKABLE_MONTH = getLockableMonth();
const budgetMonthLabel = monthLabel(LOCKABLE_MONTH);

export default function SessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [household, setHousehold] = useState<Household | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Step 1 — income (no starting balance)
  const [incomeA, setIncomeA] = useState('');
  const [incomeB, setIncomeB] = useState('');

  // Step 2 — joint fixed bills
  const [jointBills, setJointBills] = useState<SessionBill[]>([]);

  // Step 3 — joint extras (with who-pays)
  const [extras, setExtras] = useState<ExtraLine[]>([{ _key: uid(), name: '', amount: '', who: 'both' }]);

  // Step 4 — individual bills + debts + lifestyle
  const [indivBillsA, setIndivBillsA] = useState<SessionBill[]>([]);
  const [indivBillsB, setIndivBillsB] = useState<SessionBill[]>([]);
  const [sessionDebtsA, setSessionDebtsA] = useState<SessionBill[]>([]);
  const [sessionDebtsB, setSessionDebtsB] = useState<SessionBill[]>([]);
  const [spendingA, setSpendingA] = useState('');
  const [spendingB, setSpendingB] = useState('');
  const [travelA, setTravelA] = useState('');
  const [travelB, setTravelB] = useState('');

  // Step 5 — % allocations per person per pot
  const [percentsA, setPercentsA] = useState<Record<string, string>>({});
  const [percentsB, setPercentsB] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);

  async function logout() {
    await fetch('/api/payday/auth/logout', { method: 'POST' });
    router.push('/payday/login');
  }

  const load = useCallback(async () => {
    const meRes = await fetch('/api/payday/auth/me');
    if (meRes.status === 401) { router.push('/payday/login'); return; }
    const me = await meRes.json();
    setUserEmail(me?.email ?? '');

    const hRes = await fetch('/api/payday/households');
    if (!hRes.ok) return;
    const hh: Household = await hRes.json();
    if (!hh) { window.location.href = '/payday/setup'; return; }
    setHousehold(hh);

    // If the upcoming month's payday is already locked, redirect to its dashboard
    const allRes = await fetch(`/api/payday/sessions?householdId=${hh.id}`);
    let allSessionsList: { id: string; date: string; locked_at: string | null; income_a: number; income_b: number; spending_a: number; spending_b: number; travel_a: number; travel_b: number }[] = [];
    if (allRes.ok) {
      allSessionsList = await allRes.json();
      const existing = allSessionsList.find(s => s.locked_at && s.date.startsWith(LOCKABLE_MONTH));
      if (existing) { router.replace(`/payday/dashboard/${existing.id}`); return; }
    }

    const [bRes, pRes, dRes] = await Promise.all([
      fetch(`/api/payday/bills?householdId=${hh.id}`),
      fetch(`/api/payday/pots?householdId=${hh.id}`),
      fetch(`/api/payday/debts?householdId=${hh.id}`),
    ]);
    const bills: Bill[] = await bRes.json();
    const pts: Pot[] = await pRes.json();
    const dts: Bill[] = await dRes.json();

    setPots(pts);

    setJointBills(bills.filter(b => b.category === 'joint_fixed').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setIndivBillsA(bills.filter(b => b.category === 'individual_a').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setIndivBillsB(bills.filter(b => b.category === 'individual_b').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setSessionDebtsA((dts as unknown as Debt[]).filter((d: Debt) => d.person === 'a').map(d => ({
      billId: d.id, name: d.name, amount: d.amount, category: 'debt_a', _key: d.id,
    })));
    setSessionDebtsB((dts as unknown as Debt[]).filter((d: Debt) => d.person === 'b').map(d => ({
      billId: d.id, name: d.name, amount: d.amount, category: 'debt_b', _key: d.id,
    })));

    setSpendingA(hh.default_spending_a > 0 ? String(hh.default_spending_a) : '');
    setSpendingB(hh.default_spending_b > 0 ? String(hh.default_spending_b) : '');
    setTravelA(hh.default_transport_a > 0 ? String(hh.default_transport_a) : '');
    setTravelB(hh.default_transport_b > 0 ? String(hh.default_transport_b) : '');

    const pa: Record<string, string> = {};
    const pb: Record<string, string> = {};
    pts.forEach(p => { pa[p.id] = ''; pb[p.id] = ''; });

    // Pre-populate income + savings % from the most recent locked session
    const lastLocked = allSessionsList.filter(s => s.locked_at).sort((a, b) => b.date.localeCompare(a.date))[0];

    if (lastLocked) {
      setIncomeA(String(lastLocked.income_a || ''));
      setIncomeB(String(lastLocked.income_b || ''));

      // Back-calculate savings % from last session's allocations
      const lastRes = await fetch(`/api/payday/sessions?id=${lastLocked.id}`);
      if (lastRes.ok) {
        const lastData = await lastRes.json();
        const lastBills: { name: string; amount: number; category: string }[] = lastData.bills ?? [];
        const lastAllocs: { pot_id: string; amount: number }[] = lastData.allocations ?? [];

        const splitAn = hh.joint_split_a;
        const splitBn = 100 - splitAn;
        const lastJointFixed = lastBills.filter(b => b.category === 'joint_fixed').reduce((s, b) => s + Number(b.amount), 0);
        const lastExtrasA = lastBills.reduce((s, b) => {
          if (b.category === 'joint_extra') return s + Number(b.amount) * (splitAn / 100);
          if (b.category === 'joint_extra_a') return s + Number(b.amount);
          return s;
        }, 0);
        const lastExtrasB = lastBills.reduce((s, b) => {
          if (b.category === 'joint_extra') return s + Number(b.amount) * (splitBn / 100);
          if (b.category === 'joint_extra_b') return s + Number(b.amount);
          return s;
        }, 0);
        const lastPersonalA = lastBills.filter(b => ['individual_a','debt_a'].includes(b.category)).reduce((s, b) => s + Number(b.amount), 0)
          + Number(lastLocked.spending_a) + Number(lastLocked.travel_a);
        const lastPersonalB = lastBills.filter(b => ['individual_b','debt_b'].includes(b.category)).reduce((s, b) => s + Number(b.amount), 0)
          + Number(lastLocked.spending_b) + Number(lastLocked.travel_b);

        const lastAvailA = Number(lastLocked.income_a) - (lastJointFixed * splitAn / 100) - lastExtrasA - lastPersonalA;
        const lastAvailB = Number(lastLocked.income_b) - (lastJointFixed * splitBn / 100) - lastExtrasB - lastPersonalB;

        if (lastAvailA > 0) {
          lastAllocs.forEach(a => {
            const pot = pts.find(p => p.id === a.pot_id);
            if (pot && (pot.owner === 'person_a')) {
              pa[a.pot_id] = String(Math.round((Number(a.amount) / lastAvailA) * 100));
            }
          });
        }
        if (lastAvailB > 0) {
          lastAllocs.forEach(a => {
            const pot = pts.find(p => p.id === a.pot_id);
            if (pot && (pot.owner === 'person_b')) {
              pb[a.pot_id] = String(Math.round((Number(a.amount) / lastAvailB) * 100));
            }
          });
        }
      }
    }

    // Override with draft session data if one exists for this month
    const draft = allSessionsList.find(s => !s.locked_at && s.date.startsWith(LOCKABLE_MONTH));
    if (draft) {
      setSessionId(draft.id);
      const draftRes = await fetch(`/api/payday/sessions?id=${draft.id}`);
      if (draftRes.ok) {
        const draftData = await draftRes.json();
        const ds = draftData.session;
        if (ds.income_a) setIncomeA(String(ds.income_a));
        if (ds.income_b) setIncomeB(String(ds.income_b));
        if (ds.spending_a) setSpendingA(String(ds.spending_a));
        if (ds.spending_b) setSpendingB(String(ds.spending_b));
        if (ds.travel_a) setTravelA(String(ds.travel_a));
        if (ds.travel_b) setTravelB(String(ds.travel_b));
        const draftExtras: ExtraLine[] = (draftData.bills as { name: string; amount: number; category: string }[])
          .filter(b => ['joint_extra','joint_extra_a','joint_extra_b'].includes(b.category))
          .map(b => ({ _key: uid(), name: b.name, amount: String(b.amount),
            who: b.category === 'joint_extra_a' ? 'a' : b.category === 'joint_extra_b' ? 'b' : 'both' }));
        if (draftExtras.length > 0) setExtras(draftExtras);
        // Back-calculate savings % from draft allocations
        const splitAn = hh.joint_split_a;
        const splitBn = 100 - splitAn;
        const dBills: { name: string; amount: number; category: string }[] = draftData.bills ?? [];
        const dAllocs: { pot_id: string; amount: number }[] = draftData.allocations ?? [];
        const dJF = dBills.filter(b => b.category === 'joint_fixed').reduce((s, b) => s + Number(b.amount), 0);
        const dExA = dBills.reduce((s, b) => b.category === 'joint_extra' ? s + Number(b.amount) * (splitAn/100) : b.category === 'joint_extra_a' ? s + Number(b.amount) : s, 0);
        const dExB = dBills.reduce((s, b) => b.category === 'joint_extra' ? s + Number(b.amount) * (splitBn/100) : b.category === 'joint_extra_b' ? s + Number(b.amount) : s, 0);
        const dPA = dBills.filter(b => ['individual_a','debt_a'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0) + Number(ds.spending_a) + Number(ds.travel_a);
        const dPB = dBills.filter(b => ['individual_b','debt_b'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0) + Number(ds.spending_b) + Number(ds.travel_b);
        const dAvA = Number(ds.income_a) - (dJF * splitAn/100) - dExA - dPA;
        const dAvB = Number(ds.income_b) - (dJF * splitBn/100) - dExB - dPB;
        if (dAvA > 0) dAllocs.forEach(a => { const pot = pts.find(p => p.id === a.pot_id); if (pot?.owner === 'person_a') pa[a.pot_id] = String(Math.round(Number(a.amount)/dAvA*100)); });
        if (dAvB > 0) dAllocs.forEach(a => { const pot = pts.find(p => p.id === a.pot_id); if (pot?.owner === 'person_b') pb[a.pot_id] = String(Math.round(Number(a.amount)/dAvB*100)); });
      }
    }

    setPercentsA(pa);
    setPercentsB(pb);

    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const hh = household;
  const isPartner = hh?.mode === 'partner';
  const splitA = hh?.joint_split_a ?? 50;
  const splitB = 100 - splitA;

  const iA = parseFloat(incomeA) || 0;
  const iB = parseFloat(incomeB) || 0;
  const totalIn = iA + iB;

  const jointTotal = jointBills.reduce((s, b) => s + b.amount, 0);

  // Per-person extra cost
  const extrasForA = extras.reduce((s, e) => {
    const amt = parseFloat(e.amount) || 0;
    if (e.who === 'a') return s + amt;
    if (e.who === 'both') return s + amt * (splitA / 100);
    return s;
  }, 0);
  const extrasForB = extras.reduce((s, e) => {
    const amt = parseFloat(e.amount) || 0;
    if (e.who === 'b') return s + amt;
    if (e.who === 'both') return s + amt * (splitB / 100);
    return s;
  }, 0);

  const personAIndivTotal = indivBillsA.reduce((s, b) => s + b.amount, 0)
    + sessionDebtsA.reduce((s, d) => s + d.amount, 0)
    + (parseFloat(spendingA) || 0) + (parseFloat(travelA) || 0);

  const personBIndivTotal = indivBillsB.reduce((s, b) => s + b.amount, 0)
    + sessionDebtsB.reduce((s, d) => s + d.amount, 0)
    + (parseFloat(spendingB) || 0) + (parseFloat(travelB) || 0);

  // Available to save per person
  const availableA = iA - (jointTotal * splitA / 100) - extrasForA - personAIndivTotal;
  const availableB = iB - (jointTotal * splitB / 100) - extrasForB - personBIndivTotal;
  const totalAvailable = isPartner ? availableA + availableB : availableA;

  // % → £ helpers
  function potAmountA(potId: string) {
    return availableA * ((parseFloat(percentsA[potId]) || 0) / 100);
  }
  function potAmountB(potId: string) {
    return availableB * ((parseFloat(percentsB[potId]) || 0) / 100);
  }

  const allocatedPctA = Object.values(percentsA).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const allocatedPctB = Object.values(percentsB).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const remainingPctA = 100 - allocatedPctA;
  const remainingPctB = 100 - allocatedPctB;

  const aReady = Math.abs(remainingPctA) < 0.01;
  const bReady = !isPartner || Math.abs(remainingPctB) < 0.01;
  const canLock = aReady && bReady && availableA >= 0 && (!isPartner || availableB >= 0);

  // Pots visible per person
  const potsForA = pots.filter(p => p.owner === 'joint' || p.owner === 'person_a');
  const potsForB = pots.filter(p => p.owner === 'joint' || p.owner === 'person_b');

  function updateExtra(k: string, f: 'name' | 'amount' | 'who', v: string) {
    setExtras(e => e.map(x => x._key === k ? { ...x, [f]: v } : x));
  }

  function updateBill(key: string, val: string, list: SessionBill[], setList: (l: SessionBill[]) => void) {
    setList(list.map(b => b._key === key ? { ...b, amount: parseFloat(val) || 0 } : b));
  }

  async function saveSession(lock: boolean) {
    setSaving(true);
    const allBills: SessionBill[] = [
      ...jointBills,
      ...extras.filter(e => e.name && e.amount).map(e => ({
        _key: e._key, name: e.name, amount: parseFloat(e.amount),
        category: e.who === 'both' ? 'joint_extra' : e.who === 'a' ? 'joint_extra_a' : 'joint_extra_b',
        billId: undefined,
      })),
      ...indivBillsA, ...indivBillsB,
      ...sessionDebtsA, ...sessionDebtsB,
    ];
    const allocMap: Record<string, number> = {};
    potsForA.forEach(p => { const amt = potAmountA(p.id); if (amt > 0) allocMap[p.id] = (allocMap[p.id] ?? 0) + amt; });
    if (isPartner) {
      potsForB.forEach(p => { const amt = potAmountB(p.id); if (amt > 0) allocMap[p.id] = (allocMap[p.id] ?? 0) + amt; });
    }
    const allAllocs = Object.entries(allocMap).map(([potId, amount]) => ({ potId, amount }));
    const payload = {
      householdId: hh!.id, date: `${LOCKABLE_MONTH}-01`,
      incomeA: iA, incomeB: iB, startingBalance: 0,
      spendingA: parseFloat(spendingA) || 0, spendingB: parseFloat(spendingB) || 0,
      travelA: parseFloat(travelA) || 0, travelB: parseFloat(travelB) || 0,
      bills: allBills, allocations: allAllocs, lock,
    };
    if (sessionId) {
      await fetch('/api/payday/sessions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, ...payload }),
      });
      if (lock) router.push(`/payday/dashboard/${sessionId}`);
      else setSaving(false);
    } else {
      const res = await fetch('/api/payday/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (lock) {
        router.push(`/payday/dashboard/${data.id}`);
      } else {
        setSessionId(data.id);
        setSaving(false);
      }
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  const allOutgoings = (jointTotal * splitA / 100) + extrasForA + personAIndivTotal
    + (isPartner ? (jointTotal * splitB / 100) + extrasForB + personBIndivTotal : 0);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{hh!.name}</div>
            <div className="font-semibold text-sm">{budgetMonthLabel} Payday</div>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={async () => { await saveSession(false); router.push('/payday'); }} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40">Save draft</button>
            <Link href="/payday/setup" className="text-xs text-gray-400 hover:text-gray-600">Setup</Link>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600" title={userEmail}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Progress */}
          <div className="flex gap-1.5">
            {([1,2,3,4,5] as Step[]).map(s => (
              <div key={s} onClick={() => s < step && setStep(s)}
                className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#1a1a1a]' : 'bg-gray-200'} ${s < step ? 'cursor-pointer' : ''}`} />
            ))}
          </div>

          {step >= 2 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
              <div className="text-xs text-emerald-600 font-medium mb-0.5">Total in this month</div>
              <div className="text-2xl font-bold text-emerald-800">{fmt(totalIn)}</div>
            </div>
          )}

          {/* ── Step 1: Income ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">What&apos;s coming in?</h2>
                <p className="text-gray-500 text-sm">Enter your {isPartner ? 'salaries' : 'salary'} for this payday.</p>
              </div>
              <div className="space-y-3">
                <AmountField label={`${hh!.person_a_name}'s salary`} value={incomeA} onChange={setIncomeA} />
                {isPartner && <AmountField label={`${hh!.person_b_name}'s salary`} value={incomeB} onChange={setIncomeB} />}
              </div>
              {totalIn > 0 && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-emerald-700 font-medium">Total in: {fmt(totalIn)}</span>
                </div>
              )}
              <button onClick={() => setStep(2)} disabled={!totalIn}
                className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors">
                Next: Bills →
              </button>
            </div>
          )}

          {/* ── Step 2: Joint bills ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">{isPartner ? 'Joint Bills' : 'Your Bills'}</h2>
                <p className="text-gray-500 text-sm">Check each amount — adjust if anything changed.</p>
              </div>
              <div className="space-y-2">
                {jointBills.map(b => (
                  <div key={b._key} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                    <span className="text-sm flex-1 text-gray-700">{b.name}</span>
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input type="number" min="0"
                        className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={b.amount}
                        onChange={e => updateBill(b._key, e.target.value, jointBills, setJointBills)} />
                    </div>
                  </div>
                ))}
                {jointBills.length === 0 && (
                  <p className="text-sm text-gray-400 py-2">No joint bills saved. <Link href="/payday/setup" className="underline">Add them in setup</Link>.</p>
                )}
              </div>
              {isPartner && jointTotal > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs space-y-1">
                  <div className="flex justify-between text-gray-500 font-medium"><span>Total</span><span>{fmtShort(jointTotal)}</span></div>
                  <div className="flex justify-between text-gray-400">
                    <span>{hh!.person_a_name} ({splitA}%)</span><span>{fmtShort(jointTotal * splitA / 100)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>{hh!.person_b_name} ({splitB}%)</span><span>{fmtShort(jointTotal * splitB / 100)}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={() => setStep(3)} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800">Next →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Joint extras ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Any one-offs this month?</h2>
                <p className="text-gray-500 text-sm">
                  {isPartner
                    ? 'Unplanned shared costs, or something one person paid for. Leave blank if nothing.'
                    : 'Any unplanned expenses this month? Leave blank if nothing.'}
                </p>
              </div>
              <div className="space-y-3">
                {extras.map(e => (
                  <div key={e._key} className="bg-white border border-gray-100 rounded-2xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="Description" value={e.name}
                        onChange={x => updateExtra(e._key, 'name', x.target.value)} />
                      <div className="relative w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                        <input type="number" min="0"
                          className="w-full pl-7 pr-2 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                          placeholder="0" value={e.amount}
                          onChange={x => updateExtra(e._key, 'amount', x.target.value)} />
                      </div>
                      <button onClick={() => setExtras(ex => ex.filter(x => x._key !== e._key))}
                        className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                    </div>
                    {isPartner && (
                      <div className="flex gap-1.5">
                        {([['both', 'Both'], ['a', hh!.person_a_name], ['b', hh!.person_b_name]] as [ExtraWho, string][]).map(([val, label]) => (
                          <button key={val} onClick={() => updateExtra(e._key, 'who', val)}
                            className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${e.who === val ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setExtras(e => [...e, { _key: uid(), name: '', amount: '', who: 'both' }])}
                className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                + Add another
              </button>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800">Next →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Personal outgoings ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Personal outgoings</h2>
                <p className="text-gray-500 text-sm">Individual bills, debts, spending and travel — per person.</p>
              </div>

              <PersonalSection
                name={hh!.person_a_name}
                indivBills={indivBillsA} setIndivBills={setIndivBillsA}
                debts={sessionDebtsA} setDebts={setSessionDebtsA}
                spending={spendingA} setSpending={setSpendingA}
                travel={travelA} setTravel={setTravelA}
              />
              {isPartner && (
                <PersonalSection
                  name={hh!.person_b_name}
                  indivBills={indivBillsB} setIndivBills={setIndivBillsB}
                  debts={sessionDebtsB} setDebts={setSessionDebtsB}
                  spending={spendingB} setSpending={setSpendingB}
                  travel={travelB} setTravel={setTravelB}
                />
              )}

              <div className={`rounded-2xl px-5 py-4 space-y-2 ${totalAvailable < 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Available to save</div>
                {isPartner ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{hh!.person_a_name}</span>
                      <span className={`font-semibold ${availableA < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(availableA)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{hh!.person_b_name}</span>
                      <span className={`font-semibold ${availableB < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(availableB)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                      <span>Combined</span>
                      <span className={totalAvailable < 0 ? 'text-red-600' : 'text-emerald-700'}>{fmt(totalAvailable)}</span>
                    </div>
                  </>
                ) : (
                  <div className={`text-2xl font-bold ${availableA < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(availableA)}</div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={() => setStep(5)} disabled={availableA < 0 || (isPartner && availableB < 0)}
                  className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-gray-800">
                  Allocate savings →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Savings (% allocation per person) ── */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Savings & investments</h2>
                <p className="text-gray-500 text-sm">Allocate {isPartner ? 'each person\'s' : 'your'} remaining balance across pots using percentages.</p>
              </div>

              <PersonSavingsSection
                name={isPartner ? hh!.person_a_name : undefined}
                available={availableA}
                pots={potsForA}
                percents={percentsA}
                setPercents={setPercentsA}
                remainingPct={remainingPctA}
              />

              {isPartner && (
                <PersonSavingsSection
                  name={hh!.person_b_name}
                  available={availableB}
                  pots={potsForB}
                  percents={percentsB}
                  setPercents={setPercentsB}
                  remainingPct={remainingPctB}
                />
              )}

              {!canLock && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
                  {!aReady && <div>{hh!.person_a_name}: {remainingPctA.toFixed(0)}% still to allocate</div>}
                  {isPartner && !bReady && <div>{hh!.person_b_name}: {remainingPctB.toFixed(0)}% still to allocate</div>}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="border border-gray-200 px-4 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={() => saveSession(false)} disabled={saving}
                  className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 disabled:opacity-40">
                  {saving ? 'Saving...' : 'Save for later'}
                </button>
                <button onClick={() => saveSession(true)} disabled={!canLock || saving}
                  className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-emerald-700 transition-colors">
                  {saving ? 'Saving...' : 'Lock in 🔒'}
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

function AmountField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-gray-700">{label}</label>
      {hint && <div className="text-xs text-gray-400 mb-1.5">{hint}</div>}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">£</span>
        <input type="number" min="0"
          className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3.5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          placeholder="0.00" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}

interface SessionBill { billId?: string; name: string; amount: number; category: string; _key: string; }

function PersonalSection({ name, indivBills, setIndivBills, debts, setDebts, spending, setSpending, travel, setTravel }: {
  name: string;
  indivBills: SessionBill[]; setIndivBills: (b: SessionBill[]) => void;
  debts: SessionBill[]; setDebts: (b: SessionBill[]) => void;
  spending: string; setSpending: (v: string) => void;
  travel: string; setTravel: (v: string) => void;
}) {
  const total = indivBills.reduce((s, b) => s + b.amount, 0)
    + debts.reduce((s, b) => s + b.amount, 0)
    + (parseFloat(spending) || 0) + (parseFloat(travel) || 0);

  function Row({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm flex-1 text-gray-600">{label}</span>
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input type="number" min="0"
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={value || ''} onChange={e => onChange(e.target.value)} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="font-semibold text-sm text-gray-700 border-b border-gray-100 pb-2">{name}</div>

      {indivBills.map(b => (
        <Row key={b._key} label={b.name} value={b.amount}
          onChange={v => setIndivBills(indivBills.map(x => x._key === b._key ? { ...x, amount: parseFloat(v) || 0 } : x))} />
      ))}

      {debts.length > 0 && (
        <div className="border-t border-gray-50 pt-2 space-y-2">
          <div className="text-xs text-gray-400 font-medium">Debt repayments</div>
          {debts.map(d => (
            <Row key={d._key} label={d.name} value={d.amount}
              onChange={v => setDebts(debts.map(x => x._key === d._key ? { ...x, amount: parseFloat(v) || 0 } : x))} />
          ))}
        </div>
      )}

      <div className="border-t border-gray-50 pt-2 space-y-2">
        <div className="text-xs text-gray-400 font-medium">Lifestyle</div>
        <div className="flex items-center gap-3">
          <span className="text-sm flex-1 text-gray-600">Spending money</span>
          <div className="relative w-28">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
            <input type="number" min="0"
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="0" value={spending} onChange={e => setSpending(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm flex-1 text-gray-600">Travel</span>
          <div className="relative w-28">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
            <input type="number" min="0"
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="0" value={travel} onChange={e => setTravel(e.target.value)} />
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2">
          <span>{name} total</span>
          <span className="font-medium text-gray-600">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(total)}
          </span>
        </div>
      )}
    </div>
  );
}

interface Pot { id: string; name: string; target_amount: number | null; color: string; owner: string; pot_type: string; }

function PersonSavingsSection({ name, available, pots, percents, setPercents, remainingPct }: {
  name?: string;
  available: number;
  pots: Pot[];
  percents: Record<string, string>;
  setPercents: (p: Record<string, string>) => void;
  remainingPct: number;
}) {
  const fmt2 = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
  const allocatedPct = Object.values(percents).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const barPct = Math.min(100, allocatedPct);
  const done = Math.abs(remainingPct) < 0.01;

  const shortTerm = pots.filter(p => p.pot_type === 'short_term');
  const longTerm = pots.filter(p => p.pot_type !== 'short_term');

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
      {name && <div className="font-semibold text-sm text-gray-700 border-b border-gray-100 pb-2">{name}</div>}

      {/* Available + progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Available</span>
          <span className="text-lg font-bold text-gray-900">{fmt2(available)}</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${barPct}%`, background: done ? '#10b981' : '#1a1a1a' }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{Math.round(allocatedPct)}% allocated</span>
          <span className={remainingPct < 0 ? 'text-red-500 font-medium' : done ? 'text-emerald-600 font-medium' : ''}>
            {done ? '✓ All allocated' : remainingPct < 0 ? `${Math.abs(remainingPct).toFixed(0)}% over` : `${remainingPct.toFixed(0)}% remaining — ${fmt2(available * remainingPct / 100)}`}
          </span>
        </div>
      </div>

      {/* Pot rows — inlined to avoid remount bug with nested components */}
      <div className="space-y-3">
        {shortTerm.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Short-term goals</div>
            {shortTerm.map(p => {
              const pct = parseFloat(percents[p.id]) || 0;
              const amount = available * (pct / 100);
              return (
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-sm flex-1 text-gray-700 min-w-0 truncate">{p.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative w-20">
                      <input type="number" min="0" max="100"
                        className="w-full pr-6 pl-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                        placeholder="0" value={percents[p.id] ?? ''}
                        onChange={e => setPercents({ ...percents, [p.id]: e.target.value })} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right tabular-nums">{amount > 0 ? fmt2(amount) : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {longTerm.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Long-term savings</div>
            {longTerm.map(p => {
              const pct = parseFloat(percents[p.id]) || 0;
              const amount = available * (pct / 100);
              return (
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-sm flex-1 text-gray-700 min-w-0 truncate">{p.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative w-20">
                      <input type="number" min="0" max="100"
                        className="w-full pr-6 pl-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                        placeholder="0" value={percents[p.id] ?? ''}
                        onChange={e => setPercents({ ...percents, [p.id]: e.target.value })} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right tabular-nums">{amount > 0 ? fmt2(amount) : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pots.length === 0 && (
          <p className="text-xs text-gray-400">No savings pots set up. <Link href="/payday/setup" className="underline">Add them in setup</Link>.</p>
        )}
      </div>
    </div>
  );
}

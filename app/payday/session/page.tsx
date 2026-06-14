'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4 | 5;

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
interface ExtraLine { _key: string; name: string; amount: string; }

const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);
const fmtShort = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
function uid() { return Math.random().toString(36).slice(2); }
function today() { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }

export default function SessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [household, setHousehold] = useState<Household | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Step 1 — income
  const [incomeA, setIncomeA] = useState('');
  const [incomeB, setIncomeB] = useState('');
  const [startingBalance, setStartingBalance] = useState('');

  // Step 2 — joint fixed bills
  const [jointBills, setJointBills] = useState<SessionBill[]>([]);

  // Step 3 — joint extras
  const [extras, setExtras] = useState<ExtraLine[]>([{ _key: uid(), name: '', amount: '' }]);

  // Step 4 — individual bills + debts + spending + transport (pre-filled from household defaults)
  const [indivBillsA, setIndivBillsA] = useState<SessionBill[]>([]);
  const [indivBillsB, setIndivBillsB] = useState<SessionBill[]>([]);
  const [sessionDebtsA, setSessionDebtsA] = useState<SessionBill[]>([]);
  const [sessionDebtsB, setSessionDebtsB] = useState<SessionBill[]>([]);
  const [spendingA, setSpendingA] = useState('');
  const [spendingB, setSpendingB] = useState('');
  const [travelA, setTravelA] = useState('');
  const [travelB, setTravelB] = useState('');

  // Step 5 — savings
  const [allocations, setAllocations] = useState<Record<string, string>>({});

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

    const [bRes, pRes, dRes] = await Promise.all([
      fetch(`/api/payday/bills?householdId=${hh.id}`),
      fetch(`/api/payday/pots?householdId=${hh.id}`),
      fetch(`/api/payday/debts?householdId=${hh.id}`),
    ]);
    const bills: Bill[] = await bRes.json();
    const pts: Pot[] = await pRes.json();
    const dts: Debt[] = await dRes.json();

    setPots(pts);
    setDebts(dts);

    setJointBills(bills.filter(b => b.category === 'joint_fixed').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setIndivBillsA(bills.filter(b => b.category === 'individual_a').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setIndivBillsB(bills.filter(b => b.category === 'individual_b').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setSessionDebtsA(dts.filter(d => d.person === 'a').map(d => ({
      billId: d.id, name: d.name, amount: d.amount, category: 'debt_a', _key: d.id,
    })));
    setSessionDebtsB(dts.filter(d => d.person === 'b').map(d => ({
      billId: d.id, name: d.name, amount: d.amount, category: 'debt_b', _key: d.id,
    })));

    // Pre-fill lifestyle from household defaults
    setSpendingA(hh.default_spending_a > 0 ? String(hh.default_spending_a) : '');
    setSpendingB(hh.default_spending_b > 0 ? String(hh.default_spending_b) : '');
    setTravelA(hh.default_transport_a > 0 ? String(hh.default_transport_a) : '');
    setTravelB(hh.default_transport_b > 0 ? String(hh.default_transport_b) : '');

    const allocs: Record<string, string> = {};
    pts.forEach(p => { allocs[p.id] = ''; });
    setAllocations(allocs);

    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const hh = household;
  const isPartner = hh?.mode === 'partner';
  const splitA = hh?.joint_split_a ?? 50;
  const splitB = 100 - splitA;

  // ── Waterfall calculations ──
  const iA = parseFloat(incomeA) || 0;
  const iB = parseFloat(incomeB) || 0;
  const startBal = parseFloat(startingBalance) || 0;
  const totalIn = iA + iB + startBal;

  const jointTotal = jointBills.reduce((s, b) => s + b.amount, 0);
  const extrasTotal = extras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const allJointTotal = jointTotal + extrasTotal;
  const afterJoint = totalIn - allJointTotal;

  // Person A: joint split + individual bills + debts + spending + travel
  const personAJointShare = allJointTotal * (splitA / 100);
  const personAIndivTotal = indivBillsA.reduce((s, b) => s + b.amount, 0)
    + sessionDebtsA.reduce((s, d) => s + d.amount, 0)
    + (parseFloat(spendingA) || 0) + (parseFloat(travelA) || 0);

  // Person B
  const personBJointShare = allJointTotal * (splitB / 100);
  const personBIndivTotal = indivBillsB.reduce((s, b) => s + b.amount, 0)
    + sessionDebtsB.reduce((s, d) => s + d.amount, 0)
    + (parseFloat(spendingB) || 0) + (parseFloat(travelB) || 0);

  const afterIndiv = afterJoint - personAIndivTotal - personBIndivTotal;

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const unallocated = afterIndiv - allocatedTotal;
  const allocPercent = afterIndiv > 0 ? Math.min(100, (allocatedTotal / afterIndiv) * 100) : 0;

  // Group pots by person/type for display
  const potsA = pots.filter(p => p.owner === 'person_a' || p.owner === 'joint');
  const potsB = pots.filter(p => p.owner === 'person_b' || p.owner === 'joint');
  const hasPerPersonPots = pots.some(p => p.owner === 'person_a' || p.owner === 'person_b');

  function updateBill(key: string, val: string, list: SessionBill[], setList: (l: SessionBill[]) => void) {
    setList(list.map(b => b._key === key ? { ...b, amount: parseFloat(val) || 0 } : b));
  }

  function addExtra() { setExtras(e => [...e, { _key: uid(), name: '', amount: '' }]); }
  function removeExtra(k: string) { setExtras(e => e.filter(x => x._key !== k)); }
  function updateExtra(k: string, f: 'name' | 'amount', v: string) { setExtras(e => e.map(x => x._key === k ? { ...x, [f]: v } : x)); }

  async function lockSession() {
    setSaving(true);
    const allBills: SessionBill[] = [
      ...jointBills,
      ...extras.filter(e => e.name && e.amount).map(e => ({ _key: e._key, name: e.name, amount: parseFloat(e.amount), category: 'joint_extra', billId: undefined })),
      ...indivBillsA,
      ...indivBillsB,
      ...sessionDebtsA,
      ...sessionDebtsB,
    ];
    const allAllocs = Object.entries(allocations).filter(([, v]) => parseFloat(v) > 0).map(([potId, v]) => ({ potId, amount: parseFloat(v) }));

    await fetch('/api/payday/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdId: hh!.id, date: new Date().toISOString().slice(0, 10),
        incomeA: iA, incomeB: iB, startingBalance: startBal,
        spendingA: parseFloat(spendingA) || 0, spendingB: parseFloat(spendingB) || 0,
        travelA: parseFloat(travelA) || 0, travelB: parseFloat(travelB) || 0,
        bills: allBills, allocations: allAllocs, lock: true,
      }),
    });
    setLocked(true);
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 text-sm">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{hh!.name}</div>
            <div className="font-semibold text-sm">Payday — {today()}</div>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/payday/history" className="text-xs text-gray-400 hover:text-gray-600">History</Link>
            <Link href="/payday/setup" className="text-xs text-gray-400 hover:text-gray-600">Setup</Link>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600" title={userEmail}>Sign out</button>
          </div>
        </div>
      </header>

      {locked ? (
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-semibold">Payday sorted!</h2>
          <p className="text-gray-500">Session locked. See you next payday.</p>
          <div className="bg-white rounded-2xl p-6 text-left space-y-3 mt-6 border border-gray-100">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total in</span><span className="font-medium">{fmt(totalIn)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">All outgoings</span><span className="font-medium text-red-600">−{fmt(allJointTotal + personAIndivTotal + personBIndivTotal)}</span></div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3"><span>Saved this month</span><span className="text-emerald-600">{fmt(allocatedTotal)}</span></div>
          </div>
          <Link href="/payday/history" className="inline-block mt-4 text-sm text-gray-500 hover:text-gray-700 underline">View history →</Link>
        </div>
      ) : (
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
                <p className="text-gray-500 text-sm">Enter all income hitting your accounts this payday.</p>
              </div>
              <div className="space-y-3">
                <AmountField label={`${hh!.person_a_name}'s salary`} value={incomeA} onChange={setIncomeA} />
                {isPartner && <AmountField label={`${hh!.person_b_name}'s salary`} value={incomeB} onChange={setIncomeB} />}
                <AmountField label="Starting balance" value={startingBalance} onChange={setStartingBalance} hint="What's already sitting in the account?" />
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
                <p className="text-gray-500 text-sm">Check each amount — adjust if anything changed this month.</p>
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
                  <div className="flex justify-between text-gray-500 font-medium">
                    <span>Joint bills total</span><span>{fmtShort(jointTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>{hh!.person_a_name} pays ({splitA}%)</span>
                    <span>{fmtShort(jointTotal * splitA / 100)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>{hh!.person_b_name} pays ({splitB}%)</span>
                    <span>{fmtShort(jointTotal * splitB / 100)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-sm font-medium border-t border-gray-100 pt-3">
                <span className="text-gray-500">Remaining</span>
                <span className={totalIn - jointTotal < 0 ? 'text-red-600' : 'text-gray-900'}>{fmt(totalIn - jointTotal)}</span>
              </div>

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
                <p className="text-gray-500 text-sm">Big shared purchases, renovations, anything unplanned. Leave blank if nothing.</p>
              </div>
              <div className="space-y-2">
                {extras.map(e => (
                  <div key={e._key} className="flex gap-2">
                    <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                      placeholder="Description" value={e.name} onChange={x => updateExtra(e._key, 'name', x.target.value)} />
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input type="number" min="0"
                        className="w-full pl-7 pr-2 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                        placeholder="0" value={e.amount} onChange={x => updateExtra(e._key, 'amount', x.target.value)} />
                    </div>
                    <button onClick={() => removeExtra(e._key)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addExtra} className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                + Add another
              </button>
              {extrasTotal > 0 && (
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-500">Remaining after extras</span>
                  <span>{fmt(afterJoint)}</span>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800">Next →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Personal (individual bills + debts + lifestyle) ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Personal outgoings</h2>
                <p className="text-gray-500 text-sm">Individual bills, debt repayments, spending money and travel — per person.</p>
              </div>

              <PersonalSection
                name={hh!.person_a_name}
                indivBills={indivBillsA}
                setIndivBills={setIndivBillsA}
                debts={sessionDebtsA}
                setDebts={setSessionDebtsA}
                spending={spendingA}
                setSpending={setSpendingA}
                travel={travelA}
                setTravel={setTravelA}
              />

              {isPartner && (
                <PersonalSection
                  name={hh!.person_b_name}
                  indivBills={indivBillsB}
                  setIndivBills={setIndivBillsB}
                  debts={sessionDebtsB}
                  setDebts={setSessionDebtsB}
                  spending={spendingB}
                  setSpending={setSpendingB}
                  travel={travelB}
                  setTravel={setTravelB}
                />
              )}

              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-4">
                <span className="text-gray-500">Available to save</span>
                <span className={afterIndiv < 0 ? 'text-red-600' : 'text-emerald-700'}>{fmt(afterIndiv)}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={() => setStep(5)} disabled={afterIndiv < 0}
                  className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-gray-800">
                  Allocate savings →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Savings allocation ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Savings & investments</h2>
                <p className="text-gray-500 text-sm">Allocate everything down to zero.</p>
              </div>

              {/* Running counter */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Unallocated</span>
                  <span className={`text-2xl font-bold tabular-nums ${Math.abs(unallocated) < 0.01 ? 'text-emerald-600' : unallocated < 0 ? 'text-red-600' : 'text-[#1a1a1a]'}`}>
                    {fmt(Math.max(0, unallocated))}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${allocPercent}%`, background: allocPercent >= 100 ? '#10b981' : '#1a1a1a' }} />
                </div>
                <div className="text-xs text-gray-400 text-right">{Math.round(allocPercent)}% allocated</div>
              </div>

              {/* Pot groups */}
              {!hasPerPersonPots || !isPartner ? (
                <PotGroup label="" pots={pots} allocations={allocations} setAllocations={setAllocations} />
              ) : (
                <>
                  {potsA.length > 0 && (
                    <PotGroup label={hh!.person_a_name} pots={potsA} allocations={allocations} setAllocations={setAllocations} />
                  )}
                  {potsB.length > 0 && (
                    <PotGroup label={hh!.person_b_name} pots={potsB} allocations={allocations} setAllocations={setAllocations} />
                  )}
                </>
              )}

              {unallocated < -0.01 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  You&apos;ve allocated {fmt(Math.abs(unallocated))} more than available.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400">← Back</button>
                <button onClick={lockSession} disabled={Math.abs(unallocated) > 0.01 || saving}
                  className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-emerald-700 transition-colors">
                  {saving ? 'Saving...' : 'Lock in 🔒'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
  const fmtGBP = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  const total = indivBills.reduce((s, b) => s + b.amount, 0)
    + debts.reduce((s, b) => s + b.amount, 0)
    + (parseFloat(spending) || 0) + (parseFloat(travel) || 0);

  function SmallAmountInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
    return (
      <div className="relative w-28">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
        <input type="number" min="0"
          className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
          value={value || ''} onChange={e => onChange(e.target.value)} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="font-medium text-sm text-gray-700 border-b border-gray-100 pb-2">{name}</div>

      {indivBills.map(b => (
        <div key={b._key} className="flex items-center gap-3">
          <span className="text-sm flex-1 text-gray-600">{b.name}</span>
          <SmallAmountInput value={b.amount} onChange={v => setIndivBills(indivBills.map(x => x._key === b._key ? { ...x, amount: parseFloat(v) || 0 } : x))} />
        </div>
      ))}

      {debts.length > 0 && (
        <div className="border-t border-gray-50 pt-2 space-y-2">
          <div className="text-xs text-gray-400 font-medium">Debt repayments</div>
          {debts.map(d => (
            <div key={d._key} className="flex items-center gap-3">
              <span className="text-sm flex-1 text-gray-600">{d.name}</span>
              <SmallAmountInput value={d.amount} onChange={v => setDebts(debts.map(x => x._key === d._key ? { ...x, amount: parseFloat(v) || 0 } : x))} />
            </div>
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
          <span className="font-medium text-gray-600">{fmtGBP(total)}</span>
        </div>
      )}
    </div>
  );
}

interface Pot { id: string; name: string; target_amount: number | null; color: string; owner: string; pot_type: string; }

function PotGroup({ label, pots, allocations, setAllocations }: {
  label: string; pots: Pot[];
  allocations: Record<string, string>;
  setAllocations: (a: Record<string, string>) => void;
}) {
  const shortTerm = pots.filter(p => p.pot_type === 'short_term');
  const longTerm = pots.filter(p => p.pot_type === 'long_term');

  function PotRow({ pot }: { pot: Pot }) {
    return (
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pot.color }} />
        <span className="text-sm flex-1 text-gray-700">{pot.name}</span>
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input type="number" min="0"
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0" value={allocations[pot.id] ?? ''}
            onChange={e => setAllocations({ ...allocations, [pot.id]: e.target.value })} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && <div className="text-sm font-semibold text-gray-600">{label}</div>}
      {shortTerm.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Short-term goals</div>
          {shortTerm.map(p => <PotRow key={p.id} pot={p} />)}
        </div>
      )}
      {longTerm.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Long-term savings</div>
          {longTerm.map(p => <PotRow key={p.id} pot={p} />)}
        </div>
      )}
    </div>
  );
}

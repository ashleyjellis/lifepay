'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type Step = 1 | 2 | 3 | 4 | 5;

interface Household {
  id: string;
  name: string;
  mode: 'solo' | 'partner';
  person_a_name: string;
  person_b_name: string;
}

interface Bill {
  id: string;
  name: string;
  amount: number;
  category: string;
}

interface Pot {
  id: string;
  name: string;
  target_amount: number | null;
  color: string;
}

interface SessionBill {
  billId?: string;
  name: string;
  amount: number;
  category: string;
  _key: string;
}

interface ExtraLine {
  _key: string;
  name: string;
  amount: string;
}

function fmt(v: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function uid() { return Math.random().toString(36).slice(2); }

function today() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SessionPage() {
  const [step, setStep] = useState<Step>(1);
  const [household, setHousehold] = useState<Household | null>(null);
  const [savedBills, setSavedBills] = useState<Bill[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  // Step 1
  const [incomeA, setIncomeA] = useState('');
  const [incomeB, setIncomeB] = useState('');
  const [startingBalance, setStartingBalance] = useState('');

  // Step 2 — joint fixed bills (from saved)
  const [sessionBills, setSessionBills] = useState<SessionBill[]>([]);

  // Step 3 — joint extras
  const [extras, setExtras] = useState<ExtraLine[]>([{ _key: uid(), name: '', amount: '' }]);

  // Step 4 — individual bills + spending/travel
  const [indivBillsA, setIndivBillsA] = useState<SessionBill[]>([]);
  const [indivBillsB, setIndivBillsB] = useState<SessionBill[]>([]);
  const [spendingA, setSpendingA] = useState('');
  const [spendingB, setSpendingB] = useState('');
  const [travelA, setTravelA] = useState('');
  const [travelB, setTravelB] = useState('');

  // Step 5 — savings allocations
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const hRes = await fetch('/api/payday/households');
    if (!hRes.ok) return;
    const hh: Household = await hRes.json();
    if (!hh) { window.location.href = '/payday/setup'; return; }
    setHousehold(hh);

    const [bRes, pRes] = await Promise.all([
      fetch(`/api/payday/bills?householdId=${hh.id}`),
      fetch(`/api/payday/pots?householdId=${hh.id}`),
    ]);
    const bills: Bill[] = await bRes.json();
    const pts: Pot[] = await pRes.json();
    setSavedBills(bills);
    setPots(pts);

    // Pre-populate session bills from saved bills
    setSessionBills(bills.filter(b => b.category === 'joint_fixed').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setIndivBillsA(bills.filter(b => b.category === 'individual_a').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));
    setIndivBillsB(bills.filter(b => b.category === 'individual_b').map(b => ({
      billId: b.id, name: b.name, amount: b.amount, category: b.category, _key: b.id,
    })));

    const allocs: Record<string, string> = {};
    pts.forEach(p => { allocs[p.id] = ''; });
    setAllocations(allocs);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalIn = (parseFloat(incomeA) || 0) + (parseFloat(incomeB) || 0) + (parseFloat(startingBalance) || 0);

  const jointFixedTotal = sessionBills.reduce((s, b) => s + b.amount, 0);
  const afterJointFixed = totalIn - jointFixedTotal;

  const extrasTotal = extras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const afterExtras = afterJointFixed - extrasTotal;

  const indivATotal = indivBillsA.reduce((s, b) => s + b.amount, 0) + (parseFloat(spendingA) || 0) + (parseFloat(travelA) || 0);
  const indivBTotal = indivBillsB.reduce((s, b) => s + b.amount, 0) + (parseFloat(spendingB) || 0) + (parseFloat(travelB) || 0);
  const afterIndiv = afterExtras - indivATotal - indivBTotal;

  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const unallocated = afterIndiv - allocatedTotal;
  const allocPercent = afterIndiv > 0 ? Math.min(100, (allocatedTotal / afterIndiv) * 100) : 0;

  function updateSessionBill(key: string, field: 'name' | 'amount', val: string, list: SessionBill[], setList: (l: SessionBill[]) => void) {
    setList(list.map(b => b._key === key ? { ...b, [field]: field === 'amount' ? (parseFloat(val) || 0) : val } : b));
  }

  function addExtra() { setExtras(e => [...e, { _key: uid(), name: '', amount: '' }]); }
  function removeExtra(k: string) { setExtras(e => e.filter(x => x._key !== k)); }
  function updateExtra(k: string, f: 'name' | 'amount', v: string) { setExtras(e => e.map(x => x._key === k ? { ...x, [f]: v } : x)); }

  async function lockSession() {
    setSaving(true);
    const allBills: SessionBill[] = [
      ...sessionBills,
      ...extras.filter(e => e.name && e.amount).map(e => ({ _key: e._key, name: e.name, amount: parseFloat(e.amount), category: 'joint_extra', billId: undefined })),
      ...indivBillsA,
      ...indivBillsB,
    ];

    const allAllocs = Object.entries(allocations).filter(([, v]) => parseFloat(v) > 0).map(([potId, v]) => ({ potId, amount: parseFloat(v) }));

    await fetch('/api/payday/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdId: household!.id,
        date: new Date().toISOString().slice(0, 10),
        incomeA: parseFloat(incomeA) || 0,
        incomeB: parseFloat(incomeB) || 0,
        startingBalance: parseFloat(startingBalance) || 0,
        spendingA: parseFloat(spendingA) || 0,
        spendingB: parseFloat(spendingB) || 0,
        travelA: parseFloat(travelA) || 0,
        travelB: parseFloat(travelB) || 0,
        bills: allBills,
        allocations: allAllocs,
        lock: true,
      }),
    });
    setLocked(true);
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 text-sm">Loading...</div></div>;
  }

  const hh = household!;
  const isPartner = hh.mode === 'partner';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{hh.name}</div>
            <div className="font-semibold text-sm">Payday — {today()}</div>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/payday/history" className="text-xs text-gray-400 hover:text-gray-600">History</Link>
            <Link href="/payday/setup" className="text-xs text-gray-400 hover:text-gray-600">Setup</Link>
          </div>
        </div>
      </header>

      {locked ? (
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-semibold">Payday sorted!</h2>
          <p className="text-gray-500">Session saved. See you next payday.</p>
          <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-3 mt-6">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total in</span><span className="font-medium">{fmt(totalIn)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Bills</span><span className="font-medium text-red-600">−{fmt(jointFixedTotal + extrasTotal + indivATotal + indivBTotal)}</span></div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-3"><span>Saved this month</span><span className="text-emerald-600">{fmt(allocatedTotal)}</span></div>
          </div>
          <Link href="/payday/history" className="inline-block mt-4 text-sm text-gray-500 hover:text-gray-700 underline">View all sessions →</Link>
        </div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Step indicators */}
          <div className="flex gap-1.5">
            {([1,2,3,4,5] as Step[]).map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors cursor-pointer ${s <= step ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`} onClick={() => s < step && setStep(s)} />
            ))}
          </div>

          {/* Persistent "Total in" banner from step 2 onwards */}
          {step >= 2 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
              <div className="text-xs text-emerald-600 font-medium mb-0.5">Total in this month</div>
              <div className="text-2xl font-bold text-emerald-800">{fmt(totalIn)}</div>
            </div>
          )}

          {/* ── STEP 1: Income ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">What&apos;s coming in?</h2>
                <p className="text-gray-500 text-sm">Enter everything hitting your accounts this payday.</p>
              </div>

              <div className="space-y-3">
                <AmountField label={`${hh.person_a_name}'s salary`} value={incomeA} onChange={setIncomeA} />
                {isPartner && <AmountField label={`${hh.person_b_name}'s salary`} value={incomeB} onChange={setIncomeB} />}
                <AmountField label="Starting balance" value={startingBalance} onChange={setStartingBalance} hint="What's already in the pot?" />
              </div>

              {totalIn > 0 && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-emerald-700 font-medium">Total in: {fmt(totalIn)}</span>
                </div>
              )}

              <button onClick={() => setStep(2)} disabled={!totalIn} className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors">
                Next: Bills →
              </button>
            </div>
          )}

          {/* ── STEP 2: Joint fixed bills ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Joint bills</h2>
                <p className="text-gray-500 text-sm">Check the amounts — adjust if anything changed.</p>
              </div>

              <div className="space-y-2">
                {sessionBills.map(b => (
                  <div key={b._key} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                    <span className="text-sm flex-1 text-gray-700">{b.name}</span>
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input
                        type="number" min="0"
                        className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={b.amount}
                        onChange={e => updateSessionBill(b._key, 'amount', e.target.value, sessionBills, setSessionBills)}
                      />
                    </div>
                  </div>
                ))}
                {sessionBills.length === 0 && (
                  <div className="text-sm text-gray-400 py-2">No joint bills saved. Add them in <Link href="/payday/setup" className="underline">setup</Link>.</div>
                )}
              </div>

              <div className="flex justify-between items-center text-sm font-medium border-t border-gray-100 pt-3">
                <span className="text-gray-500">Remaining after bills</span>
                <span className={afterJointFixed < 0 ? 'text-red-600' : 'text-gray-900'}>{fmt(afterJointFixed)}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
                <button onClick={() => setStep(3)} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">Next →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Joint extras ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Any one-offs this month?</h2>
                <p className="text-gray-500 text-sm">Big purchases, renovations, anything shared and unplanned. Leave blank if not.</p>
              </div>

              <div className="space-y-2">
                {extras.map(e => (
                  <div key={e._key} className="flex gap-2">
                    <input
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Description"
                      value={e.name}
                      onChange={x => updateExtra(e._key, 'name', x.target.value)}
                    />
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input
                        type="number" min="0"
                        className="w-full pl-7 pr-2 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="0"
                        value={e.amount}
                        onChange={x => updateExtra(e._key, 'amount', x.target.value)}
                      />
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
                  <span>{fmt(afterExtras)}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">Next →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Individual bills + spending ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Personal spending</h2>
                <p className="text-gray-500 text-sm">Individual bills, pocket money, and travel.</p>
              </div>

              {/* Person A */}
              <PersonSection
                name={hh.person_a_name}
                bills={indivBillsA}
                setBills={setIndivBillsA}
                spending={spendingA}
                setSpending={setSpendingA}
                travel={travelA}
                setTravel={setTravelA}
              />

              {/* Person B */}
              {isPartner && (
                <PersonSection
                  name={hh.person_b_name}
                  bills={indivBillsB}
                  setBills={setIndivBillsB}
                  spending={spendingB}
                  setSpending={setSpendingB}
                  travel={travelB}
                  setTravel={setTravelB}
                />
              )}

              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-4">
                <span className="text-gray-500">Available to save</span>
                <span className={afterIndiv < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>{fmt(afterIndiv)}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
                <button onClick={() => setStep(5)} disabled={afterIndiv < 0} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors">
                  Allocate savings →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Savings allocation ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Savings pots</h2>
                <p className="text-gray-500 text-sm">Allocate everything to zero.</p>
              </div>

              {/* Progress bar */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Unallocated</span>
                  <span className={`text-2xl font-bold tabular-nums ${Math.abs(unallocated) < 0.01 ? 'text-emerald-600' : unallocated < 0 ? 'text-red-600' : 'text-[#1a1a1a]'}`}>
                    {fmt(Math.max(0, unallocated))}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${allocPercent}%`, background: allocPercent >= 100 ? '#10b981' : '#1a1a1a' }}
                  />
                </div>
                <div className="text-xs text-gray-400 text-right">{Math.round(allocPercent)}% allocated</div>
              </div>

              {/* Pot inputs */}
              <div className="space-y-2">
                {pots.map(pot => (
                  <div key={pot.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pot.color }} />
                    <span className="text-sm flex-1 text-gray-700">{pot.name}</span>
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input
                        type="number" min="0"
                        className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="0"
                        value={allocations[pot.id] ?? ''}
                        onChange={e => setAllocations(a => ({ ...a, [pot.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {unallocated < -0.01 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  You&apos;ve allocated {fmt(Math.abs(unallocated))} more than available.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
                <button
                  onClick={lockSession}
                  disabled={Math.abs(unallocated) > 0.01 || saving}
                  className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-medium disabled:opacity-40 hover:bg-emerald-700 transition-colors"
                >
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
        <input
          type="number" min="0"
          className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3.5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="0.00"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

interface SessionBill { billId?: string; name: string; amount: number; category: string; _key: string; }

function PersonSection({ name, bills, setBills, spending, setSpending, travel, setTravel }: {
  name: string;
  bills: SessionBill[];
  setBills: (b: SessionBill[]) => void;
  spending: string;
  setSpending: (v: string) => void;
  travel: string;
  setTravel: (v: string) => void;
}) {
  const total = bills.reduce((s, b) => s + b.amount, 0) + (parseFloat(spending) || 0) + (parseFloat(travel) || 0);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="font-medium text-sm text-gray-700 border-b border-gray-100 pb-2">{name}</div>

      {bills.map(b => (
        <div key={b._key} className="flex items-center gap-3">
          <span className="text-sm flex-1 text-gray-600">{b.name}</span>
          <div className="relative w-28">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
            <input
              type="number" min="0"
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              value={b.amount}
              onChange={e => setBills(bills.map(x => x._key === b._key ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <span className="text-sm flex-1 text-gray-600">Spending money</span>
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input
            type="number" min="0"
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0"
            value={spending}
            onChange={e => setSpending(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm flex-1 text-gray-600">Travel</span>
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input
            type="number" min="0"
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0"
            value={travel}
            onChange={e => setTravel(e.target.value)}
          />
        </div>
      </div>

      {total > 0 && (
        <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2">
          <span>{name} subtotal</span><span className="font-medium text-gray-600">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(total)}</span>
        </div>
      )}
    </div>
  );
}

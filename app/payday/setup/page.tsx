'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'household' | 'joint_bills' | 'personal_bills' | 'debts' | 'lifestyle' | 'short_term' | 'long_term';
type Mode = 'solo' | 'partner';

interface BillDraft { id: string; name: string; amount: string; }
interface DebtDraft { id: string; name: string; amount: string; person: 'a' | 'b'; }
interface PotDraft {
  id: string; name: string; targetAmount: string; targetMonths: string;
  color: string; owner: 'person_a' | 'person_b'; potType: 'short_term' | 'long_term';
}

const POT_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#f97316','#14b8a6','#64748b'];

const DEFAULT_JOINT_BILLS: BillDraft[] = [
  { id: 'b1', name: 'Mortgage / Rent', amount: '' },
  { id: 'b2', name: 'Energy', amount: '' },
  { id: 'b3', name: 'Broadband', amount: '' },
  { id: 'b4', name: 'Water', amount: '' },
  { id: 'b5', name: 'Council Tax', amount: '' },
  { id: 'b6', name: 'Insurance', amount: '' },
  { id: 'b7', name: 'Food & Groceries', amount: '' },
];

const DEFAULT_SHORT_TERM: Omit<PotDraft, 'owner'>[] = [
  { id: 'st1', name: 'Celebrations', targetAmount: '', targetMonths: '12', color: '#ec4899', potType: 'short_term' },
  { id: 'st2', name: 'Holiday', targetAmount: '', targetMonths: '12', color: '#f59e0b', potType: 'short_term' },
  { id: 'st3', name: 'Short-term savings', targetAmount: '', targetMonths: '12', color: '#10b981', potType: 'short_term' },
];
// Savings pots are always per-person — no joint savings

const DEFAULT_LONG_TERM: Omit<PotDraft, 'owner'>[] = [
  { id: 'lt1', name: 'ISA', targetAmount: '', targetMonths: '', color: '#6366f1', potType: 'long_term' },
  { id: 'lt2', name: 'Trading 212', targetAmount: '', targetMonths: '', color: '#3b82f6', potType: 'long_term' },
];

function uid() { return Math.random().toString(36).slice(2); }

const STEPS: Step[] = ['household','joint_bills','personal_bills','debts','lifestyle','short_term','long_term'];
const STEP_LABELS: Record<Step, string> = {
  household: 'Household',
  joint_bills: 'Joint Bills',
  personal_bills: 'Personal Bills',
  debts: 'Debt',
  lifestyle: 'Lifestyle',
  short_term: 'Short-term Savings',
  long_term: 'Long-term Savings',
};

function AmountInput({ value, onChange, placeholder = '0' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-28">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
      <input
        type="number" min="0"
        className="w-full pl-7 pr-2 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('household');
  const [saving, setSaving] = useState(false);

  // Household
  const [hhName, setHhName] = useState('');
  const [mode, setMode] = useState<Mode>('partner');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [splitA, setSplitA] = useState('50');

  // Joint bills
  const [jointBills, setJointBills] = useState<BillDraft[]>(DEFAULT_JOINT_BILLS);

  // Personal bills (per person)
  const [billsA, setBillsA] = useState<BillDraft[]>([]);
  const [billsB, setBillsB] = useState<BillDraft[]>([]);

  // Debt repayments
  const [debtsA, setDebtsA] = useState<DebtDraft[]>([]);
  const [debtsB, setDebtsB] = useState<DebtDraft[]>([]);

  // Lifestyle
  const [spendingA, setSpendingA] = useState('');
  const [spendingB, setSpendingB] = useState('');
  const [transportA, setTransportA] = useState('');
  const [transportB, setTransportB] = useState('');

  // Short-term savings
  const [shortTermPots, setShortTermPots] = useState<PotDraft[]>(
    DEFAULT_SHORT_TERM.map(p => ({ ...p, owner: 'person_a' as const }))
  );

  // Long-term savings
  const [longTermPots, setLongTermPots] = useState<PotDraft[]>(
    DEFAULT_LONG_TERM.map(p => ({ ...p, owner: 'person_a' as const }))
  );

  const splitB = 100 - (parseInt(splitA) || 50);
  const isPartner = mode === 'partner';
  const stepIndex = STEPS.indexOf(step);

  function prev() { if (stepIndex > 0) setStep(STEPS[stepIndex - 1]); }
  function next() { if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]); }

  // Generic bill list helpers
  function addBill(list: BillDraft[], set: (l: BillDraft[]) => void) {
    set([...list, { id: uid(), name: '', amount: '' }]);
  }
  function updateBill(list: BillDraft[], set: (l: BillDraft[]) => void, id: string, field: 'name' | 'amount', val: string) {
    set(list.map(b => b.id === id ? { ...b, [field]: val } : b));
  }
  function removeBill(list: BillDraft[], set: (l: BillDraft[]) => void, id: string) {
    set(list.filter(b => b.id !== id));
  }

  function addDebt(person: 'a' | 'b') {
    const draft: DebtDraft = { id: uid(), name: '', amount: '', person };
    if (person === 'a') setDebtsA(d => [...d, draft]);
    else setDebtsB(d => [...d, draft]);
  }
  function updateDebt(person: 'a' | 'b', id: string, field: 'name' | 'amount', val: string) {
    const upd = (list: DebtDraft[]) => list.map(d => d.id === id ? { ...d, [field]: val } : d);
    if (person === 'a') setDebtsA(upd); else setDebtsB(upd);
  }
  function removeDebt(person: 'a' | 'b', id: string) {
    if (person === 'a') setDebtsA(d => d.filter(x => x.id !== id));
    else setDebtsB(d => d.filter(x => x.id !== id));
  }

  function addShortTerm() {
    setShortTermPots(p => [...p, { id: uid(), name: '', targetAmount: '', targetMonths: '12', color: POT_COLORS[p.length % POT_COLORS.length], owner: 'person_a', potType: 'short_term' }]);
  }
  function addLongTerm() {
    setLongTermPots(p => [...p, { id: uid(), name: '', targetAmount: '', targetMonths: '', color: POT_COLORS[p.length % POT_COLORS.length], owner: 'person_a', potType: 'long_term' }]);
  }
  function updatePot(list: PotDraft[], set: (l: PotDraft[]) => void, id: string, field: keyof PotDraft, val: string) {
    set(list.map(p => p.id === id ? { ...p, [field]: val } : p));
  }

  async function finish() {
    setSaving(true);
    try {
      const hhRes = await fetch('/api/payday/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: hhName || 'Our Household',
          mode,
          personAName: nameA || 'Person A',
          personBName: nameB || 'Person B',
          jointSplitA: parseInt(splitA) || 50,
          defaultSpendingA: parseFloat(spendingA) || 0,
          defaultSpendingB: parseFloat(spendingB) || 0,
          defaultTransportA: parseFloat(transportA) || 0,
          defaultTransportB: parseFloat(transportB) || 0,
        }),
      });
      const hh = await hhRes.json();
      const hhId = hh.id;

      // Joint bills
      const allJointBills = jointBills.filter(b => b.name && b.amount);
      await Promise.all(allJointBills.map(b =>
        fetch('/api/payday/bills', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: hhId, name: b.name, amount: parseFloat(b.amount), category: 'joint_fixed' }),
        })
      ));

      // Personal bills A
      await Promise.all(billsA.filter(b => b.name && b.amount).map(b =>
        fetch('/api/payday/bills', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: hhId, name: b.name, amount: parseFloat(b.amount), category: 'individual_a' }),
        })
      ));

      // Personal bills B
      if (isPartner) {
        await Promise.all(billsB.filter(b => b.name && b.amount).map(b =>
          fetch('/api/payday/bills', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ householdId: hhId, name: b.name, amount: parseFloat(b.amount), category: 'individual_b' }),
          })
        ));
      }

      // Debts A
      await Promise.all(debtsA.filter(d => d.name && d.amount).map(d =>
        fetch('/api/payday/debts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: hhId, person: 'a', name: d.name, amount: parseFloat(d.amount) }),
        })
      ));

      // Debts B
      if (isPartner) {
        await Promise.all(debtsB.filter(d => d.name && d.amount).map(d =>
          fetch('/api/payday/debts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ householdId: hhId, person: 'b', name: d.name, amount: parseFloat(d.amount) }),
          })
        ));
      }

      // Savings pots
      const allPots = [...shortTermPots, ...longTermPots].filter(p => p.name);
      await Promise.all(allPots.map((p, i) =>
        fetch('/api/payday/pots', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId: hhId, name: p.name,
            targetAmount: p.targetAmount ? parseFloat(p.targetAmount) : null,
            targetMonths: p.targetMonths ? parseInt(p.targetMonths) : null,
            color: p.color, owner: p.owner, potType: p.potType, sortOrder: i,
          }),
        })
      ));

      router.push('/payday/session');
    } catch (e) {
      console.error(e);
      alert('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  const totalJointBills = jointBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-[#faf9f7]">
      <div className="w-full max-w-lg">
        <Link href="/payday" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">← Payday</Link>

        {/* Step label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{STEP_LABELS[step]}</span>
          <span className="text-xs text-gray-400">{stepIndex + 1} / {STEPS.length}</span>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* ── STEP: Household ── */}
        {step === 'household' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Set up your household</h1>
              <p className="text-gray-500 text-sm">Takes a couple of minutes. You only do this once.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Household name</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  placeholder="e.g. The Smiths" value={hhName} onChange={e => setHhName(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Household type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['solo','partner'] as Mode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${mode === m ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}>
                      {m === 'solo' ? '🧍 Solo' : '👫 Partners'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{mode === 'solo' ? 'Your name' : 'Partner A name'}</label>
                  <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    placeholder={mode === 'solo' ? 'Your name' : 'e.g. Ashley'} value={nameA} onChange={e => setNameA(e.target.value)} />
                </div>
                {isPartner && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Partner B name</label>
                    <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                      placeholder="e.g. Sam" value={nameB} onChange={e => setNameB(e.target.value)} />
                  </div>
                )}
              </div>

              {isPartner && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-0.5">Joint bill split</label>
                    <p className="text-xs text-gray-400 mb-3">How are shared bills divided between you?</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">{nameA || 'Person A'}</div>
                        <input type="range" min="0" max="100" value={splitA}
                          onChange={e => setSplitA(e.target.value)}
                          className="w-full accent-gray-900" />
                      </div>
                      <div className="text-center shrink-0 w-16">
                        <div className="text-lg font-bold">{splitA}%</div>
                        <div className="text-xs text-gray-400">{splitB}%</div>
                        <div className="text-xs text-gray-400">{nameB || 'B'}</div>
                      </div>
                    </div>
                    {splitA === '50' && (
                      <p className="text-xs text-gray-400 mt-2">Split evenly 50/50</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={next} className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Next: Joint Bills →
            </button>
          </div>
        )}

        {/* ── STEP: Joint Bills ── */}
        {step === 'joint_bills' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">{isPartner ? 'Your Joint Bills' : 'Your Household Bills'}</h1>
              <p className="text-gray-500 text-sm">
                {isPartner
                  ? 'Costs you share as a household — mortgage, utilities, food. These load automatically each payday and are split by your agreed ratio.'
                  : 'Your regular household costs — mortgage, utilities, food. These load automatically each payday for you to confirm.'}
              </p>
            </div>

            <div className="space-y-2">
              {jointBills.map(b => (
                <div key={b.id} className="flex gap-2 items-center">
                  <input
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    placeholder="Bill name" value={b.name} onChange={e => updateBill(jointBills, setJointBills, b.id, 'name', e.target.value)}
                  />
                  <AmountInput value={b.amount} onChange={v => updateBill(jointBills, setJointBills, b.id, 'amount', v)} />
                  <button onClick={() => removeBill(jointBills, setJointBills, b.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                </div>
              ))}
            </div>

            <button onClick={() => addBill(jointBills, setJointBills)}
              className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Add bill
            </button>

            {totalJointBills > 0 && isPartner && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Total joint bills</span>
                  <span className="font-medium text-gray-900">£{totalJointBills.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-xs">
                  <span>{nameA || 'Person A'} pays ({splitA}%)</span>
                  <span>£{(totalJointBills * parseInt(splitA) / 100).toFixed(0)}</span>
                </div>
                {isPartner && (
                  <div className="flex justify-between text-gray-400 text-xs">
                    <span>{nameB || 'Person B'} pays ({splitB}%)</span>
                    <span>£{(totalJointBills * splitB / 100).toFixed(0)}</span>
                  </div>
                )}
              </div>
            )}

            <NavButtons onBack={prev} onNext={next} />
          </div>
        )}

        {/* ── STEP: Personal Bills ── */}
        {step === 'personal_bills' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Personal Bills</h1>
              <p className="text-gray-500 text-sm">
                {isPartner
                  ? "Each person's own recurring costs — phone contracts, gym memberships, subscriptions. These come out of each person's own share."
                  : "Your own recurring personal costs — phone, gym, subscriptions."}
              </p>
            </div>

            <PersonBillSection
              name={nameA || 'Person A'}
              bills={billsA}
              onAdd={() => addBill(billsA, setBillsA)}
              onUpdate={(id, f, v) => updateBill(billsA, setBillsA, id, f, v)}
              onRemove={id => removeBill(billsA, setBillsA, id)}
            />

            {isPartner && (
              <PersonBillSection
                name={nameB || 'Person B'}
                bills={billsB}
                onAdd={() => addBill(billsB, setBillsB)}
                onUpdate={(id, f, v) => updateBill(billsB, setBillsB, id, f, v)}
                onRemove={id => removeBill(billsB, setBillsB, id)}
              />
            )}

            <NavButtons onBack={prev} onNext={next} />
          </div>
        )}

        {/* ── STEP: Debts ── */}
        {step === 'debts' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Debt Repayments</h1>
              <p className="text-gray-500 text-sm">
                Credit cards, loans, or any regular debt payments. These come out of each person's own money each month. Leave blank if none.
              </p>
            </div>

            <DebtSection
              name={nameA || 'Person A'}
              debts={debtsA}
              onAdd={() => addDebt('a')}
              onUpdate={(id, f, v) => updateDebt('a', id, f, v)}
              onRemove={id => removeDebt('a', id)}
            />

            {isPartner && (
              <DebtSection
                name={nameB || 'Person B'}
                debts={debtsB}
                onAdd={() => addDebt('b')}
                onUpdate={(id, f, v) => updateDebt('b', id, f, v)}
                onRemove={id => removeDebt('b', id)}
              />
            )}

            <NavButtons onBack={prev} onNext={next} nextLabel="Next: Lifestyle →" />
          </div>
        )}

        {/* ── STEP: Lifestyle ── */}
        {step === 'lifestyle' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Lifestyle</h1>
              <p className="text-gray-500 text-sm">
                Monthly spending money and travel costs, per person. These are the amounts each person sets aside for themselves every payday.
              </p>
            </div>

            <div className="space-y-4">
              <LifestylePersonBlock
                name={nameA || 'Person A'}
                spending={spendingA} onSpending={setSpendingA}
                transport={transportA} onTransport={setTransportA}
              />
              {isPartner && (
                <LifestylePersonBlock
                  name={nameB || 'Person B'}
                  spending={spendingB} onSpending={setSpendingB}
                  transport={transportB} onTransport={setTransportB}
                />
              )}
            </div>

            <NavButtons onBack={prev} onNext={next} nextLabel="Next: Short-term Savings →" />
          </div>
        )}

        {/* ── STEP: Short-term Savings ── */}
        {step === 'short_term' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Short-term Savings Goals</h1>
              <p className="text-gray-500 text-sm">
                Life events and near-future expenses — holidays, celebrations, big purchases. Set a target and a timeframe, and we&apos;ll show you the suggested monthly contribution.
              </p>
            </div>

            <div className="space-y-3">
              {shortTermPots.map(pot => (
                <ShortTermPotRow
                  key={pot.id}
                  pot={pot}
                  isPartner={isPartner}
                  nameA={nameA || 'Person A'}
                  nameB={nameB || 'Person B'}
                  onUpdate={(field, val) => updatePot(shortTermPots, setShortTermPots, pot.id, field, val)}
                  onRemove={() => setShortTermPots(p => p.filter(x => x.id !== pot.id))}
                />
              ))}
            </div>

            <button onClick={addShortTerm}
              className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Add savings goal
            </button>

            <NavButtons onBack={prev} onNext={next} nextLabel="Next: Long-term Savings →" />
          </div>
        )}

        {/* ── STEP: Long-term Savings ── */}
        {step === 'long_term' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Long-term Savings & Investments</h1>
              <p className="text-gray-500 text-sm">
                Accounts and platforms you contribute to each month — ISAs, investment apps, pensions. Add each one you want to allocate to on payday.
              </p>
            </div>

            <div className="space-y-3">
              {longTermPots.map(pot => (
                <LongTermPotRow
                  key={pot.id}
                  pot={pot}
                  isPartner={isPartner}
                  nameA={nameA || 'Person A'}
                  nameB={nameB || 'Person B'}
                  onUpdate={(field, val) => updatePot(longTermPots, setLongTermPots, pot.id, field, val)}
                  onRemove={() => setLongTermPots(p => p.filter(x => x.id !== pot.id))}
                />
              ))}
            </div>

            <button onClick={addLongTerm}
              className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Add account / platform
            </button>

            <button
              onClick={finish}
              disabled={saving}
              className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {saving ? 'Setting up...' : "Let's go 🎉"}
            </button>
            <button onClick={prev} className="w-full border border-gray-200 py-3 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = 'Next →' }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onBack} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
      <button onClick={onNext} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">{nextLabel}</button>
    </div>
  );
}

function PersonBillSection({ name, bills, onAdd, onUpdate, onRemove }: {
  name: string;
  bills: BillDraft[];
  onAdd: () => void;
  onUpdate: (id: string, f: 'name' | 'amount', v: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">{name}</div>
      {bills.length === 0 && <p className="text-xs text-gray-400">No personal bills added yet.</p>}
      {bills.map(b => (
        <div key={b.id} className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. Phone, Gym, Netflix" value={b.name}
            onChange={e => onUpdate(b.id, 'name', e.target.value)}
          />
          <AmountInput value={b.amount} onChange={v => onUpdate(b.id, 'amount', v)} />
          <button onClick={() => onRemove(b.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
        </div>
      ))}
      <button onClick={onAdd} className="text-xs text-gray-400 hover:text-gray-700 font-medium">+ Add bill</button>
    </div>
  );
}

function DebtSection({ name, debts, onAdd, onUpdate, onRemove }: {
  name: string;
  debts: DebtDraft[];
  onAdd: () => void;
  onUpdate: (id: string, f: 'name' | 'amount', v: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">{name}</div>
      {debts.length === 0 && <p className="text-xs text-gray-400">No debt repayments — leave blank if none.</p>}
      {debts.map(d => (
        <div key={d.id} className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. Barclaycard, Car loan" value={d.name}
            onChange={e => onUpdate(d.id, 'name', e.target.value)}
          />
          <AmountInput value={d.amount} onChange={v => onUpdate(d.id, 'amount', v)} />
          <button onClick={() => onRemove(d.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
        </div>
      ))}
      <button onClick={onAdd} className="text-xs text-gray-400 hover:text-gray-700 font-medium">+ Add repayment</button>
    </div>
  );
}

function LifestylePersonBlock({ name, spending, onSpending, transport, onTransport }: {
  name: string; spending: string; onSpending: (v: string) => void;
  transport: string; onTransport: (v: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">{name}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm text-gray-600 mb-1">Spending money</div>
          <div className="text-xs text-gray-400">Monthly pocket money for personal spending</div>
        </div>
        <AmountInput value={spending} onChange={onSpending} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm text-gray-600 mb-1">Travel / Transport</div>
          <div className="text-xs text-gray-400">Commuting and regular transport costs</div>
        </div>
        <AmountInput value={transport} onChange={onTransport} />
      </div>
    </div>
  );
}

function ShortTermPotRow({ pot, isPartner, nameA, nameB, onUpdate, onRemove }: {
  pot: PotDraft; isPartner: boolean; nameA: string; nameB: string;
  onUpdate: (f: keyof PotDraft, v: string) => void;
  onRemove: () => void;
}) {
  const monthly = pot.targetAmount && pot.targetMonths
    ? (parseFloat(pot.targetAmount) / parseInt(pot.targetMonths)).toFixed(0)
    : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pot.color }} />
        <input
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="e.g. Holiday Fund"
          value={pot.name}
          onChange={e => onUpdate('name', e.target.value)}
        />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">×</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Target amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
            <input type="number" min="0"
              className="w-full pl-7 pr-2 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="e.g. 2000"
              value={pot.targetAmount}
              onChange={e => onUpdate('targetAmount', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Over how many months?</label>
          <input type="number" min="1" max="60"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. 12"
            value={pot.targetMonths}
            onChange={e => onUpdate('targetMonths', e.target.value)}
          />
        </div>
      </div>

      {monthly && (
        <div className="text-xs text-emerald-600 font-medium">
          → Save £{monthly}/month to reach your goal
        </div>
      )}

      {isPartner && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Who is this for?</label>
          <div className="flex gap-2">
            {([['person_a', nameA],['person_b', nameB]] as [string, string][]).map(([val, label]) => (
              <button key={val} onClick={() => onUpdate('owner', val)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pot.owner === val ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LongTermPotRow({ pot, isPartner, nameA, nameB, onUpdate, onRemove }: {
  pot: PotDraft; isPartner: boolean; nameA: string; nameB: string;
  onUpdate: (f: keyof PotDraft, v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pot.color }} />
        <input
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="e.g. ISA, Trading 212, Pension"
          value={pot.name}
          onChange={e => onUpdate('name', e.target.value)}
        />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">×</button>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Monthly target (optional)</label>
        <div className="relative w-36">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input type="number" min="0"
            className="w-full pl-7 pr-2 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0"
            value={pot.targetAmount}
            onChange={e => onUpdate('targetAmount', e.target.value)}
          />
        </div>
      </div>

      {isPartner && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Who is this for?</label>
          <div className="flex gap-2">
            {([['person_a', nameA],['person_b', nameB]] as [string, string][]).map(([val, label]) => (
              <button key={val} onClick={() => onUpdate('owner', val)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pot.owner === val ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

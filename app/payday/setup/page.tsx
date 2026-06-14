'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'household' | 'bills' | 'pots';
type Mode = 'solo' | 'partner';
type BillCategory = 'joint_fixed' | 'joint_extra' | 'individual_a' | 'individual_b';

interface BillDraft {
  id: string;
  name: string;
  amount: string;
  category: BillCategory;
}

interface PotDraft {
  id: string;
  name: string;
  targetAmount: string;
  color: string;
}

const POT_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#f97316','#14b8a6'];

const DEFAULT_POTS: PotDraft[] = [
  { id: '1', name: 'Short-term savings', targetAmount: '', color: '#6366f1' },
  { id: '2', name: 'Holiday', targetAmount: '', color: '#f59e0b' },
  { id: '3', name: 'Celebrations', targetAmount: '', color: '#ec4899' },
  { id: '4', name: 'Ideas', targetAmount: '', color: '#10b981' },
  { id: '5', name: 'Trading 212', targetAmount: '', color: '#3b82f6' },
  { id: '6', name: 'ISA', targetAmount: '', color: '#8b5cf6' },
];

const DEFAULT_JOINT_BILLS: BillDraft[] = [
  { id: 'b1', name: 'Mortgage / Rent', amount: '', category: 'joint_fixed' },
  { id: 'b2', name: 'Energy', amount: '', category: 'joint_fixed' },
  { id: 'b3', name: 'Broadband', amount: '', category: 'joint_fixed' },
  { id: 'b4', name: 'Water', amount: '', category: 'joint_fixed' },
  { id: 'b5', name: 'Council Tax', amount: '', category: 'joint_fixed' },
  { id: 'b6', name: 'Insurance', amount: '', category: 'joint_fixed' },
];

function uid() { return Math.random().toString(36).slice(2); }

function fmt(v: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
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

  // Bills
  const [bills, setBills] = useState<BillDraft[]>(DEFAULT_JOINT_BILLS);

  // Pots
  const [pots, setPots] = useState<PotDraft[]>(DEFAULT_POTS);

  function addBill(cat: BillCategory) {
    setBills(b => [...b, { id: uid(), name: '', amount: '', category: cat }]);
  }

  function removeBill(id: string) {
    setBills(b => b.filter(x => x.id !== id));
  }

  function updateBill(id: string, field: keyof BillDraft, val: string) {
    setBills(b => b.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  function addPot() {
    setPots(p => [...p, { id: uid(), name: '', targetAmount: '', color: POT_COLORS[p.length % POT_COLORS.length] }]);
  }

  function removePot(id: string) {
    setPots(p => p.filter(x => x.id !== id));
  }

  function updatePot(id: string, field: keyof PotDraft, val: string) {
    setPots(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  async function finish() {
    setSaving(true);
    try {
      const hhRes = await fetch('/api/payday/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hhName || 'Our Household', mode, personAName: nameA || 'Person A', personBName: nameB || 'Person B' }),
      });
      const hh = await hhRes.json();

      const validBills = bills.filter(b => b.name && b.amount);
      await Promise.all(validBills.map(b =>
        fetch('/api/payday/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: hh.id, name: b.name, amount: parseFloat(b.amount), category: b.category }),
        })
      ));

      const validPots = pots.filter(p => p.name);
      await Promise.all(validPots.map((p, i) =>
        fetch('/api/payday/pots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ householdId: hh.id, name: p.name, targetAmount: p.targetAmount ? parseFloat(p.targetAmount) : null, color: p.color, sortOrder: i }),
        })
      ));

      router.push('/payday/session');
    } catch {
      alert('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  const categoryLabel: Record<BillCategory, string> = {
    joint_fixed: 'Joint fixed',
    joint_extra: 'Joint extras',
    individual_a: nameA || 'Person A',
    individual_b: nameB || 'Person B',
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg">
        <Link href="/payday" className="text-sm text-gray-400 hover:text-gray-600 mb-8 inline-block">← Payday</Link>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {(['household','bills','pots'] as Step[]).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
              step === s ? 'bg-[#1a1a1a]' : i < (['household','bills','pots'] as Step[]).indexOf(step) ? 'bg-gray-400' : 'bg-gray-200'
            }`} />
          ))}
        </div>

        {step === 'household' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Set up your household</h1>
              <p className="text-gray-500 text-sm">This takes a couple of minutes, then you&apos;re ready for every payday.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Household name</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="e.g. The Smiths"
                  value={hhName}
                  onChange={e => setHhName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Household type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['solo','partner'] as Mode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                        mode === m ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {m === 'solo' ? '🧍 Solo' : '👫 Partner'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{mode === 'solo' ? 'Your name' : 'Person A name'}</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder={mode === 'solo' ? 'Your name' : 'e.g. Ashley'}
                    value={nameA}
                    onChange={e => setNameA(e.target.value)}
                  />
                </div>
                {mode === 'partner' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Person B name</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="e.g. Sam"
                      value={nameB}
                      onChange={e => setNameB(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep('bills')}
              className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors"
            >
              Next: Your bills →
            </button>
          </div>
        )}

        {step === 'bills' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Your regular bills</h1>
              <p className="text-gray-500 text-sm">These load automatically each payday — you just confirm them.</p>
            </div>

            {(['joint_fixed','individual_a', ...(mode === 'partner' ? ['individual_b'] as BillCategory[] : [])] as BillCategory[]).map(cat => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">{categoryLabel[cat]}</h3>
                  <button onClick={() => addBill(cat)} className="text-xs text-gray-400 hover:text-gray-700 font-medium">+ Add</button>
                </div>
                <div className="space-y-2">
                  {bills.filter(b => b.category === cat).map(bill => (
                    <div key={bill.id} className="flex gap-2">
                      <input
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="Bill name"
                        value={bill.name}
                        onChange={e => updateBill(bill.id, 'name', e.target.value)}
                      />
                      <div className="relative w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                        <input
                          className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                          placeholder="0"
                          type="number"
                          min="0"
                          value={bill.amount}
                          onChange={e => updateBill(bill.id, 'amount', e.target.value)}
                        />
                      </div>
                      <button onClick={() => removeBill(bill.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                    </div>
                  ))}
                  {bills.filter(b => b.category === cat).length === 0 && (
                    <div className="text-xs text-gray-400 py-1">No bills added</div>
                  )}
                </div>
              </div>
            ))}

            <p className="text-xs text-gray-400">💡 Joint extras (one-off costs) are added per-session, not here.</p>

            <div className="flex gap-3">
              <button onClick={() => setStep('household')} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
              <button onClick={() => setStep('pots')} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">Next: Savings pots →</button>
            </div>
          </div>
        )}

        {step === 'pots' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Savings pots</h1>
              <p className="text-gray-500 text-sm">What are you saving for? You&apos;ll allocate money to these each payday.</p>
            </div>

            <div className="space-y-2">
              {pots.map(pot => (
                <div key={pot.id} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full shrink-0 cursor-pointer ring-2 ring-offset-2 ring-gray-200" style={{ background: pot.color }} />
                  <input
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Pot name"
                    value={pot.name}
                    onChange={e => updatePot(pot.id, 'name', e.target.value)}
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                    <input
                      className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Target"
                      type="number"
                      min="0"
                      value={pot.targetAmount}
                      onChange={e => updatePot(pot.id, 'targetAmount', e.target.value)}
                    />
                  </div>
                  <button onClick={() => removePot(pot.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                </div>
              ))}
            </div>

            <button onClick={addPot} className="w-full border border-dashed border-gray-300 py-3 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Add another pot
            </button>

            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
              <strong>Total bills:</strong> {fmt(bills.filter(b => b.amount).reduce((s, b) => s + parseFloat(b.amount || '0'), 0))} per month
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('bills')} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
              <button
                onClick={finish}
                disabled={saving}
                className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Let\'s go 🎉'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

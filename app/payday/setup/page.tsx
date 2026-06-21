'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'], weight: ['500', '600', '700'] });

// ── Shared types ──────────────────────────────────────────────────────────────

type Step = 'household' | 'joint_bills' | 'personal_bills' | 'debts' | 'lifestyle' | 'short_term' | 'long_term';
type Mode = 'solo' | 'partner';

interface BillDraft { id: string; name: string; amount: string; }
interface DebtDraft { id: string; name: string; amount: string; person: 'a' | 'b'; }
type AccountType = 'savings_account' | 'cash_isa' | 'stocks_isa' | 'lisa' | 'pension' | 'other';
interface PotDraft {
  id: string; name: string; targetAmount: string; targetMonths: string;
  color: string; owner: 'person_a' | 'person_b' | 'joint'; potType: 'short_term' | 'long_term';
  targetMode?: 'months' | 'date'; targetDate?: string;
  accountType?: AccountType; provider?: string;
}

// Settings-mode edit types
interface EditBill { localId: string; dbId?: string; name: string; amount: string; deleted?: boolean; }
interface EditDebt { localId: string; dbId?: string; name: string; amount: string; person: 'a' | 'b'; deleted?: boolean; }
interface EditPot {
  localId: string; dbId?: string; deleted?: boolean;
  name: string; targetAmount: string; targetMonths: string;
  color: string; owner: 'person_a' | 'person_b' | 'joint'; potType: 'short_term' | 'long_term';
  accountType?: AccountType; provider?: string;
}

interface HouseholdRow {
  id: string; name: string; mode: 'solo' | 'partner';
  person_a_name: string; person_b_name: string;
  joint_split_a: number; payday_day: number;
  default_spending_a: number; default_spending_b: number;
  default_transport_a: number; default_transport_b: number;
}

const POT_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#f97316','#14b8a6','#64748b'];

const ACCOUNT_TYPES: { value: AccountType; label: string; color: string }[] = [
  { value: 'savings_account', label: 'Savings',  color: '#10b981' },
  { value: 'cash_isa',        label: 'Cash ISA',  color: '#3b82f6' },
  { value: 'stocks_isa',      label: 'S&S ISA',   color: '#6366f1' },
  { value: 'lisa',            label: 'LISA',       color: '#8b5cf6' },
  { value: 'pension',         label: 'Pension',    color: '#64748b' },
  { value: 'other',           label: 'Other',      color: '#f59e0b' },
];

const DEFAULT_JOINT_BILLS: BillDraft[] = [
  { id: 'b1', name: 'Mortgage / Rent', amount: '' },
  { id: 'b2', name: 'Energy', amount: '' },
  { id: 'b3', name: 'Broadband', amount: '' },
  { id: 'b4', name: 'Water', amount: '' },
  { id: 'b5', name: 'Council Tax', amount: '' },
  { id: 'b6', name: 'Insurance', amount: '' },
  { id: 'b7', name: 'Food & Groceries', amount: '' },
];

const DEFAULT_SHORT_TERM: Omit<PotDraft, 'owner'>[] = [];
const DEFAULT_LONG_TERM: Omit<PotDraft, 'owner'>[] = [];

function uid() { return Math.random().toString(36).slice(2); }
const fmtGBP = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

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

// ── Shared UI primitives ──────────────────────────────────────────────────────

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

function NavButtons({ onBack, onNext, nextLabel = 'Next →' }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onBack} className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
      <button onClick={onNext} className="flex-1 bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">{nextLabel}</button>
    </div>
  );
}

function PersonBillSection({ name, bills, onAdd, onUpdate, onRemove }: {
  name: string; bills: BillDraft[];
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
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. Phone, Gym, Netflix" value={b.name} onChange={e => onUpdate(b.id, 'name', e.target.value)} />
          <AmountInput value={b.amount} onChange={v => onUpdate(b.id, 'amount', v)} />
          <button onClick={() => onRemove(b.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
        </div>
      ))}
      <button onClick={onAdd} className="text-xs text-gray-400 hover:text-gray-700 font-medium">+ Add bill</button>
    </div>
  );
}

function DebtSection({ name, debts, onAdd, onUpdate, onRemove }: {
  name: string; debts: DebtDraft[];
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
          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. Barclaycard, Car loan" value={d.name} onChange={e => onUpdate(d.id, 'name', e.target.value)} />
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

function ShortTermPotRow({ pot, onUpdate, onRemove }: {
  pot: PotDraft; onUpdate: (patch: Partial<PotDraft>) => void; onRemove: () => void;
}) {
  const mode = pot.targetMode ?? 'months';
  function monthsUntilDate(ym: string): number {
    const now = new Date();
    const [y, m] = ym.split('-').map(Number);
    return Math.max(1, (y - now.getFullYear()) * 12 + (m - now.getMonth()));
  }
  function paydayOptions() {
    const now = new Date(); const opts = [];
    for (let i = 1; i <= 60; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      opts.push({ val, label });
    }
    return opts;
  }
  const months = mode === 'date' && pot.targetDate ? monthsUntilDate(pot.targetDate) : parseInt(pot.targetMonths) || 0;
  const monthly = pot.targetAmount && months > 0 ? (parseFloat(pot.targetAmount) / months).toFixed(0) : null;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pot.color }} />
        <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="e.g. Holiday Fund" value={pot.name} onChange={e => onUpdate({ name: e.target.value })} />
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">×</button>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Target amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input type="number" min="0" className="w-full pl-7 pr-2 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. 2000" value={pot.targetAmount} onChange={e => onUpdate({ targetAmount: e.target.value })} />
        </div>
      </div>
      <div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-2">
          <button onClick={() => onUpdate({ targetMode: 'months' })} className={`flex-1 text-xs py-2 font-medium transition-colors ${mode === 'months' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Blend over months</button>
          <button onClick={() => onUpdate({ targetMode: 'date' })} className={`flex-1 text-xs py-2 font-medium transition-colors ${mode === 'date' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>By payday date</button>
        </div>
        {mode === 'months' ? (
          <input type="number" min="1" max="60" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. 12" value={pot.targetMonths} onChange={e => onUpdate({ targetMonths: e.target.value })} />
        ) : (
          <select value={pot.targetDate ?? ''} onChange={e => onUpdate({ targetDate: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="">Select target payday…</option>
            {paydayOptions().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        )}
      </div>
      {monthly && <div className="text-xs text-emerald-600 font-medium">→ Save £{monthly}/month{mode === 'date' && pot.targetDate ? ` over ${months} months` : ''}</div>}
    </div>
  );
}

function LongTermPotRow({ pot, onUpdate, onRemove }: {
  pot: PotDraft; onUpdate: (patch: Partial<PotDraft>) => void; onRemove: () => void;
}) {
  const [nameEdited, setNameEdited] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  function autoName(provider: string, accountType: AccountType): string {
    const labels: Record<AccountType, string> = { savings_account: 'Savings', cash_isa: 'Cash ISA', stocks_isa: 'S&S ISA', lisa: 'LISA', pension: 'Pension', other: '' };
    const suffix = labels[accountType] ?? '';
    return provider && suffix ? `${provider} ${suffix}` : provider || suffix;
  }
  function handleTypeChange(at: AccountType) {
    const typeConf = ACCOUNT_TYPES.find(t => t.value === at)!;
    const patch: Partial<PotDraft> = { accountType: at, color: typeConf.color };
    if (!nameEdited) patch.name = autoName(pot.provider ?? '', at);
    onUpdate(patch);
  }
  function handleProviderChange(provider: string) {
    const patch: Partial<PotDraft> = { provider };
    if (!nameEdited) patch.name = autoName(provider, pot.accountType ?? 'savings_account');
    onUpdate(patch);
  }
  const selectedType = ACCOUNT_TYPES.find(t => t.value === (pot.accountType ?? 'savings_account'))!;
  const monthly = pot.targetAmount ? parseFloat(pot.targetAmount) : null;
  if (collapsed && pot.name) {
    return (
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pot.color }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{pot.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: pot.color }}>{selectedType.label}</span>
            {monthly && monthly > 0 && <span className="text-xs text-gray-400">· £{monthly.toFixed(0)}/mo</span>}
          </div>
        </div>
        <button onClick={() => setCollapsed(false)} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1">Edit</button>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: pot.color }} />
        <span className="text-xs font-medium text-gray-500 flex-1">{selectedType.label}</span>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">×</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {ACCOUNT_TYPES.map(t => (
          <button key={t.value} onClick={() => handleTypeChange(t.value)}
            className={`text-xs px-2.5 py-1.5 rounded-full border font-medium transition-colors ${pot.accountType === t.value ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
            style={pot.accountType === t.value ? { background: t.color } : {}}>
            {t.label}
          </button>
        ))}
      </div>
      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        placeholder="Provider (e.g. Chase, Vanguard, Marcus)" value={pot.provider ?? ''} onChange={e => handleProviderChange(e.target.value)} />
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Label (auto-generated, or customise)</label>
        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-600"
          placeholder="e.g. Chase Savings" value={pot.name} onChange={e => { setNameEdited(true); onUpdate({ name: e.target.value }); }} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Monthly contribution (optional)</label>
        <div className="relative w-36">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
          <input type="number" min="0" className="w-full pl-7 pr-2 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="0" value={pot.targetAmount} onChange={e => onUpdate({ targetAmount: e.target.value })} />
        </div>
      </div>
      {pot.name && <button onClick={() => setCollapsed(true)} className="w-full border border-gray-200 py-2 rounded-xl text-xs font-medium text-gray-500 hover:border-gray-400 transition-colors">Done ✓</button>}
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

function SField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#717970] uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-[#c1c9be] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bae7f] bg-white font-medium" />
  );
}

function SAmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-36">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-sm">£</span>
      <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder="0"
        className="w-full pl-7 pr-2 py-2.5 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] font-semibold" />
    </div>
  );
}

function SavedBadge({ saved }: { saved: boolean }) {
  if (!saved) return null;
  return <span className="text-xs text-[#396940] font-semibold ml-2">Saved ✓</span>;
}

function SettingsSection({ icon, title, summary, children, onSave, saving, saved }: {
  icon: string; title: string; summary: string;
  children: React.ReactNode;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-hidden shadow-[0_1px_8px_rgba(57,105,64,0.06)]">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#f7faf8] transition-colors">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#181c1c]">{title}</div>
          {!open && <div className="text-xs text-[#717970] mt-0.5 truncate">{summary}</div>}
        </div>
        <span className="text-[#717970] text-sm shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-[#e6e9e7] px-5 py-5 space-y-4">
          {children}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={onSave} disabled={saving}
              className="px-5 py-2.5 bg-[#396940] text-white text-sm font-bold rounded-full hover:bg-[#2d5533] disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <SavedBadge saved={saved} />
          </div>
        </div>
      )}
    </div>
  );
}

function SEditBillRow({ name, amount, onName, onAmount, onRemove }: {
  name: string; amount: string;
  onName: (v: string) => void; onAmount: (v: string) => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#ebeeed] last:border-0">
      <input value={name} onChange={e => onName(e.target.value)} placeholder="Bill name"
        className="flex-1 text-sm text-[#181c1c] bg-transparent border-0 focus:outline-none focus:bg-[#f1f4f2] rounded-lg px-1 -mx-1 font-medium" />
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
        <input type="number" min="0" value={amount} onChange={e => onAmount(e.target.value)} placeholder="0"
          className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
      </div>
      <button onClick={onRemove} className="text-[#c1c9be] hover:text-[#ba1a1a] transition-colors shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  );
}

function SAddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full border border-dashed border-[#c1c9be] py-2 rounded-xl text-sm text-[#717970] hover:border-[#7bae7f] hover:text-[#396940] transition-colors mt-1 font-medium">
      {label}
    </button>
  );
}

function SettingsPage({ hh: initialHh }: { hh: HouseholdRow }) {
  const router = useRouter();
  const [hh, setHh] = useState(initialHh);

  // Household section
  const [hhName, setHhName] = useState(initialHh.name);
  const [hhMode, setHhMode] = useState<Mode>(initialHh.mode);
  const [nameA, setNameA] = useState(initialHh.person_a_name);
  const [nameB, setNameB] = useState(initialHh.person_b_name);
  const [splitA, setSplitA] = useState(String(initialHh.joint_split_a));
  const [paydayDay, setPaydayDay] = useState(String(initialHh.payday_day));
  const [hhSaving, setHhSaving] = useState(false);
  const [hhSaved, setHhSaved] = useState(false);

  // Bills
  const [jointBills, setJointBills] = useState<EditBill[]>([]);
  const [billsA, setBillsA] = useState<EditBill[]>([]);
  const [billsB, setBillsB] = useState<EditBill[]>([]);
  const [billsSaving, setBillsSaving] = useState(false);
  const [billsSaved, setBillsSaved] = useState(false);
  const [billsASaving, setBillsASaving] = useState(false);
  const [billsASaved, setBillsASaved] = useState(false);
  const [billsBSaving, setBillsBSaving] = useState(false);
  const [billsBSaved, setBillsBSaved] = useState(false);

  // Debts
  const [debtsA, setDebtsA] = useState<EditDebt[]>([]);
  const [debtsB, setDebtsB] = useState<EditDebt[]>([]);
  const [debtsSaving, setDebtsSaving] = useState(false);
  const [debtsSaved, setDebtsSaved] = useState(false);

  // Lifestyle
  const [spendingA, setSpendingA] = useState(String(initialHh.default_spending_a || ''));
  const [transportA, setTransportA] = useState(String(initialHh.default_transport_a || ''));
  const [spendingB, setSpendingB] = useState(String(initialHh.default_spending_b || ''));
  const [transportB, setTransportB] = useState(String(initialHh.default_transport_b || ''));
  const [lsSaving, setLsSaving] = useState(false);
  const [lsSaved, setLsSaved] = useState(false);

  // Pots
  const [shortPots, setShortPots] = useState<EditPot[]>([]);
  const [longPots, setLongPots] = useState<EditPot[]>([]);
  const [shortSaving, setShortSaving] = useState(false);
  const [shortSaved, setShortSaved] = useState(false);
  const [longSaving, setLongSaving] = useState(false);
  const [longSaved, setLongSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const [bRes, dRes, pRes] = await Promise.all([
        fetch(`/api/payday/bills?householdId=${initialHh.id}`),
        fetch(`/api/payday/debts?householdId=${initialHh.id}`),
        fetch(`/api/payday/pots?householdId=${initialHh.id}`),
      ]);
      if (bRes.ok) {
        const bills: {id:string;name:string;amount:number;category:string}[] = await bRes.json();
        setJointBills(bills.filter(b=>b.category==='joint_fixed').map(b=>({ localId: uid(), dbId: b.id, name: b.name, amount: String(b.amount) })));
        setBillsA(bills.filter(b=>b.category==='individual_a').map(b=>({ localId: uid(), dbId: b.id, name: b.name, amount: String(b.amount) })));
        setBillsB(bills.filter(b=>b.category==='individual_b').map(b=>({ localId: uid(), dbId: b.id, name: b.name, amount: String(b.amount) })));
      }
      if (dRes.ok) {
        const debts: {id:string;name:string;amount:number;person:string}[] = await dRes.json();
        setDebtsA(debts.filter(d=>d.person==='a').map(d=>({ localId: uid(), dbId: d.id, name: d.name, amount: String(d.amount), person: 'a' as const })));
        setDebtsB(debts.filter(d=>d.person==='b').map(d=>({ localId: uid(), dbId: d.id, name: d.name, amount: String(d.amount), person: 'b' as const })));
      }
      if (pRes.ok) {
        const pots: {id:string;name:string;target_amount:number|null;target_months:number|null;color:string;owner:string;pot_type:string;account_type:string|null;provider:string|null}[] = await pRes.json();
        setShortPots(pots.filter(p=>p.pot_type==='short_term').map(p=>({ localId: uid(), dbId: p.id, name: p.name, targetAmount: p.target_amount ? String(p.target_amount) : '', targetMonths: p.target_months ? String(p.target_months) : '', color: p.color, owner: p.owner as 'person_a'|'person_b'|'joint', potType: 'short_term' as const, accountType: (p.account_type as AccountType|null) ?? undefined, provider: p.provider ?? '' })));
        setLongPots(pots.filter(p=>p.pot_type==='long_term').map(p=>({ localId: uid(), dbId: p.id, name: p.name, targetAmount: p.target_amount ? String(p.target_amount) : '', targetMonths: p.target_months ? String(p.target_months) : '', color: p.color, owner: p.owner as 'person_a'|'person_b'|'joint', potType: 'long_term' as const, accountType: (p.account_type as AccountType|null) ?? undefined, provider: p.provider ?? '' })));
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHh.id]);

  const isPartner = hhMode === 'partner';

  async function saveHousehold() {
    setHhSaving(true);
    await fetch('/api/payday/households', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: hh.id, name: hhName, mode: hhMode,
        personAName: nameA, personBName: nameB,
        jointSplitA: parseInt(splitA) || 50,
        paydayDay: parseInt(paydayDay) || 25,
        defaultSpendingA: parseFloat(spendingA) || 0,
        defaultSpendingB: parseFloat(spendingB) || 0,
        defaultTransportA: parseFloat(transportA) || 0,
        defaultTransportB: parseFloat(transportB) || 0,
      }),
    });
    setHh(h => ({ ...h, name: hhName, mode: hhMode, person_a_name: nameA, person_b_name: nameB, joint_split_a: parseInt(splitA)||50, payday_day: parseInt(paydayDay)||25 }));
    setHhSaving(false); setHhSaved(true); setTimeout(() => setHhSaved(false), 2000);
  }

  async function saveBillSection(
    bills: EditBill[], category: string,
    setSaving: (v: boolean) => void, setSaved: (v: boolean) => void,
    setList: React.Dispatch<React.SetStateAction<EditBill[]>>
  ) {
    setSaving(true);
    const toDelete = bills.filter(b => b.dbId && b.deleted);
    const toUpdate = bills.filter(b => b.dbId && !b.deleted && b.name && b.amount);
    const toCreate = bills.filter(b => !b.dbId && !b.deleted && b.name && b.amount);
    await Promise.all([
      ...toDelete.map(b => fetch(`/api/payday/bills?id=${b.dbId}`, { method: 'DELETE' })),
      ...toUpdate.map(b => fetch('/api/payday/bills', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: b.dbId, name: b.name, amount: parseFloat(b.amount) }) })),
    ]);
    const created = await Promise.all(toCreate.map(b =>
      fetch('/api/payday/bills', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ householdId: hh.id, name: b.name, amount: parseFloat(b.amount), category }) }).then(r => r.json())
    ));
    let ci = 0;
    setList(prev => {
      const remaining = prev.filter(b => !b.deleted);
      return remaining.map(b => {
        if (!b.dbId && b.name && b.amount) { const c = created[ci++]; return { ...b, dbId: c?.id }; }
        return b;
      });
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveDebts() {
    setDebtsSaving(true);
    const allDebts = [...debtsA, ...debtsB];
    const toDelete = allDebts.filter(d => d.dbId);
    await Promise.all(toDelete.map(d => fetch(`/api/payday/debts?id=${d.dbId}`, { method: 'DELETE' })));
    const currentA = debtsA.filter(d => !d.deleted && d.name && d.amount);
    const currentB = debtsB.filter(d => !d.deleted && d.name && d.amount);
    const [createdA, createdB] = await Promise.all([
      Promise.all(currentA.map(d => fetch('/api/payday/debts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ householdId: hh.id, person: 'a', name: d.name, amount: parseFloat(d.amount) }) }).then(r=>r.json()))),
      Promise.all(currentB.map(d => fetch('/api/payday/debts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ householdId: hh.id, person: 'b', name: d.name, amount: parseFloat(d.amount) }) }).then(r=>r.json()))),
    ]);
    setDebtsA(currentA.map((d,i) => ({ ...d, dbId: createdA[i]?.id })));
    setDebtsB(currentB.map((d,i) => ({ ...d, dbId: createdB[i]?.id })));
    setDebtsSaving(false); setDebtsSaved(true); setTimeout(() => setDebtsSaved(false), 2000);
  }

  async function saveLifestyle() {
    setLsSaving(true);
    await fetch('/api/payday/households', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: hh.id, name: hh.name, mode: hh.mode,
        personAName: hh.person_a_name, personBName: hh.person_b_name,
        jointSplitA: hh.joint_split_a, paydayDay: hh.payday_day,
        defaultSpendingA: parseFloat(spendingA) || 0,
        defaultSpendingB: parseFloat(spendingB) || 0,
        defaultTransportA: parseFloat(transportA) || 0,
        defaultTransportB: parseFloat(transportB) || 0,
      }),
    });
    setLsSaving(false); setLsSaved(true); setTimeout(() => setLsSaved(false), 2000);
  }

  async function savePotSection(
    pots: EditPot[], potType: 'short_term' | 'long_term',
    setSaving: (v: boolean) => void, setSaved: (v: boolean) => void,
    setList: React.Dispatch<React.SetStateAction<EditPot[]>>
  ) {
    setSaving(true);
    const toDelete = pots.filter(p => p.dbId && p.deleted);
    const toUpdate = pots.filter(p => p.dbId && !p.deleted && p.name);
    const toCreate = pots.filter(p => !p.dbId && !p.deleted && p.name);
    await Promise.all([
      ...toDelete.map(p => fetch(`/api/payday/pots?id=${p.dbId}`, { method: 'DELETE' })),
      ...toUpdate.map(p => fetch('/api/payday/pots', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: p.dbId, name: p.name, targetAmount: p.targetAmount ? parseFloat(p.targetAmount) : null, targetMonths: p.targetMonths ? parseInt(p.targetMonths) : null, color: p.color, accountType: p.accountType ?? null, provider: p.provider ?? null }) })),
    ]);
    const created = await Promise.all(toCreate.map((p, i) =>
      fetch('/api/payday/pots', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ householdId: hh.id, name: p.name, targetAmount: p.targetAmount ? parseFloat(p.targetAmount) : null, targetMonths: p.targetMonths ? parseInt(p.targetMonths) : null, color: p.color, owner: p.owner, potType, sortOrder: pots.length + i, accountType: p.accountType ?? null, provider: p.provider ?? null }) }).then(r=>r.json())
    ));
    let ci = 0;
    setList(prev => {
      const remaining = prev.filter(p => !p.deleted);
      return remaining.map(p => {
        if (!p.dbId && p.name) { const c = created[ci++]; return { ...p, dbId: c?.id }; }
        return p;
      });
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const splitB = 100 - (parseInt(splitA) || 50);

  const jointBillsActive = jointBills.filter(b => !b.deleted);
  const billsAActive = billsA.filter(b => !b.deleted);
  const billsBActive = billsB.filter(b => !b.deleted);
  const debtsAActive = debtsA.filter(d => !d.deleted);
  const debtsBActive = debtsB.filter(d => !d.deleted);
  const shortPotsActive = shortPots.filter(p => !p.deleted);
  const longPotsActive = longPots.filter(p => !p.deleted);

  const sumBills = (list: EditBill[]) => list.reduce((s,b) => s + (parseFloat(b.amount)||0), 0);
  const sumDebts = (list: EditDebt[]) => list.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
          <div className="flex gap-5 items-center">
            <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Paydays</Link>
            <Link href="/payday/setup" className="text-sm text-[#396940] font-semibold transition-colors">Setup</Link>
            <button onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-6 pb-12">
        <Link href="/payday" className="text-sm text-[#717970] hover:text-[#396940] font-medium mb-5 inline-block">← Back to Paydays</Link>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-bold text-[#181c1c]">Settings</h1>
          </div>
          <p className="text-sm text-[#717970]">Your household baseline — bills, lifestyle, and savings targets that pre-load each payday.</p>
        </div>

        <div className="space-y-3">

          <SettingsSection
            icon="🏠" title="Household"
            summary={`${hh.name} · ${hh.mode === 'partner' ? `${hh.person_a_name} & ${hh.person_b_name}` : hh.person_a_name} · Payday day ${hh.payday_day}`}
            onSave={saveHousehold} saving={hhSaving} saved={hhSaved}
          >
            <SField label="Household name"><SInput value={hhName} onChange={setHhName} placeholder="e.g. The Smiths" /></SField>
            <SField label="Type">
              <div className="flex gap-2">
                {(['solo','partner'] as Mode[]).map(m => (
                  <button key={m} onClick={() => setHhMode(m)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-colors ${hhMode === m ? 'bg-[#396940] text-white border-[#396940]' : 'border-[#c1c9be] text-[#414940] hover:border-[#7bae7f]'}`}>
                    {m === 'solo' ? '🧍 Solo' : '👫 Partners'}
                  </button>
                ))}
              </div>
            </SField>
            <div className="grid grid-cols-2 gap-3">
              <SField label={isPartner ? 'Person A name' : 'Your name'}><SInput value={nameA} onChange={setNameA} placeholder="e.g. Ashley" /></SField>
              {isPartner && <SField label="Person B name"><SInput value={nameB} onChange={setNameB} placeholder="e.g. Sam" /></SField>}
            </div>
            {isPartner && (
              <SField label={`Joint split — ${nameA || 'A'} pays ${splitA}%, ${nameB || 'B'} pays ${splitB}%`}>
                <input type="range" min="0" max="100" value={splitA} onChange={e => setSplitA(e.target.value)}
                  className="w-full accent-[#396940]" />
              </SField>
            )}
            <SField label="Payday day of month">
              <input type="number" min="1" max="31" value={paydayDay} onChange={e => setPaydayDay(e.target.value)}
                className="w-24 border border-[#c1c9be] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-center font-semibold" />
            </SField>
          </SettingsSection>

          <SettingsSection
            icon="👥" title="Joint Bills"
            summary={jointBillsActive.length > 0 ? `${jointBillsActive.length} bills · ${fmtGBP(sumBills(jointBillsActive))}/mo` : 'No joint bills'}
            onSave={() => saveBillSection(jointBills, 'joint_fixed', setBillsSaving, setBillsSaved, setJointBills)}
            saving={billsSaving} saved={billsSaved}
          >
            {jointBillsActive.map(b => (
              <SEditBillRow key={b.localId} name={b.name} amount={b.amount}
                onName={v => setJointBills(l => l.map(x => x.localId === b.localId ? {...x, name: v} : x))}
                onAmount={v => setJointBills(l => l.map(x => x.localId === b.localId ? {...x, amount: v} : x))}
                onRemove={() => setJointBills(l => l.map(x => x.localId === b.localId ? {...x, deleted: true} : x))} />
            ))}
            <SAddBtn label="+ Add joint bill" onClick={() => setJointBills(l => [...l, { localId: uid(), name: '', amount: '' }])} />
          </SettingsSection>

          <SettingsSection
            icon="👤" title={`${hh.person_a_name}'s Personal Bills`}
            summary={billsAActive.length > 0 ? `${billsAActive.length} bills · ${fmtGBP(sumBills(billsAActive))}/mo` : 'No personal bills'}
            onSave={() => saveBillSection(billsA, 'individual_a', setBillsASaving, setBillsASaved, setBillsA)}
            saving={billsASaving} saved={billsASaved}
          >
            {billsAActive.map(b => (
              <SEditBillRow key={b.localId} name={b.name} amount={b.amount}
                onName={v => setBillsA(l => l.map(x => x.localId === b.localId ? {...x, name: v} : x))}
                onAmount={v => setBillsA(l => l.map(x => x.localId === b.localId ? {...x, amount: v} : x))}
                onRemove={() => setBillsA(l => l.map(x => x.localId === b.localId ? {...x, deleted: true} : x))} />
            ))}
            <SAddBtn label={`+ Add bill for ${hh.person_a_name}`} onClick={() => setBillsA(l => [...l, { localId: uid(), name: '', amount: '' }])} />
          </SettingsSection>

          {hh.mode === 'partner' && (
            <SettingsSection
              icon="👤" title={`${hh.person_b_name}'s Personal Bills`}
              summary={billsBActive.length > 0 ? `${billsBActive.length} bills · ${fmtGBP(sumBills(billsBActive))}/mo` : 'No personal bills'}
              onSave={() => saveBillSection(billsB, 'individual_b', setBillsBSaving, setBillsBSaved, setBillsB)}
              saving={billsBSaving} saved={billsBSaved}
            >
              {billsBActive.map(b => (
                <SEditBillRow key={b.localId} name={b.name} amount={b.amount}
                  onName={v => setBillsB(l => l.map(x => x.localId === b.localId ? {...x, name: v} : x))}
                  onAmount={v => setBillsB(l => l.map(x => x.localId === b.localId ? {...x, amount: v} : x))}
                  onRemove={() => setBillsB(l => l.map(x => x.localId === b.localId ? {...x, deleted: true} : x))} />
              ))}
              <SAddBtn label={`+ Add bill for ${hh.person_b_name}`} onClick={() => setBillsB(l => [...l, { localId: uid(), name: '', amount: '' }])} />
            </SettingsSection>
          )}

          <SettingsSection
            icon="💳" title="Debt Repayments"
            summary={[...debtsAActive, ...debtsBActive].length > 0 ? `${[...debtsAActive,...debtsBActive].length} debts · ${fmtGBP(sumDebts(debtsAActive)+sumDebts(debtsBActive))}/mo` : 'No debt repayments'}
            onSave={saveDebts} saving={debtsSaving} saved={debtsSaved}
          >
            <div className="text-xs font-bold text-[#717970] uppercase tracking-wide mb-2">{hh.person_a_name}</div>
            {debtsAActive.map(d => (
              <SEditBillRow key={d.localId} name={d.name} amount={d.amount}
                onName={v => setDebtsA(l => l.map(x => x.localId === d.localId ? {...x, name: v} : x))}
                onAmount={v => setDebtsA(l => l.map(x => x.localId === d.localId ? {...x, amount: v} : x))}
                onRemove={() => setDebtsA(l => l.map(x => x.localId === d.localId ? {...x, deleted: true} : x))} />
            ))}
            <SAddBtn label={`+ Add debt for ${hh.person_a_name}`} onClick={() => setDebtsA(l => [...l, { localId: uid(), name: '', amount: '', person: 'a' }])} />
            {hh.mode === 'partner' && (
              <>
                <div className="text-xs font-bold text-[#717970] uppercase tracking-wide mb-2 mt-4">{hh.person_b_name}</div>
                {debtsBActive.map(d => (
                  <SEditBillRow key={d.localId} name={d.name} amount={d.amount}
                    onName={v => setDebtsB(l => l.map(x => x.localId === d.localId ? {...x, name: v} : x))}
                    onAmount={v => setDebtsB(l => l.map(x => x.localId === d.localId ? {...x, amount: v} : x))}
                    onRemove={() => setDebtsB(l => l.map(x => x.localId === d.localId ? {...x, deleted: true} : x))} />
                ))}
                <SAddBtn label={`+ Add debt for ${hh.person_b_name}`} onClick={() => setDebtsB(l => [...l, { localId: uid(), name: '', amount: '', person: 'b' }])} />
              </>
            )}
          </SettingsSection>

          <SettingsSection
            icon="🎯" title="Lifestyle"
            summary={`${hh.person_a_name}: £${hh.default_spending_a||0} spending, £${hh.default_transport_a||0} travel${hh.mode==='partner' ? ` · ${hh.person_b_name}: £${hh.default_spending_b||0}, £${hh.default_transport_b||0}` : ''}`}
            onSave={saveLifestyle} saving={lsSaving} saved={lsSaved}
          >
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#717970] uppercase tracking-wide">{hh.person_a_name}</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[#181c1c]">Spending money</div>
                  <div className="text-xs text-[#717970]">Monthly pocket money</div>
                </div>
                <SAmountInput value={spendingA} onChange={setSpendingA} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[#181c1c]">Travel / Transport</div>
                  <div className="text-xs text-[#717970]">Commuting costs</div>
                </div>
                <SAmountInput value={transportA} onChange={setTransportA} />
              </div>
            </div>
            {hh.mode === 'partner' && (
              <div className="space-y-3 mt-4">
                <div className="text-xs font-bold text-[#717970] uppercase tracking-wide">{hh.person_b_name}</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#181c1c]">Spending money</div>
                    <div className="text-xs text-[#717970]">Monthly pocket money</div>
                  </div>
                  <SAmountInput value={spendingB} onChange={setSpendingB} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#181c1c]">Travel / Transport</div>
                    <div className="text-xs text-[#717970]">Commuting costs</div>
                  </div>
                  <SAmountInput value={transportB} onChange={setTransportB} />
                </div>
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            icon="🪣" title="Short-term Savings"
            summary={shortPotsActive.length > 0 ? `${shortPotsActive.length} pots` : 'No short-term savings pots'}
            onSave={() => savePotSection(shortPots, 'short_term', setShortSaving, setShortSaved, setShortPots)}
            saving={shortSaving} saved={shortSaved}
          >
            {(['person_a','person_b','joint'] as const).filter(owner => owner !== 'person_b' || hh.mode === 'partner').map(owner => {
              const label = owner === 'person_a' ? hh.person_a_name : owner === 'person_b' ? hh.person_b_name : 'Joint';
              const pots = shortPotsActive.filter(p => p.owner === owner);
              return (
                <div key={owner} className="space-y-2">
                  <div className="text-xs font-bold text-[#717970] uppercase tracking-wide">{label}</div>
                  {pots.map(p => (
                    <div key={p.localId} className="flex items-center gap-3 bg-[#f7faf8] border border-[#e6e9e7] rounded-xl px-3 py-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                      <input value={p.name} onChange={e => setShortPots(l => l.map(x => x.localId===p.localId?{...x,name:e.target.value}:x))}
                        className="flex-1 text-sm bg-transparent border-0 focus:outline-none font-medium text-[#181c1c]" placeholder="Pot name" />
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs">£</span>
                        <input type="number" min="0" value={p.targetAmount}
                          onChange={e => setShortPots(l => l.map(x => x.localId===p.localId?{...x,targetAmount:e.target.value}:x))}
                          placeholder="Target" className="w-full pl-6 pr-2 py-1.5 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                      </div>
                      <button onClick={() => setShortPots(l => l.map(x => x.localId===p.localId?{...x,deleted:true}:x))} className="text-[#c1c9be] hover:text-[#ba1a1a] shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <SAddBtn label={`+ Add pot for ${label}`} onClick={() => setShortPots(l => [...l, { localId: uid(), name: '', targetAmount: '', targetMonths: '12', color: POT_COLORS[l.length % POT_COLORS.length], owner, potType: 'short_term' }])} />
                </div>
              );
            })}
          </SettingsSection>

          <SettingsSection
            icon="📈" title="Long-term Savings"
            summary={longPotsActive.length > 0 ? `${longPotsActive.length} pots` : 'No long-term savings pots'}
            onSave={() => savePotSection(longPots, 'long_term', setLongSaving, setLongSaved, setLongPots)}
            saving={longSaving} saved={longSaved}
          >
            {(['person_a','person_b','joint'] as const).filter(owner => owner !== 'person_b' || hh.mode === 'partner').map(owner => {
              const label = owner === 'person_a' ? hh.person_a_name : owner === 'person_b' ? hh.person_b_name : 'Joint';
              const pots = longPotsActive.filter(p => p.owner === owner);
              return (
                <div key={owner} className="space-y-2">
                  <div className="text-xs font-bold text-[#717970] uppercase tracking-wide">{label}</div>
                  {pots.map(p => {
                    const typeConf = ACCOUNT_TYPES.find(t => t.value === (p.accountType ?? 'savings_account'))!;
                    return (
                      <div key={p.localId} className="bg-[#f7faf8] border border-[#e6e9e7] rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                          <input value={p.name} onChange={e => setLongPots(l => l.map(x => x.localId===p.localId?{...x,name:e.target.value}:x))}
                            className="flex-1 text-sm bg-transparent border-0 focus:outline-none font-medium text-[#181c1c]" placeholder="Pot name" />
                          <button onClick={() => setLongPots(l => l.map(x => x.localId===p.localId?{...x,deleted:true}:x))} className="text-[#c1c9be] hover:text-[#ba1a1a] shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {ACCOUNT_TYPES.map(t => (
                            <button key={t.value} onClick={() => setLongPots(l => l.map(x => x.localId===p.localId?{...x,accountType:t.value,color:t.color}:x))}
                              className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${p.accountType===t.value?'text-white border-transparent':'border-[#c1c9be] text-[#717970] hover:border-[#7bae7f]'}`}
                              style={p.accountType===t.value?{background:t.color}:{}}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <input value={p.provider??''} onChange={e => setLongPots(l => l.map(x => x.localId===p.localId?{...x,provider:e.target.value}:x))}
                          className="w-full text-sm border border-[#c1c9be] rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#7bae7f]" placeholder="Provider (e.g. Vanguard, Chase)" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#717970] shrink-0">Monthly:</span>
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs">£</span>
                            <input type="number" min="0" value={p.targetAmount}
                              onChange={e => setLongPots(l => l.map(x => x.localId===p.localId?{...x,targetAmount:e.target.value}:x))}
                              placeholder="0" className="w-full pl-6 pr-2 py-1.5 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{background:typeConf.color}}>{typeConf.label}</span>
                        </div>
                      </div>
                    );
                  })}
                  <SAddBtn label={`+ Add pot for ${label}`} onClick={() => {
                    const defaultType = ACCOUNT_TYPES[0];
                    setLongPots(l => [...l, { localId: uid(), name: '', targetAmount: '', targetMonths: '', color: defaultType.color, owner, potType: 'long_term', accountType: defaultType.value, provider: '' }]);
                  }} />
                </div>
              );
            })}
          </SettingsSection>

        </div>
      </div>
    </div>
  );
}

// ── Onboarding wizard (new users) ─────────────────────────────────────────────

function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('household');
  const [saving, setSaving] = useState(false);

  const [hhName, setHhName] = useState('');
  const [mode, setMode] = useState<Mode>('partner');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [splitA, setSplitA] = useState('50');
  const [paydayDay, setPaydayDay] = useState('25');

  const [jointBills, setJointBills] = useState<BillDraft[]>(DEFAULT_JOINT_BILLS);
  const [billsA, setBillsA] = useState<BillDraft[]>([]);
  const [billsB, setBillsB] = useState<BillDraft[]>([]);
  const [debtsA, setDebtsA] = useState<DebtDraft[]>([]);
  const [debtsB, setDebtsB] = useState<DebtDraft[]>([]);
  const [spendingA, setSpendingA] = useState('');
  const [spendingB, setSpendingB] = useState('');
  const [transportA, setTransportA] = useState('');
  const [transportB, setTransportB] = useState('');
  const [shortTermPots, setShortTermPots] = useState<PotDraft[]>(DEFAULT_SHORT_TERM.map(p => ({ ...p, owner: 'person_a' as const })));
  const [longTermPots, setLongTermPots] = useState<PotDraft[]>(DEFAULT_LONG_TERM.map(p => ({ ...p, owner: 'person_a' as const })));

  const splitB = 100 - (parseInt(splitA) || 50);
  const isPartner = mode === 'partner';
  const stepIndex = STEPS.indexOf(step);

  function prev() { if (stepIndex > 0) setStep(STEPS[stepIndex - 1]); }
  function next() { if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]); }

  function addBill(list: BillDraft[], set: (l: BillDraft[]) => void) { set([...list, { id: uid(), name: '', amount: '' }]); }
  function updateBill(list: BillDraft[], set: (l: BillDraft[]) => void, id: string, field: 'name' | 'amount', val: string) { set(list.map(b => b.id === id ? { ...b, [field]: val } : b)); }
  function removeBill(list: BillDraft[], set: (l: BillDraft[]) => void, id: string) { set(list.filter(b => b.id !== id)); }

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

  function addShortTermFor(owner: 'person_a' | 'person_b' | 'joint') {
    setShortTermPots(p => [...p, { id: uid(), name: '', targetAmount: '', targetMonths: '12', color: POT_COLORS[p.length % POT_COLORS.length], owner, potType: 'short_term', targetMode: 'months' }]);
  }
  function addLongTermFor(owner: 'person_a' | 'person_b' | 'joint') {
    const defaultType = ACCOUNT_TYPES[0];
    setLongTermPots(p => [...p, { id: uid(), name: '', targetAmount: '', targetMonths: '', color: defaultType.color, owner, potType: 'long_term', accountType: defaultType.value, provider: '' }]);
  }
  function updatePot(list: PotDraft[], set: (l: PotDraft[]) => void, id: string, patch: Partial<PotDraft>) {
    set(list.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  async function finish() {
    setSaving(true);
    try {
      const hhRes = await fetch('/api/payday/households', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hhName || 'Our Household', mode, personAName: nameA || 'Person A', personBName: nameB || 'Person B', jointSplitA: parseInt(splitA) || 50, paydayDay: parseInt(paydayDay) || 25, defaultSpendingA: parseFloat(spendingA) || 0, defaultSpendingB: parseFloat(spendingB) || 0, defaultTransportA: parseFloat(transportA) || 0, defaultTransportB: parseFloat(transportB) || 0 }),
      });
      const hh = await hhRes.json();
      const hhId = hh.id;

      await Promise.all(jointBills.filter(b => b.name && b.amount).map(b =>
        fetch('/api/payday/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hhId, name: b.name, amount: parseFloat(b.amount), category: 'joint_fixed' }) })
      ));
      await Promise.all(billsA.filter(b => b.name && b.amount).map(b =>
        fetch('/api/payday/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hhId, name: b.name, amount: parseFloat(b.amount), category: 'individual_a' }) })
      ));
      if (isPartner) {
        await Promise.all(billsB.filter(b => b.name && b.amount).map(b =>
          fetch('/api/payday/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hhId, name: b.name, amount: parseFloat(b.amount), category: 'individual_b' }) })
        ));
      }
      await Promise.all(debtsA.filter(d => d.name && d.amount).map(d =>
        fetch('/api/payday/debts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hhId, person: 'a', name: d.name, amount: parseFloat(d.amount) }) })
      ));
      if (isPartner) {
        await Promise.all(debtsB.filter(d => d.name && d.amount).map(d =>
          fetch('/api/payday/debts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hhId, person: 'b', name: d.name, amount: parseFloat(d.amount) }) })
        ));
      }
      const allPots = [...shortTermPots, ...longTermPots].filter(p => p.name);
      await Promise.all(allPots.map((p, i) =>
        fetch('/api/payday/pots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hhId, name: p.name, targetAmount: p.targetAmount ? parseFloat(p.targetAmount) : null, targetMonths: p.targetMonths ? parseInt(p.targetMonths) : null, color: p.color, owner: p.owner, potType: p.potType, sortOrder: i, accountType: p.accountType ?? null, provider: p.provider ?? null }) })
      ));

      router.push('/payday?onboarding=1');
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

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{STEP_LABELS[step]}</span>
          <span className="text-xs text-gray-400">{stepIndex + 1} / {STEPS.length}</span>
        </div>

        <div className="flex gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`} />
          ))}
        </div>

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
                        <input type="range" min="0" max="100" value={splitA} onChange={e => setSplitA(e.target.value)} className="w-full accent-gray-900" />
                      </div>
                      <div className="text-center shrink-0 w-16">
                        <div className="text-lg font-bold">{splitA}%</div>
                        <div className="text-xs text-gray-400">{splitB}%</div>
                        <div className="text-xs text-gray-400">{nameB || 'B'}</div>
                      </div>
                    </div>
                    {splitA === '50' && <p className="text-xs text-gray-400 mt-2">Split evenly 50/50</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-sm font-medium mb-0.5">Payday date</label>
              <p className="text-xs text-gray-400 mb-3">Which day of the month does your salary land?</p>
              <div className="flex items-center gap-3">
                <input type="number" min="1" max="31" value={paydayDay} onChange={e => setPaydayDay(e.target.value)}
                  className="w-24 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-center font-semibold" />
                <span className="text-sm text-gray-500">of each month</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Next month&apos;s payday becomes editable 2 weeks before this date.</p>
            </div>

            <button onClick={next} className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Next: Joint Bills →
            </button>
          </div>
        )}

        {step === 'joint_bills' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">{isPartner ? 'Your Joint Bills' : 'Your Household Bills'}</h1>
              <p className="text-gray-500 text-sm">{isPartner ? 'Costs you share as a household — mortgage, utilities, food. These load automatically each payday and are split by your agreed ratio.' : 'Your regular household costs — mortgage, utilities, food. These load automatically each payday for you to confirm.'}</p>
            </div>

            <div className="space-y-2">
              {jointBills.map(b => (
                <div key={b.id} className="flex gap-2 items-center">
                  <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    placeholder="Bill name" value={b.name} onChange={e => updateBill(jointBills, setJointBills, b.id, 'name', e.target.value)} />
                  <AmountInput value={b.amount} onChange={v => updateBill(jointBills, setJointBills, b.id, 'amount', v)} />
                  <button onClick={() => removeBill(jointBills, setJointBills, b.id)} className="text-gray-300 hover:text-red-400 px-1 text-lg leading-none">×</button>
                </div>
              ))}
            </div>

            <button onClick={() => addBill(jointBills, setJointBills)} className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">+ Add bill</button>

            {totalJointBills > 0 && isPartner && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Total joint bills</span>
                  <span className="font-medium text-gray-900">{fmtGBP(totalJointBills)}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-xs">
                  <span>{nameA || 'Person A'} pays ({splitA}%)</span>
                  <span>{fmtGBP(totalJointBills * parseInt(splitA) / 100)}</span>
                </div>
                {isPartner && (
                  <div className="flex justify-between text-gray-400 text-xs">
                    <span>{nameB || 'Person B'} pays ({splitB}%)</span>
                    <span>{fmtGBP(totalJointBills * splitB / 100)}</span>
                  </div>
                )}
              </div>
            )}

            <NavButtons onBack={prev} onNext={next} />
          </div>
        )}

        {step === 'personal_bills' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Personal Bills</h1>
              <p className="text-gray-500 text-sm">{isPartner ? "Each person's own recurring costs — phone contracts, gym memberships, subscriptions. These come out of each person's own share." : "Your own recurring personal costs — phone, gym, subscriptions."}</p>
            </div>
            <PersonBillSection name={nameA || 'Person A'} bills={billsA} onAdd={() => addBill(billsA, setBillsA)} onUpdate={(id, f, v) => updateBill(billsA, setBillsA, id, f, v)} onRemove={id => removeBill(billsA, setBillsA, id)} />
            {isPartner && <PersonBillSection name={nameB || 'Person B'} bills={billsB} onAdd={() => addBill(billsB, setBillsB)} onUpdate={(id, f, v) => updateBill(billsB, setBillsB, id, f, v)} onRemove={id => removeBill(billsB, setBillsB, id)} />}
            <NavButtons onBack={prev} onNext={next} />
          </div>
        )}

        {step === 'debts' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Debt Repayments</h1>
              <p className="text-gray-500 text-sm">Credit cards, loans, or any regular debt payments. These come out of each person&apos;s own money each month. Leave blank if none.</p>
            </div>
            <DebtSection name={nameA || 'Person A'} debts={debtsA} onAdd={() => addDebt('a')} onUpdate={(id, f, v) => updateDebt('a', id, f, v)} onRemove={id => removeDebt('a', id)} />
            {isPartner && <DebtSection name={nameB || 'Person B'} debts={debtsB} onAdd={() => addDebt('b')} onUpdate={(id, f, v) => updateDebt('b', id, f, v)} onRemove={id => removeDebt('b', id)} />}
            <NavButtons onBack={prev} onNext={next} nextLabel="Next: Lifestyle →" />
          </div>
        )}

        {step === 'lifestyle' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Lifestyle</h1>
              <p className="text-gray-500 text-sm">Monthly spending money and travel costs, per person. These are the amounts each person sets aside for themselves every payday.</p>
            </div>
            <div className="space-y-4">
              <LifestylePersonBlock name={nameA || 'Person A'} spending={spendingA} onSpending={setSpendingA} transport={transportA} onTransport={setTransportA} />
              {isPartner && <LifestylePersonBlock name={nameB || 'Person B'} spending={spendingB} onSpending={setSpendingB} transport={transportB} onTransport={setTransportB} />}
            </div>
            <NavButtons onBack={prev} onNext={next} nextLabel="Next: Short-term Savings →" />
          </div>
        )}

        {step === 'short_term' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Short-term Savings Goals</h1>
              <p className="text-gray-500 text-sm">Life events and near-future expenses — holidays, celebrations, big purchases.</p>
            </div>
            {isPartner ? (
              <>
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nameA || 'Person A'}</div>
                  {shortTermPots.filter(p => p.owner === 'person_a').map(pot => (
                    <ShortTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(shortTermPots, setShortTermPots, pot.id, patch)} onRemove={() => setShortTermPots(p => p.filter(x => x.id !== pot.id))} />
                  ))}
                  <button onClick={() => addShortTermFor('person_a')} className="w-full border border-dashed border-gray-300 py-2 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add goal for {nameA || 'Person A'}</button>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nameB || 'Person B'}</div>
                  {shortTermPots.filter(p => p.owner === 'person_b').map(pot => (
                    <ShortTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(shortTermPots, setShortTermPots, pot.id, patch)} onRemove={() => setShortTermPots(p => p.filter(x => x.id !== pot.id))} />
                  ))}
                  <button onClick={() => addShortTermFor('person_b')} className="w-full border border-dashed border-gray-300 py-2 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add goal for {nameB || 'Person B'}</button>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Joint</div>
                  {shortTermPots.filter(p => p.owner === 'joint').map(pot => (
                    <ShortTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(shortTermPots, setShortTermPots, pot.id, patch)} onRemove={() => setShortTermPots(p => p.filter(x => x.id !== pot.id))} />
                  ))}
                  <button onClick={() => addShortTermFor('joint')} className="w-full border border-dashed border-gray-300 py-2 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add joint goal</button>
                </div>
              </>
            ) : (
              <>
                {shortTermPots.map(pot => (
                  <ShortTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(shortTermPots, setShortTermPots, pot.id, patch)} onRemove={() => setShortTermPots(p => p.filter(x => x.id !== pot.id))} />
                ))}
                <button onClick={() => addShortTermFor('person_a')} className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add savings goal</button>
              </>
            )}
            <NavButtons onBack={prev} onNext={next} nextLabel="Next: Long-term Savings →" />
          </div>
        )}

        {step === 'long_term' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Long-term Savings & Investments</h1>
              <p className="text-gray-500 text-sm">Accounts and platforms you contribute to each month — ISAs, investment apps, pensions. Add each one you want to allocate to on payday.</p>
            </div>
            {isPartner ? (
              <>
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nameA || 'Person A'}</div>
                  {longTermPots.filter(p => p.owner === 'person_a').map(pot => (
                    <LongTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(longTermPots, setLongTermPots, pot.id, patch)} onRemove={() => setLongTermPots(p => p.filter(x => x.id !== pot.id))} />
                  ))}
                  <button onClick={() => addLongTermFor('person_a')} className="w-full border border-dashed border-gray-300 py-2 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add account for {nameA || 'Person A'}</button>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nameB || 'Person B'}</div>
                  {longTermPots.filter(p => p.owner === 'person_b').map(pot => (
                    <LongTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(longTermPots, setLongTermPots, pot.id, patch)} onRemove={() => setLongTermPots(p => p.filter(x => x.id !== pot.id))} />
                  ))}
                  <button onClick={() => addLongTermFor('person_b')} className="w-full border border-dashed border-gray-300 py-2 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add account for {nameB || 'Person B'}</button>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Joint</div>
                  {longTermPots.filter(p => p.owner === 'joint').map(pot => (
                    <LongTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(longTermPots, setLongTermPots, pot.id, patch)} onRemove={() => setLongTermPots(p => p.filter(x => x.id !== pot.id))} />
                  ))}
                  <button onClick={() => addLongTermFor('joint')} className="w-full border border-dashed border-gray-300 py-2 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add joint account</button>
                </div>
              </>
            ) : (
              <>
                {longTermPots.map(pot => (
                  <LongTermPotRow key={pot.id} pot={pot} onUpdate={(patch) => updatePot(longTermPots, setLongTermPots, pot.id, patch)} onRemove={() => setLongTermPots(p => p.filter(x => x.id !== pot.id))} />
                ))}
                <button onClick={() => addLongTermFor('person_a')} className="w-full border border-dashed border-gray-300 py-2.5 rounded-xl text-sm text-gray-500 hover:border-gray-400">+ Add account / platform</button>
              </>
            )}
            <button onClick={finish} disabled={saving} className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60">
              {saving ? 'Setting up...' : "Let's go 🎉"}
            </button>
            <button onClick={prev} className="w-full border border-gray-200 py-3 rounded-xl text-sm font-medium hover:border-gray-400 transition-colors">← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main entry point ──────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [hh, setHh] = useState<HouseholdRow | null | 'loading'>('loading');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/payday/households');
        if (res.status === 401) { router.replace('/payday/login'); return; }
        const data = res.ok ? await res.json() : null;
        setHh(data);
      } catch {
        setHh(null);
      }
    }
    load();
  }, [router]);

  if (hh === 'loading') {
    return (
      <div className={`flex items-center justify-center min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
        <div className="text-[#414940] text-sm font-medium">Loading...</div>
      </div>
    );
  }

  if (hh === null) {
    return <OnboardingWizard />;
  }

  return <SettingsPage hh={hh} />;
}

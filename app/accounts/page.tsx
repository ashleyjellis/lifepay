'use client';
import { useState, type ChangeEvent } from 'react';
import { useAccounts } from '@/hooks/useStorage';
import { formatCurrency } from '@/lib/format';
import { CardSkeleton } from '@/components/Skeleton';
import type { Account } from '@/types';

type AccountType = Account['type'];

const TABS: { type: AccountType; label: string }[] = [
  { type: 'current', label: 'Current' },
  { type: 'savings', label: 'Savings' },
  { type: 'investment', label: 'Investments' },
  { type: 'credit', label: 'Credit Cards' },
  { type: 'loan', label: 'Loans' },
  { type: 'mortgage', label: 'Mortgage' },
];

function emptyForm(type: AccountType) {
  return {
    name: '',
    provider: '',
    accountNumber: '',
    balance: '',
    interestRate: '',
    creditLimit: '',
    dealEndDate: '',
    dealDescription: '',
    originalAmount: '',
    termMonths: '',
    monthlyPayment: '',
    type,
  };
}

type FormState = ReturnType<typeof emptyForm>;

export default function AccountsPage() {
  const { accounts, loading, add, update, remove } = useAccounts();
  const [activeTab, setActiveTab] = useState<AccountType>('current');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm('current'));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered: Account[] = accounts.filter((a: Account) => a.type === activeTab);

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-900';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
  const errorCls = 'text-xs text-red-600 mt-0.5';

  function openAdd() {
    setForm(emptyForm(activeTab));
    setEditId(null);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(a: Account) {
    setForm({
      name: a.name,
      provider: a.provider ?? '',
      accountNumber: a.accountNumber ?? '',
      balance: String(Math.abs(a.balance)),
      interestRate: a.interestRate != null ? String(a.interestRate) : '',
      creditLimit: a.creditLimit != null ? String(a.creditLimit) : '',
      dealEndDate: a.dealEndDate ?? '',
      dealDescription: a.dealDescription ?? '',
      originalAmount: a.originalAmount != null ? String(a.originalAmount) : '',
      termMonths: a.termMonths != null ? String(a.termMonths) : '',
      monthlyPayment: a.monthlyPayment != null ? String(a.monthlyPayment) : '',
      type: a.type,
    });
    setEditId(a.id);
    setErrors({});
    setShowForm(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (form.balance === '' || isNaN(+form.balance)) e.balance = 'Enter a valid amount';
    if (activeTab === 'credit' && form.creditLimit && isNaN(+form.creditLimit)) e.creditLimit = 'Invalid';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function toAccount(): Omit<Account, 'id'> {
    const isDebt = activeTab === 'loan' || activeTab === 'mortgage' || activeTab === 'credit';
    const balance = isDebt ? -Math.abs(+form.balance) : +form.balance;
    const base: Omit<Account, 'id'> = {
      name: form.name.trim(),
      type: activeTab,
      balance,
      provider: form.provider || undefined,
      accountNumber: form.accountNumber || undefined,
      interestRate: form.interestRate ? +form.interestRate : undefined,
    };
    if (activeTab === 'credit') {
      base.creditLimit = form.creditLimit ? +form.creditLimit : undefined;
      base.dealEndDate = form.dealEndDate || undefined;
      base.dealDescription = form.dealDescription || undefined;
    }
    if (activeTab === 'loan' || activeTab === 'mortgage') {
      base.originalAmount = form.originalAmount ? +form.originalAmount : undefined;
      base.termMonths = form.termMonths ? +form.termMonths : undefined;
      base.monthlyPayment = form.monthlyPayment ? +form.monthlyPayment : undefined;
    }
    return base;
  }

  function handleSave() {
    if (!validate()) return;
    if (editId) {
      update(editId, toAccount());
    } else {
      add({ id: crypto.randomUUID(), ...toAccount() });
    }
    setShowForm(false);
    setEditId(null);
  }

  function f(v: string) {
    return (e: ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [v]: e.target.value }));
  }

  if (loading) return <div className="p-4 md:p-6"><CardSkeleton /></div>;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <button
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800"
          onClick={openAdd}
        >
          + Add
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.type}
            onClick={() => { setActiveTab(t.type); setShowForm(false); }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-3">
          <p className="text-sm font-semibold">{editId ? 'Edit account' : `Add ${TABS.find(t => t.type === activeTab)?.label}`}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Account name *</label>
              <input className={inputCls} placeholder="e.g. Barclays Current" value={form.name} onChange={f('name')} />
              {errors.name && <p className={errorCls}>{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Provider / Bank</label>
              <input className={inputCls} placeholder="e.g. Barclays" value={form.provider} onChange={f('provider')} />
            </div>
            <div>
              <label className={labelCls}>Account number (last 4)</label>
              <input className={inputCls} placeholder="**** 1234" value={form.accountNumber} onChange={f('accountNumber')} />
            </div>
            <div>
              <label className={labelCls}>{activeTab === 'loan' || activeTab === 'mortgage' ? 'Remaining balance (£) *' : 'Balance (£) *'}</label>
              <input className={inputCls} type="number" placeholder="0.00" value={form.balance} onChange={f('balance')} />
              {errors.balance && <p className={errorCls}>{errors.balance}</p>}
            </div>
            <div>
              <label className={labelCls}>Interest rate (% APR/AER)</label>
              <input className={inputCls} type="number" step="0.01" placeholder="e.g. 4.5" value={form.interestRate} onChange={f('interestRate')} />
            </div>

            {activeTab === 'credit' && <>
              <div>
                <label className={labelCls}>Credit limit (£)</label>
                <input className={inputCls} type="number" placeholder="e.g. 5000" value={form.creditLimit} onChange={f('creditLimit')} />
                {errors.creditLimit && <p className={errorCls}>{errors.creditLimit}</p>}
              </div>
              <div>
                <label className={labelCls}>Deal end date</label>
                <input className={inputCls} type="date" value={form.dealEndDate} onChange={f('dealEndDate')} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Deal description</label>
                <input className={inputCls} placeholder="e.g. 0% purchases for 24 months" value={form.dealDescription} onChange={f('dealDescription')} />
              </div>
            </>}

            {(activeTab === 'loan' || activeTab === 'mortgage') && <>
              <div>
                <label className={labelCls}>Original amount (£)</label>
                <input className={inputCls} type="number" placeholder="e.g. 200000" value={form.originalAmount} onChange={f('originalAmount')} />
              </div>
              <div>
                <label className={labelCls}>Term remaining (months)</label>
                <input className={inputCls} type="number" placeholder="e.g. 240" value={form.termMonths} onChange={f('termMonths')} />
              </div>
              <div>
                <label className={labelCls}>Monthly payment (£)</label>
                <input className={inputCls} type="number" placeholder="e.g. 850" value={form.monthlyPayment} onChange={f('monthlyPayment')} />
              </div>
            </>}
          </div>

          <div className="flex gap-3 pt-1">
            <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            <button className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}

      {/* Account list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">No {TABS.find(t => t.type === activeTab)?.label.toLowerCase()} accounts yet.</p>
          <button className="mt-3 text-sm text-gray-900 font-medium underline" onClick={openAdd}>Add one</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <AccountCard key={a.id} account={a} onEdit={() => openEdit(a)} onRemove={() => remove(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountCard({ account: a, onEdit, onRemove }: { account: Account; onEdit: () => void; onRemove: () => void }) {
  const isDebt = a.type === 'credit' || a.type === 'loan' || a.type === 'mortgage';
  const displayBalance = Math.abs(a.balance);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{a.name}</p>
          {a.provider && <p className="text-xs text-gray-500">{a.provider}{a.accountNumber ? ` · ${a.accountNumber}` : ''}</p>}
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${isDebt ? 'text-[#A32D2D]' : 'text-gray-900'}`}>
            {isDebt ? '-' : ''}{formatCurrency(displayBalance)}
          </p>
          {a.type === 'credit' && a.creditLimit && (
            <p className="text-xs text-gray-400">{formatCurrency(a.creditLimit - displayBalance)} available</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {a.interestRate != null && (
          <span className="bg-gray-100 rounded-full px-2.5 py-1 text-gray-600">{a.interestRate}% APR</span>
        )}
        {a.dealDescription && (
          <span className="bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">{a.dealDescription}</span>
        )}
        {a.dealEndDate && (
          <span className="bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">Deal ends {a.dealEndDate}</span>
        )}
        {a.termMonths != null && (
          <span className="bg-gray-100 rounded-full px-2.5 py-1 text-gray-600">{a.termMonths} months left</span>
        )}
        {a.monthlyPayment != null && (
          <span className="bg-gray-100 rounded-full px-2.5 py-1 text-gray-600">{formatCurrency(a.monthlyPayment)}/mo</span>
        )}
      </div>

      {a.type === 'credit' && a.creditLimit && (
        <div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#A32D2D] rounded-full"
              style={{ width: `${Math.min(100, (displayBalance / a.creditLimit) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{Math.round((displayBalance / a.creditLimit) * 100)}% utilisation</p>
        </div>
      )}

      <div className="flex gap-3 pt-1 border-t border-gray-50">
        <button className="text-xs text-gray-500 hover:text-gray-900 font-medium" onClick={onEdit}>Edit</button>
        <button className="text-xs text-gray-400 hover:text-red-500" onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}

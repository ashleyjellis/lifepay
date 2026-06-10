'use client';
import { useState } from 'react';
import { useAccounts, useBills, useEvents, useIncome, usePreferences, useTransactions } from '@/hooks/useStorage';
import { formatCurrency, currentPayPeriod } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import type { Transaction } from '@/types';
import { format } from 'date-fns';

const CATEGORIES: Transaction['category'][] = ['groceries', 'eating-out', 'transport', 'entertainment', 'clothing', 'health', 'household', 'other'];

export default function TrackerPage() {
  const { prefs, loading: pLoading } = usePreferences();
  const { income, loading: iLoading } = useIncome();
  const { bills, loading: bLoading } = useBills();
  const { events, loading: eLoading } = useEvents();
  const { accounts, loading: aLoading } = useAccounts();
  const { transactions, loading: tLoading, add, remove } = useTransactions();

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: 'groceries' as Transaction['category'],
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loading = pLoading || iLoading || bLoading || eLoading || aLoading || tLoading;

  const payPeriod = currentPayPeriod(prefs.paydayDay);
  const periodTransactions = transactions.filter(t => t.payPeriod === payPeriod).sort((a, b) => b.date.localeCompare(a.date));

  const salary = income.find(i => i.frequency === 'monthly');
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);
  const eventsThisMonth = events.filter(e => e.date.startsWith(payPeriod)).reduce((s, e) => s + e.budget, 0);
  const discretionary = (salary?.amount ?? 0) - billsTotal - eventsThisMonth;
  const spent = periodTransactions.reduce((s, t) => s + t.amount, 0);
  const remaining = discretionary - spent;
  const pct = discretionary > 0 ? Math.min(100, (spent / discretionary) * 100) : 0;

  function validate() {
    const e: Record<string, string> = {};
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = 'Enter a valid amount';
    if (!form.date) e.date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    add({
      id: crypto.randomUUID(),
      date: form.date,
      amount: +form.amount,
      category: form.category,
      notes: form.notes,
      payPeriod,
    });
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', category: 'groceries', notes: '' });
  }

  if (loading) {
    return <div className="p-4 md:p-6 space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';
  const errorCls = 'text-xs text-red-600 mt-0.5';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Tracker</h1>

      {/* Budget progress */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">This pay period</p>
          <p className="text-sm text-gray-500">{formatCurrency(spent)} of {formatCurrency(discretionary)}</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className={`h-2.5 rounded-full ${pct >= 100 ? 'bg-[#A32D2D]' : pct >= 80 ? 'bg-[#854F0B]' : 'bg-[#3B6D11]'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-sm mt-2 font-semibold ${remaining < 0 ? 'text-[#A32D2D]' : 'text-[#3B6D11]'}`}>
          {remaining >= 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over budget`}
        </p>
      </div>

      {/* Add transaction */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Add expense</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <input type="date" className={inputCls + ' w-full'} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            {errors.date && <p className={errorCls}>{errors.date}</p>}
          </div>
          <div>
            <input type="number" className={inputCls + ' w-full'} placeholder="Amount (£)" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            {errors.amount && <p className={errorCls}>{errors.amount}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select className={inputCls + ' w-full'} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as Transaction['category'] }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
          </select>
          <input className={inputCls + ' w-full'} placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
        <button className="w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-800" onClick={handleAdd}>
          Add expense
        </button>
      </div>

      {/* Transaction list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <p className="text-xs text-gray-500 font-medium px-4 py-3 border-b border-gray-100 uppercase tracking-wide">
          Transactions — {payPeriod}
        </p>
        {periodTransactions.length === 0 ? (
          <EmptyState message="No transactions this period. Add your first expense above." />
        ) : (
          <div className="divide-y divide-gray-50">
            {periodTransactions.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">{t.category.replace('-', ' ')}</p>
                  <p className="text-xs text-gray-400">{t.date}{t.notes ? ` · ${t.notes}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#A32D2D]">−{formatCurrency(t.amount)}</span>
                  <button className="text-xs text-gray-300 hover:text-red-500" onClick={() => remove(t.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

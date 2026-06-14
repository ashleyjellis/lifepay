'use client';
import { useState } from 'react';
import { useIncome, usePreferences } from '@/hooks/useStorage';
import { formatCurrency } from '@/lib/format';
import { CardSkeleton } from '@/components/Skeleton';
import type { Income } from '@/types';

const emptyForm = { name: 'Salary', amount: '', frequency: 'monthly' as Income['frequency'], paydayDayOfMonth: '28', nextDate: '' };

export default function IncomePage() {
  const { income, loading: iLoading, add, update, remove } = useIncome();
  const { prefs, loading: pLoading, setPrefs } = usePreferences();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loading = iLoading || pLoading;

  const totalMonthly = income.reduce((s, i) => {
    if (i.frequency === 'monthly') return s + i.amount;
    if (i.frequency === 'weekly') return s + (i.amount * 52) / 12;
    return s;
  }, 0);

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-900';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
  const errorCls = 'text-xs text-red-600 mt-0.5';

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = 'Enter a valid amount';
    if (form.frequency === 'monthly') {
      if (!form.paydayDayOfMonth || +form.paydayDayOfMonth < 1 || +form.paydayDayOfMonth > 31) e.paydayDayOfMonth = '1–31';
    } else if (!form.nextDate) {
      e.nextDate = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const entry: Omit<Income, 'id'> = {
      name: form.name.trim(),
      amount: +form.amount,
      frequency: form.frequency,
      paydayDayOfMonth: form.frequency === 'monthly' ? +form.paydayDayOfMonth : undefined,
      nextDate: form.frequency !== 'monthly' ? form.nextDate : undefined,
    };
    if (editId) {
      update(editId, entry);
      // keep prefs in sync if this is a monthly income
      if (form.frequency === 'monthly') {
        setPrefs({ ...prefs, paydayDay: +form.paydayDayOfMonth });
      }
    } else {
      add({ id: crypto.randomUUID(), ...entry });
      if (form.frequency === 'monthly') {
        setPrefs({ ...prefs, paydayDay: +form.paydayDayOfMonth });
      }
    }
    setShowForm(false);
    setEditId(null);
  }

  function startEdit(i: Income) {
    setForm({
      name: i.name,
      amount: String(i.amount),
      frequency: i.frequency,
      paydayDayOfMonth: String(i.paydayDayOfMonth ?? prefs.paydayDay),
      nextDate: i.nextDate ?? '',
    });
    setEditId(i.id);
    setErrors({});
    setShowForm(true);
  }

  function openAdd() {
    setForm({ ...emptyForm });
    setEditId(null);
    setErrors({});
    setShowForm(true);
  }

  if (loading) return <div className="p-4 md:p-6"><CardSkeleton /></div>;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Income</h1>
        <button className="bg-gray-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800" onClick={openAdd}>
          + Add
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-500">Est. monthly income</p>
        <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-3">
          <p className="text-sm font-semibold">{editId ? 'Edit income' : 'New income'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input className={inputCls} placeholder="Salary" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {errors.name && <p className={errorCls}>{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Amount (£) *</label>
              <input className={inputCls} type="number" placeholder="2000" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              {errors.amount && <p className={errorCls}>{errors.amount}</p>}
            </div>
            <div>
              <label className={labelCls}>Frequency *</label>
              <select className={inputCls} value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value as Income['frequency'] }))}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="one-off">One-off</option>
              </select>
            </div>
            {form.frequency === 'monthly' ? (
              <div>
                <label className={labelCls}>Payday (day of month) *</label>
                <input className={inputCls} type="number" min="1" max="31" placeholder="28" value={form.paydayDayOfMonth} onChange={e => setForm(p => ({ ...p, paydayDayOfMonth: e.target.value }))} />
                {errors.paydayDayOfMonth && <p className={errorCls}>{errors.paydayDayOfMonth}</p>}
              </div>
            ) : (
              <div>
                <label className={labelCls}>Next date *</label>
                <input className={inputCls} type="date" value={form.nextDate} onChange={e => setForm(p => ({ ...p, nextDate: e.target.value }))} />
                {errors.nextDate && <p className={errorCls}>{errors.nextDate}</p>}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            <button className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {income.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">No income added yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {income.map(i => (
              <div key={i.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {i.frequency}
                    {i.frequency === 'monthly' && i.paydayDayOfMonth ? ` · day ${i.paydayDayOfMonth}` : ''}
                    {i.frequency !== 'monthly' && i.nextDate ? ` · next ${i.nextDate}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-[#3B6D11]">{formatCurrency(i.amount)}</p>
                  <button className="text-xs text-gray-300 hover:text-blue-500" onClick={() => startEdit(i)}>Edit</button>
                  <button className="text-xs text-gray-300 hover:text-red-500" onClick={() => remove(i.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

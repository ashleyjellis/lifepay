'use client';
import { useState } from 'react';
import { useBills } from '@/hooks/useStorage';
import { formatCurrency } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import type { Bill } from '@/types';

const emptyForm = { name: '', amount: '', dueDayOfMonth: '1' };

export default function BillsPage() {
  const { bills, loading, add, update, remove } = useBills();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = bills.reduce((s, b) => s + b.amount, 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = 'Enter a valid amount';
    if (!form.dueDayOfMonth || +form.dueDayOfMonth < 1 || +form.dueDayOfMonth > 31) e.day = '1–31';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    if (editId) {
      update(editId, { name: form.name, amount: +form.amount, dueDayOfMonth: +form.dueDayOfMonth });
      setEditId(null);
    } else {
      add({ id: crypto.randomUUID(), name: form.name, amount: +form.amount, dueDayOfMonth: +form.dueDayOfMonth });
    }
    setForm({ ...emptyForm });
    setShowForm(false);
  }

  function startEdit(b: Bill) {
    setForm({ name: b.name, amount: String(b.amount), dueDayOfMonth: String(b.dueDayOfMonth) });
    setEditId(b.id);
    setShowForm(true);
  }

  if (loading) return <div className="p-4 md:p-6"><CardSkeleton /></div>;

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-900';
  const errorCls = 'text-xs text-red-600 mt-0.5';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills</h1>
        <button className="bg-gray-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowForm(!showForm); }}>
          + Add bill
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-500">Total monthly outgoings</p>
        <p className="text-2xl font-bold">{formatCurrency(total)}</p>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-3">
          <p className="text-sm font-semibold">{editId ? 'Edit bill' : 'New bill'}</p>
          <div>
            <input className={inputCls} placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            {errors.name && <p className={errorCls}>{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input className={inputCls} type="number" placeholder="Amount (£)" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              {errors.amount && <p className={errorCls}>{errors.amount}</p>}
            </div>
            <div>
              <input className={inputCls} type="number" min="1" max="31" placeholder="Day of month" value={form.dueDayOfMonth} onChange={e => setForm(p => ({ ...p, dueDayOfMonth: e.target.value }))} />
              {errors.day && <p className={errorCls}>{errors.day}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            <button className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {bills.length === 0 ? (
          <EmptyState message="No bills yet. Add your first recurring bill above." />
        ) : (
          <div className="divide-y divide-gray-50">
            {[...bills].sort((a, b) => a.dueDayOfMonth - b.dueDayOfMonth).map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-gray-400">Day {b.dueDayOfMonth} each month</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#A32D2D]">{formatCurrency(b.amount)}</span>
                  <button className="text-xs text-gray-300 hover:text-blue-500" onClick={() => startEdit(b)}>Edit</button>
                  <button className="text-xs text-gray-300 hover:text-red-500" onClick={() => remove(b.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

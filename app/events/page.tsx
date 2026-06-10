'use client';
import { useState } from 'react';
import { useEvents } from '@/hooks/useStorage';
import { formatCurrency } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import type { LifeEvent } from '@/types';

const CATEGORIES: { key: LifeEvent['category']; label: string }[] = [
  { key: 'birthday', label: 'Birthdays' },
  { key: 'holiday', label: 'Holidays' },
  { key: 'expense', label: 'Big Expenses' },
];

function daysUntil(dateStr: string) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

const emptyForm = { name: '', date: '', budget: '', category: 'birthday' as LifeEvent['category'] };

export default function EventsPage() {
  const { events, loading, add, update, remove } = useEvents();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.date) e.date = 'Required';
    if (!form.budget || isNaN(+form.budget) || +form.budget <= 0) e.budget = 'Enter a valid amount';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    if (editId) {
      update(editId, { name: form.name, date: form.date, budget: +form.budget, category: form.category });
      setEditId(null);
    } else {
      add({ id: crypto.randomUUID(), name: form.name, date: form.date, budget: +form.budget, category: form.category });
    }
    setForm({ ...emptyForm });
    setShowForm(false);
  }

  function startEdit(e: LifeEvent) {
    setForm({ name: e.name, date: e.date, budget: String(e.budget), category: e.category });
    setEditId(e.id);
    setShowForm(true);
  }

  if (loading) return <div className="p-4 md:p-6"><CardSkeleton /></div>;

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-900';
  const errorCls = 'text-xs text-red-600 mt-0.5';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <button className="bg-gray-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowForm(!showForm); }}>
          + Add event
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-3">
          <p className="text-sm font-semibold">{editId ? 'Edit event' : 'New event'}</p>
          <select className={inputCls} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as LifeEvent['category'] }))}>
            <option value="birthday">Birthday</option>
            <option value="holiday">Holiday / Trip</option>
            <option value="expense">Big Expense</option>
          </select>
          <div>
            <input className={inputCls} placeholder="Name / description" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            {errors.name && <p className={errorCls}>{errors.name}</p>}
          </div>
          <div>
            <input className={inputCls} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            {errors.date && <p className={errorCls}>{errors.date}</p>}
          </div>
          <div>
            <input className={inputCls} type="number" placeholder="Budget (£)" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
            {errors.budget && <p className={errorCls}>{errors.budget}</p>}
          </div>
          <div className="flex gap-3">
            <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            <button className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}

      {CATEGORIES.map(({ key, label }) => {
        const group = events.filter(e => e.category === key).sort((a, b) => a.date.localeCompare(b.date));
        return (
          <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <p className="text-xs font-medium text-gray-500 px-4 py-3 border-b border-gray-100 uppercase tracking-wide">{label}</p>
            {group.length === 0 ? (
              <EmptyState message={`No ${label.toLowerCase()} yet`} />
            ) : (
              <div className="divide-y divide-gray-50">
                {group.map(e => {
                  const days = daysUntil(e.date);
                  return (
                    <div key={e.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="text-xs text-gray-400">{e.date} · {days >= 0 ? `in ${days} day${days !== 1 ? 's' : ''}` : `${Math.abs(days)} days ago`}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#A32D2D]">{formatCurrency(e.budget)}</span>
                        <button className="text-xs text-gray-300 hover:text-blue-500" onClick={() => startEdit(e)}>Edit</button>
                        <button className="text-xs text-gray-300 hover:text-red-500" onClick={() => remove(e.id)}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

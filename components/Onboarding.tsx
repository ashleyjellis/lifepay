'use client';
import { useState } from 'react';
import { setAccounts, setBills, setEvents, setIncome, setOnboardingComplete, setPreferences } from '@/lib/storage';
import type { Account, Bill, Income, LifeEvent } from '@/types';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);

  // Step 1: Accounts
  const [currentBalance, setCurrentBalance] = useState('');
  const [savingsBalance, setSavingsBalance] = useState('');
  const [ccBalance, setCcBalance] = useState('');
  const [ccLimit, setCcLimit] = useState('');

  // Step 2: Income
  const [salary, setSalary] = useState('');
  const [paydayDay, setPaydayDay] = useState('28');
  const [extraIncome, setExtraIncome] = useState<Omit<Income, 'id'>[]>([]);
  const [extraForm, setExtraForm] = useState({ name: '', amount: '', frequency: 'monthly' as Income['frequency'], nextDate: '' });

  // Step 3: Bills
  const [rent, setRent] = useState('');
  const [rentDay, setRentDay] = useState('1');
  const [utils, setUtils] = useState('');
  const [utilsDay, setUtilsDay] = useState('1');
  const [otherBills, setOtherBills] = useState<Omit<Bill, 'id'>[]>([]);
  const [billForm, setBillForm] = useState({ name: '', amount: '', dueDayOfMonth: '1' });

  // Step 4: Events
  const [events, setEventsState] = useState<Omit<LifeEvent, 'id'>[]>([]);
  const [eventForm, setEventForm] = useState({ name: '', date: '', budget: '', category: 'birthday' as LifeEvent['category'] });

  // Step 5: Preferences
  const [threshold, setThreshold] = useState('250');

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate1() {
    const e: Record<string, string> = {};
    if (!currentBalance || isNaN(+currentBalance)) e.currentBalance = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validate2() {
    const e: Record<string, string> = {};
    if (!salary || isNaN(+salary) || +salary <= 0) e.salary = 'Required';
    if (!paydayDay || isNaN(+paydayDay) || +paydayDay < 1 || +paydayDay > 31) e.paydayDay = '1–31';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validate3() {
    const e: Record<string, string> = {};
    if (!rent || isNaN(+rent) || +rent <= 0) e.rent = 'Required';
    if (!rentDay || isNaN(+rentDay) || +rentDay < 1 || +rentDay > 31) e.rentDay = '1–31';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validate5() {
    const e: Record<string, string> = {};
    if (!threshold || isNaN(+threshold) || +threshold < 0) e.threshold = 'Must be a positive number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleFinish() {
    if (!validate5()) return;

    const accounts: Account[] = [];
    accounts.push({ id: crypto.randomUUID(), name: 'Current Account', type: 'current', balance: +currentBalance });
    if (savingsBalance) accounts.push({ id: crypto.randomUUID(), name: 'Savings', type: 'savings', balance: +savingsBalance });
    if (ccBalance && ccLimit) accounts.push({ id: crypto.randomUUID(), name: 'Credit Card', type: 'credit', balance: -Math.abs(+ccBalance), creditLimit: +ccLimit });

    const income: Income[] = [
      { id: crypto.randomUUID(), name: 'Salary', amount: +salary, frequency: 'monthly', paydayDayOfMonth: +paydayDay },
      ...extraIncome.map(i => ({ ...i, id: crypto.randomUUID() })),
    ];

    const bills: Bill[] = [];
    if (+rent > 0) bills.push({ id: crypto.randomUUID(), name: 'Rent / Mortgage', amount: +rent, dueDayOfMonth: +rentDay });
    if (utils && +utils > 0) bills.push({ id: crypto.randomUUID(), name: 'Utilities', amount: +utils, dueDayOfMonth: +utilsDay });
    bills.push(...otherBills.map(b => ({ ...b, id: crypto.randomUUID() })));

    const lifeEvents: LifeEvent[] = events.map(e => ({ ...e, id: crypto.randomUUID() }));

    setAccounts(accounts);
    setIncome(income);
    setBills(bills);
    setEvents(lifeEvents);
    setPreferences({ lowBalanceThreshold: +threshold, paydayDay: +paydayDay });
    setOnboardingComplete();
    onComplete();
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-900';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
  const errorCls = 'text-xs text-red-600 mt-0.5';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-6">
        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-gray-900' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Your accounts</h1>
            <p className="text-sm text-gray-500 mb-5">Enter your current balances to get started.</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Current account balance (£) *</label>
                <input className={inputCls} type="number" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} placeholder="2500" />
                {errors.currentBalance && <p className={errorCls}>{errors.currentBalance}</p>}
              </div>
              <div>
                <label className={labelCls}>Savings balance (£) — optional</label>
                <input className={inputCls} type="number" value={savingsBalance} onChange={e => setSavingsBalance(e.target.value)} placeholder="1000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Credit card balance (£)</label>
                  <input className={inputCls} type="number" value={ccBalance} onChange={e => setCcBalance(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Credit limit (£)</label>
                  <input className={inputCls} type="number" value={ccLimit} onChange={e => setCcLimit(e.target.value)} placeholder="2000" />
                </div>
              </div>
            </div>
            <button className="mt-6 w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition" onClick={() => { if (validate1()) setStep(2); }}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Your income</h1>
            <p className="text-sm text-gray-500 mb-5">When does money come in?</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Salary (£) *</label>
                  <input className={inputCls} type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="2000" />
                  {errors.salary && <p className={errorCls}>{errors.salary}</p>}
                </div>
                <div>
                  <label className={labelCls}>Payday (day of month) *</label>
                  <input className={inputCls} type="number" min="1" max="31" value={paydayDay} onChange={e => setPaydayDay(e.target.value)} placeholder="28" />
                  {errors.paydayDay && <p className={errorCls}>{errors.paydayDay}</p>}
                </div>
              </div>
              {extraIncome.length > 0 && (
                <div className="space-y-1">
                  {extraIncome.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span>{i.name} — £{i.amount} ({i.frequency})</span>
                      <button className="text-red-500 text-xs" onClick={() => setExtraIncome(prev => prev.filter((_, j) => j !== idx))}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <details className="border border-gray-200 rounded-lg p-3">
                <summary className="text-sm text-gray-600 cursor-pointer font-medium">+ Add other income</summary>
                <div className="mt-3 space-y-3">
                  <input className={inputCls} placeholder="Name" value={extraForm.name} onChange={e => setExtraForm(p => ({ ...p, name: e.target.value }))} />
                  <input className={inputCls} type="number" placeholder="Amount (£)" value={extraForm.amount} onChange={e => setExtraForm(p => ({ ...p, amount: e.target.value }))} />
                  <select className={inputCls} value={extraForm.frequency} onChange={e => setExtraForm(p => ({ ...p, frequency: e.target.value as Income['frequency'] }))}>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="one-off">One-off</option>
                  </select>
                  <input className={inputCls} type="date" value={extraForm.nextDate} onChange={e => setExtraForm(p => ({ ...p, nextDate: e.target.value }))} />
                  <button className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg" onClick={() => {
                    if (!extraForm.name || !extraForm.amount || !extraForm.nextDate) return;
                    setExtraIncome(prev => [...prev, { name: extraForm.name, amount: +extraForm.amount, frequency: extraForm.frequency, nextDate: extraForm.nextDate }]);
                    setExtraForm({ name: '', amount: '', frequency: 'monthly', nextDate: '' });
                  }}>Add</button>
                </div>
              </details>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200" onClick={() => setStep(1)}>Back</button>
              <button className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800" onClick={() => { if (validate2()) setStep(3); }}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Your bills</h1>
            <p className="text-sm text-gray-500 mb-5">Recurring monthly outgoings.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Rent / Mortgage (£) *</label>
                  <input className={inputCls} type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="900" />
                  {errors.rent && <p className={errorCls}>{errors.rent}</p>}
                </div>
                <div>
                  <label className={labelCls}>Day of month *</label>
                  <input className={inputCls} type="number" min="1" max="31" value={rentDay} onChange={e => setRentDay(e.target.value)} placeholder="1" />
                  {errors.rentDay && <p className={errorCls}>{errors.rentDay}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Utilities (£)</label>
                  <input className={inputCls} type="number" value={utils} onChange={e => setUtils(e.target.value)} placeholder="120" />
                </div>
                <div>
                  <label className={labelCls}>Day of month</label>
                  <input className={inputCls} type="number" min="1" max="31" value={utilsDay} onChange={e => setUtilsDay(e.target.value)} placeholder="1" />
                </div>
              </div>
              {otherBills.length > 0 && (
                <div className="space-y-1">
                  {otherBills.map((b, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span>{b.name} — £{b.amount} (day {b.dueDayOfMonth})</span>
                      <button className="text-red-500 text-xs" onClick={() => setOtherBills(prev => prev.filter((_, j) => j !== idx))}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <details className="border border-gray-200 rounded-lg p-3">
                <summary className="text-sm text-gray-600 cursor-pointer font-medium">+ Add another bill</summary>
                <div className="mt-3 space-y-3">
                  <input className={inputCls} placeholder="Name" value={billForm.name} onChange={e => setBillForm(p => ({ ...p, name: e.target.value }))} />
                  <input className={inputCls} type="number" placeholder="Amount (£)" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} />
                  <input className={inputCls} type="number" min="1" max="31" placeholder="Day of month" value={billForm.dueDayOfMonth} onChange={e => setBillForm(p => ({ ...p, dueDayOfMonth: e.target.value }))} />
                  <button className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg" onClick={() => {
                    if (!billForm.name || !billForm.amount) return;
                    setOtherBills(prev => [...prev, { name: billForm.name, amount: +billForm.amount, dueDayOfMonth: +billForm.dueDayOfMonth }]);
                    setBillForm({ name: '', amount: '', dueDayOfMonth: '1' });
                  }}>Add</button>
                </div>
              </details>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200" onClick={() => setStep(2)}>Back</button>
              <button className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800" onClick={() => { if (validate3()) setStep(4); }}>Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Life events</h1>
            <p className="text-sm text-gray-500 mb-5">Birthdays, holidays, big expenses.</p>
            {events.length > 0 && (
              <div className="space-y-1 mb-4">
                {events.map((e, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span>{e.name} — £{e.budget} ({e.date})</span>
                    <button className="text-red-500 text-xs" onClick={() => setEventsState(prev => prev.filter((_, j) => j !== idx))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <select className={inputCls} value={eventForm.category} onChange={e => setEventForm(p => ({ ...p, category: e.target.value as LifeEvent['category'] }))}>
                <option value="birthday">Birthday</option>
                <option value="holiday">Holiday / Trip</option>
                <option value="expense">Big expense</option>
              </select>
              <input className={inputCls} placeholder="Name / description" value={eventForm.name} onChange={e => setEventForm(p => ({ ...p, name: e.target.value }))} />
              <input className={inputCls} type="date" value={eventForm.date} onChange={e => setEventForm(p => ({ ...p, date: e.target.value }))} />
              <input className={inputCls} type="number" placeholder="Budget (£)" value={eventForm.budget} onChange={e => setEventForm(p => ({ ...p, budget: e.target.value }))} />
              <button className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg w-full" onClick={() => {
                if (!eventForm.name || !eventForm.date || !eventForm.budget) return;
                setEventsState(prev => [...prev, { name: eventForm.name, date: eventForm.date, budget: +eventForm.budget, category: eventForm.category }]);
                setEventForm({ name: '', date: '', budget: '', category: 'birthday' });
              }}>+ Add event</button>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200" onClick={() => setStep(3)}>Back</button>
              <button className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800" onClick={() => setStep(5)}>Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Preferences</h1>
            <p className="text-sm text-gray-500 mb-5">Almost done!</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Low balance warning threshold (£)</label>
                <input className={inputCls} type="number" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="250" />
                {errors.threshold && <p className={errorCls}>{errors.threshold}</p>}
                <p className="text-xs text-gray-400 mt-1">You&apos;ll see a warning when forecast balance drops below this.</p>
              </div>
              <div>
                <label className={labelCls}>Confirm payday day</label>
                <input className={inputCls} type="number" min="1" max="31" value={paydayDay} onChange={e => setPaydayDay(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200" onClick={() => setStep(4)}>Back</button>
              <button className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800" onClick={handleFinish}>Finish setup</button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">Step {step} of 5</p>
      </div>
    </div>
  );
}

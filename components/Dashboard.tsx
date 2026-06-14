'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccounts, useBills, useEvents, useIncome, usePreferences } from '@/hooks/useStorage';
import { forecastAtDay, runForecast } from '@/lib/forecast';
import { formatCurrency, nextOccurrence } from '@/lib/format';
import { getPaydaySnapshots, addPaydaySnapshot } from '@/lib/storage';
import { AmountText } from './AmountText';
import { CardSkeleton } from './Skeleton';
import { TrafficBadge } from './TrafficBadge';
import type { Account, TrafficLight } from '@/types';
import { format, addDays } from 'date-fns';

type AccountTab = 'current' | 'savings' | 'investment' | 'credit' | 'loan' | 'mortgage';
const ACCOUNT_TABS: { type: AccountTab; label: string }[] = [
  { type: 'current', label: 'Current' },
  { type: 'savings', label: 'Savings' },
  { type: 'investment', label: 'Investments' },
  { type: 'credit', label: 'Credit' },
  { type: 'loan', label: 'Loans' },
  { type: 'mortgage', label: 'Mortgage' },
];

function AccountTabPanel({ accounts, type }: { accounts: Account[]; type: AccountTab }) {
  const filtered = accounts.filter(a => a.type === type);
  const isDebt = type === 'credit' || type === 'loan' || type === 'mortgage';

  if (filtered.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-400">No {type} accounts</p>
        <Link href="/accounts" className="text-xs text-gray-900 font-medium underline mt-1 inline-block">Add one</Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {filtered.map(a => {
        const display = Math.abs(a.balance);
        return (
          <div key={a.id} className="py-3 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">{a.name}</p>
              {a.provider && <p className="text-xs text-gray-400">{a.provider}{a.accountNumber ? ` · ${a.accountNumber}` : ''}</p>}
              <div className="flex flex-wrap gap-1 mt-1">
                {a.interestRate != null && <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">{a.interestRate}%</span>}
                {a.dealDescription && <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{a.dealDescription}</span>}
                {a.dealEndDate && <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">Deal ends {a.dealEndDate}</span>}
                {a.termMonths != null && <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">{a.termMonths}mo left</span>}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-base font-bold ${isDebt ? 'text-[#A32D2D]' : 'text-gray-900'}`}>
                {isDebt ? '-' : ''}{formatCurrency(display)}
              </p>
              {type === 'credit' && a.creditLimit && (
                <p className="text-xs text-gray-400">{formatCurrency(a.creditLimit - display)} avail</p>
              )}
              {a.monthlyPayment != null && (
                <p className="text-xs text-gray-400">{formatCurrency(a.monthlyPayment)}/mo</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function trafficLight(balance: number): TrafficLight {
  if (balance >= 1000) return 'green';
  if (balance >= 250) return 'amber';
  return 'red';
}

export function Dashboard() {
  const { accounts, loading: aLoading } = useAccounts();
  const { income, loading: iLoading } = useIncome();
  const { bills, loading: bLoading } = useBills();
  const { events, loading: eLoading } = useEvents();
  const { prefs, loading: pLoading } = usePreferences();

  const [accountTab, setAccountTab] = useState<AccountTab>('current');
  const [showPayday, setShowPayday] = useState(false);
  const [paydayInput, setPaydayInput] = useState('');
  const [paydaySummary, setPaydaySummary] = useState<{ forecast: number; actual: number } | null>(null);

  const loading = aLoading || iLoading || bLoading || eLoading || pLoading;

  const forecast = useMemo(() => {
    if (loading) return [];
    return runForecast(accounts, income, bills, events);
  }, [accounts, income, bills, events, loading]);

  const currentBalance = accounts.filter(a => a.type === 'current').reduce((s, a) => s + a.balance, 0);
  const creditUsed = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0);

  const now = new Date();
  const in7Days = format(addDays(now, 7), 'yyyy-MM-dd');
  const billsDueNext7 = bills.reduce((s, b) => {
    const next = nextOccurrence(b.dueDayOfMonth);
    return next <= addDays(now, 7) ? s + b.amount : s;
  }, 0);
  const availableCash = currentBalance - billsDueNext7;

  const forecast7 = forecastAtDay(forecast, 7) ?? currentBalance;
  const forecast30 = forecastAtDay(forecast, 30) ?? currentBalance;
  const forecast90 = forecastAtDay(forecast, 90) ?? currentBalance;

  // Next income
  const salary = income.find(i => i.frequency === 'monthly');
  const nextPayday = salary ? nextOccurrence(salary.paydayDayOfMonth ?? prefs.paydayDay) : null;
  const daysToPayday = nextPayday ? Math.round((nextPayday.getTime() - now.getTime()) / 86400000) : 0;

  // Bills in next 30 days
  const upcomingBills = bills
    .map(b => ({ ...b, next: nextOccurrence(b.dueDayOfMonth) }))
    .filter(b => b.next <= addDays(now, 30))
    .sort((a, b) => a.next.getTime() - b.next.getTime());

  // Events in next 90 days
  const upcomingEvents = events
    .filter(e => {
      const d = new Date(e.date);
      return d >= now && d <= addDays(now, 90);
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Payday check
  useEffect(() => {
    if (loading) return;
    const today = format(now, 'yyyy-MM-dd');
    const todayDay = now.getDate();
    if (todayDay === prefs.paydayDay) {
      const snapshots = getPaydaySnapshots();
      const alreadyDone = snapshots.some(s => s.date === today);
      if (!alreadyDone) {
        setPaydayInput(String(Math.round(forecast7)));
        setShowPayday(true);
      }
    }
  }, [loading]);

  function confirmPayday() {
    const today = format(now, 'yyyy-MM-dd');
    const forecastBal = forecast7;
    const actual = +paydayInput;
    addPaydaySnapshot({ id: crypto.randomUUID(), date: today, forecastBalance: forecastBal, actualBalance: actual });
    setShowPayday(false);
    setPaydaySummary({ forecast: forecastBal, actual });
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Home</h1>

      {paydaySummary && (
        <div className="bg-[#EAF3DE] border border-[#3B6D11]/20 rounded-xl p-4 text-sm text-[#3B6D11]">
          <strong>Payday confirmed!</strong> Forecast was {formatCurrency(paydaySummary.forecast)}, you entered {formatCurrency(paydaySummary.actual)}.
          <button className="ml-3 underline text-xs" onClick={() => setPaydaySummary(null)}>Dismiss</button>
        </div>
      )}

      {/* Account tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto p-2 border-b border-gray-100 scrollbar-hide">
          {ACCOUNT_TABS.map(t => (
            <button
              key={t.type}
              onClick={() => setAccountTab(t.type)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                accountTab === t.type ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="px-4 pb-3">
          <AccountTabPanel accounts={accounts} type={accountTab} />
        </div>
        <div className="px-4 py-2 border-t border-gray-50">
          <Link href="/accounts" className="text-xs text-gray-400 hover:text-gray-700">Manage accounts →</Link>
        </div>
      </div>

      {/* Quick summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Balance</p>
          <p className="text-lg font-bold">{formatCurrency(currentBalance)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Credit used</p>
          <p className="text-lg font-bold">{formatCurrency(creditUsed)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Available</p>
          <p className="text-lg font-bold">{formatCurrency(availableCash)}</p>
        </div>
      </div>

      {/* Forecast strip */}
      <div className="grid grid-cols-3 gap-3">
        {[{ label: '7 days', val: forecast7 }, { label: '30 days', val: forecast30 }, { label: '90 days', val: forecast90 }].map(({ label, val }) => {
          const tl = trafficLight(val);
          const bg = { green: 'bg-[#EAF3DE] text-[#3B6D11]', amber: 'bg-[#FAEEDA] text-[#854F0B]', red: 'bg-[#FCEBEB] text-[#A32D2D]' }[tl];
          return (
            <div key={label} className={`rounded-xl p-4 ${bg}`}>
              <p className="text-xs opacity-70 mb-1">{label}</p>
              <p className="text-base font-bold">{formatCurrency(val)}</p>
            </div>
          );
        })}
      </div>

      {/* Next income */}
      {salary && nextPayday && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Next income</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{salary.name}</p>
              <p className="text-xs text-gray-500">{format(nextPayday, 'dd MMM yyyy')} · in {daysToPayday} day{daysToPayday !== 1 ? 's' : ''}</p>
            </div>
            <AmountText amount={salary.amount} className="text-lg" />
          </div>
        </div>
      )}

      {/* Upcoming bills */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Bills — next 30 days</p>
        {upcomingBills.length === 0 ? (
          <p className="text-sm text-gray-400">No bills in the next 30 days</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {upcomingBills.map(b => {
              const days = Math.round((b.next.getTime() - now.getTime()) / 86400000);
              return (
                <div key={b.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-gray-400">{format(b.next, 'dd MMM')} · in {days} day{days !== 1 ? 's' : ''}</p>
                  </div>
                  <AmountText amount={-b.amount} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Life events */}
      {upcomingEvents.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Events — next 90 days</p>
          <div className="divide-y divide-gray-50">
            {upcomingEvents.map(e => {
              const days = Math.round((new Date(e.date).getTime() - now.getTime()) / 86400000);
              return (
                <div key={e.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-gray-400">{e.date} · in {days} day{days !== 1 ? 's' : ''}</p>
                  </div>
                  <AmountText amount={-e.budget} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payday modal */}
      {showPayday && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-2">It&apos;s payday! 🎉</h2>
            <p className="text-sm text-gray-600 mb-4">Confirm your actual account balance to keep the forecast accurate.</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual balance (£)</label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
              type="number"
              value={paydayInput}
              onChange={e => setPaydayInput(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm" onClick={() => setShowPayday(false)}>Skip</button>
              <button className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm" onClick={confirmPayday}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

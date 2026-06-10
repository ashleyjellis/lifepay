'use client';
import { useMemo } from 'react';
import { useAccounts, useBills, useEvents, useIncome, usePreferences } from '@/hooks/useStorage';
import { forecastAtDay, runForecast } from '@/lib/forecast';
import { formatCurrency } from '@/lib/format';
import { CardSkeleton } from '@/components/Skeleton';
import type { TrafficLight } from '@/types';
import { format } from 'date-fns';

const trafficBg: Record<TrafficLight, string> = {
  green: 'bg-[#EAF3DE] text-[#3B6D11]',
  amber: 'bg-[#FAEEDA] text-[#854F0B]',
  red: 'bg-[#FCEBEB] text-[#A32D2D]',
};

function tl(balance: number): TrafficLight {
  if (balance >= 1000) return 'green';
  if (balance >= 250) return 'amber';
  return 'red';
}

export default function ForecastPage() {
  const { accounts, loading: aLoading } = useAccounts();
  const { income, loading: iLoading } = useIncome();
  const { bills, loading: bLoading } = useBills();
  const { events, loading: eLoading } = useEvents();
  const { loading: pLoading } = usePreferences();

  const loading = aLoading || iLoading || bLoading || eLoading || pLoading;

  const forecast = useMemo(() => {
    if (loading) return [];
    return runForecast(accounts, income, bills, events);
  }, [accounts, income, bills, events, loading]);

  const currentBalance = accounts.filter(a => a.type === 'current').reduce((s, a) => s + a.balance, 0);
  const forecast7 = forecastAtDay(forecast, 7) ?? currentBalance;
  const forecast30 = forecastAtDay(forecast, 30) ?? currentBalance;
  const forecast90 = forecastAtDay(forecast, 90) ?? currentBalance;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Forecast</h1>

      <div className="grid grid-cols-3 gap-3">
        {[{ label: '7 days', val: forecast7 }, { label: '30 days', val: forecast30 }, { label: '90 days', val: forecast90 }].map(({ label, val }) => (
          <div key={label} className={`rounded-xl p-4 ${trafficBg[tl(val)]}`}>
            <p className="text-xs opacity-70 mb-1">{label}</p>
            <p className="font-bold text-base">{formatCurrency(val)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-4 py-2 text-xs font-medium text-gray-400 border-b border-gray-100">
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Balance</span>
        </div>
        {forecast.length === 0 ? (
          <p className="text-sm text-gray-400 p-4 text-center">No forecast data. Add income or bills to see projections.</p>
        ) : (
          forecast.map(day => (
            day.items.map((item, idx) => {
              const rowBg = trafficBg[day.trafficLight];
              return (
                <div key={`${day.date}-${idx}`} className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 ${rowBg}`}>
                  <span className="text-xs opacity-60 whitespace-nowrap">{format(new Date(day.date), 'dd MMM')}</span>
                  <span className="truncate">{item.label}</span>
                  <span className={`text-right font-medium ${item.amount >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>{formatCurrency(item.amount)}</span>
                  {idx === day.items.length - 1 ? (
                    <span className="text-right font-bold">{formatCurrency(day.closingBalance)}</span>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })
          ))
        )}
      </div>
    </div>
  );
}

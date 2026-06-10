import type { Account, Bill, ForecastDay, ForecastItem, Income, LifeEvent, TrafficLight } from '@/types';
import { addDays, format, getDate, parseISO } from 'date-fns';

function trafficLight(balance: number): TrafficLight {
  if (balance >= 1000) return 'green';
  if (balance >= 250) return 'amber';
  return 'red';
}

function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function runForecast(
  accounts: Account[],
  income: Income[],
  bills: Bill[],
  events: LifeEvent[],
  startDate: Date = new Date(),
  days = 90
): ForecastDay[] {
  // Starting balance = sum of current account balances (not savings/credit)
  const startBalance = accounts
    .filter(a => a.type === 'current')
    .reduce((s, a) => s + a.balance, 0);

  const result: ForecastDay[] = [];
  let runningBalance = startBalance;

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = isoDate(date);
    const dayOfMonth = getDate(date);
    const items: ForecastItem[] = [];

    // Income: monthly uses paydayDayOfMonth; weekly checks mod 7 from nextDate; one-off on exact date
    for (const inc of income) {
      if (inc.frequency === 'monthly' && inc.paydayDayOfMonth === dayOfMonth) {
        items.push({ label: inc.name, amount: inc.amount, type: 'income' });
      } else if (inc.frequency === 'weekly' && inc.nextDate) {
        const start = parseISO(inc.nextDate);
        const diff = Math.round((date.getTime() - start.getTime()) / 86400000);
        if (diff >= 0 && diff % 7 === 0) {
          items.push({ label: inc.name, amount: inc.amount, type: 'income' });
        }
      } else if (inc.frequency === 'one-off' && inc.nextDate === dateStr) {
        items.push({ label: inc.name, amount: inc.amount, type: 'income' });
      }
    }

    // Bills
    for (const bill of bills) {
      if (bill.dueDayOfMonth === dayOfMonth) {
        items.push({ label: bill.name, amount: -bill.amount, type: 'bill' });
      }
    }

    // Events
    for (const event of events) {
      if (event.date === dateStr) {
        items.push({ label: event.name, amount: -event.budget, type: 'event' });
      }
    }

    if (items.length > 0) {
      const delta = items.reduce((s, it) => s + it.amount, 0);
      runningBalance += delta;
      result.push({
        date: dateStr,
        items,
        closingBalance: runningBalance,
        trafficLight: trafficLight(runningBalance),
      });
    }
  }

  return result;
}

export function forecastAtDay(forecast: ForecastDay[], days: number, startDate: Date = new Date()): number | null {
  const target = isoDate(addDays(startDate, days));
  // find last entry on or before target
  const entries = forecast.filter(d => d.date <= target);
  if (entries.length === 0) return null;
  return entries[entries.length - 1].closingBalance;
}

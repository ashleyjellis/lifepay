'use client';
import { useCallback, useEffect, useState } from 'react';
import * as storage from '@/lib/storage';
import type { Account, Bill, Income, LifeEvent, PaydaySnapshot, Preferences, Transaction } from '@/types';

function useStorageList<T>(
  getter: () => T[],
  setter: (v: T[]) => void
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(getter());
    setLoading(false);
  }, []);

  const save = useCallback((v: T[]) => {
    setter(v);
    setData(v);
  }, []);

  return { data, loading, save };
}

export function useAccounts() {
  const { data, loading, save } = useStorageList(storage.getAccounts, storage.setAccounts);
  const add = (a: Account) => save([...data, a]);
  const update = (id: string, u: Partial<Account>) => save(data.map(x => x.id === id ? { ...x, ...u } : x));
  const remove = (id: string) => save(data.filter(x => x.id !== id));
  return { accounts: data, loading, add, update, remove, setAccounts: save };
}

export function useIncome() {
  const { data, loading, save } = useStorageList(storage.getIncome, storage.setIncome);
  const add = (i: Income) => save([...data, i]);
  const update = (id: string, u: Partial<Income>) => save(data.map(x => x.id === id ? { ...x, ...u } : x));
  const remove = (id: string) => save(data.filter(x => x.id !== id));
  return { income: data, loading, add, update, remove, setIncome: save };
}

export function useBills() {
  const { data, loading, save } = useStorageList(storage.getBills, storage.setBills);
  const add = (b: Bill) => save([...data, b]);
  const update = (id: string, u: Partial<Bill>) => save(data.map(x => x.id === id ? { ...x, ...u } : x));
  const remove = (id: string) => save(data.filter(x => x.id !== id));
  return { bills: data, loading, add, update, remove, setBills: save };
}

export function useEvents() {
  const { data, loading, save } = useStorageList(storage.getEvents, storage.setEvents);
  const add = (e: LifeEvent) => save([...data, e]);
  const update = (id: string, u: Partial<LifeEvent>) => save(data.map(x => x.id === id ? { ...x, ...u } : x));
  const remove = (id: string) => save(data.filter(x => x.id !== id));
  return { events: data, loading, add, update, remove, setEvents: save };
}

export function useTransactions() {
  const { data, loading, save } = useStorageList(storage.getTransactions, storage.setTransactions);
  const add = (t: Transaction) => save([...data, t]);
  const remove = (id: string) => save(data.filter(x => x.id !== id));
  const clearPeriod = (period: string) => {
    const filtered = data.filter(t => t.payPeriod !== period);
    save(filtered);
  };
  return { transactions: data, loading, add, remove, clearPeriod, setTransactions: save };
}

export function usePreferences() {
  const [prefs, setPrefsState] = useState<Preferences>({ lowBalanceThreshold: 250, paydayDay: 28 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPrefsState(storage.getPreferences());
    setLoading(false);
  }, []);

  const setPrefs = (p: Preferences) => {
    storage.setPreferences(p);
    setPrefsState(p);
  };

  return { prefs, loading, setPrefs };
}

export function usePaydaySnapshots() {
  const { data, loading, save } = useStorageList(storage.getPaydaySnapshots, (v: PaydaySnapshot[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lifecash_payday_snapshots', JSON.stringify(v));
    }
  });
  const add = (s: PaydaySnapshot) => save([...data, s]);
  return { snapshots: data, loading, add };
}

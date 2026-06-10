import type { Account, Bill, Income, LifeEvent, PaydaySnapshot, Preferences, Transaction } from '@/types';

const KEYS = {
  accounts: 'lifecash_accounts',
  income: 'lifecash_income',
  bills: 'lifecash_bills',
  events: 'lifecash_events',
  transactions: 'lifecash_transactions',
  preferences: 'lifecash_preferences',
  paydaySnapshots: 'lifecash_payday_snapshots',
  onboardingComplete: 'lifecash_onboarding_complete',
} as const;

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function getSingle<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function setSingle<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function remove(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// Accounts
export const getAccounts = () => get<Account>(KEYS.accounts);
export const setAccounts = (v: Account[]) => set(KEYS.accounts, v);
export const addAccount = (a: Account) => set(KEYS.accounts, [...getAccounts(), a]);
export const updateAccount = (id: string, updates: Partial<Account>) =>
  set(KEYS.accounts, getAccounts().map(a => (a.id === id ? { ...a, ...updates } : a)));
export const deleteAccount = (id: string) =>
  set(KEYS.accounts, getAccounts().filter(a => a.id !== id));

// Income
export const getIncome = () => get<Income>(KEYS.income);
export const setIncome = (v: Income[]) => set(KEYS.income, v);
export const addIncome = (i: Income) => set(KEYS.income, [...getIncome(), i]);
export const updateIncome = (id: string, updates: Partial<Income>) =>
  set(KEYS.income, getIncome().map(i => (i.id === id ? { ...i, ...updates } : i)));
export const deleteIncome = (id: string) =>
  set(KEYS.income, getIncome().filter(i => i.id !== id));

// Bills
export const getBills = () => get<Bill>(KEYS.bills);
export const setBills = (v: Bill[]) => set(KEYS.bills, v);
export const addBill = (b: Bill) => set(KEYS.bills, [...getBills(), b]);
export const updateBill = (id: string, updates: Partial<Bill>) =>
  set(KEYS.bills, getBills().map(b => (b.id === id ? { ...b, ...updates } : b)));
export const deleteBill = (id: string) =>
  set(KEYS.bills, getBills().filter(b => b.id !== id));

// Events
export const getEvents = () => get<LifeEvent>(KEYS.events);
export const setEvents = (v: LifeEvent[]) => set(KEYS.events, v);
export const addEvent = (e: LifeEvent) => set(KEYS.events, [...getEvents(), e]);
export const updateEvent = (id: string, updates: Partial<LifeEvent>) =>
  set(KEYS.events, getEvents().map(e => (e.id === id ? { ...e, ...updates } : e)));
export const deleteEvent = (id: string) =>
  set(KEYS.events, getEvents().filter(e => e.id !== id));

// Transactions
export const getTransactions = () => get<Transaction>(KEYS.transactions);
export const setTransactions = (v: Transaction[]) => set(KEYS.transactions, v);
export const addTransaction = (t: Transaction) =>
  set(KEYS.transactions, [...getTransactions(), t]);
export const deleteTransaction = (id: string) =>
  set(KEYS.transactions, getTransactions().filter(t => t.id !== id));
export const clearTransactionsForPeriod = (payPeriod: string) =>
  set(KEYS.transactions, getTransactions().filter(t => t.payPeriod !== payPeriod));

// Preferences
export const getPreferences = (): Preferences =>
  getSingle<Preferences>(KEYS.preferences) ?? { lowBalanceThreshold: 250, paydayDay: 28 };
export const setPreferences = (p: Preferences) => setSingle(KEYS.preferences, p);

// Payday snapshots
export const getPaydaySnapshots = () => get<PaydaySnapshot>(KEYS.paydaySnapshots);
export const addPaydaySnapshot = (s: PaydaySnapshot) =>
  set(KEYS.paydaySnapshots, [...getPaydaySnapshots(), s]);

// Onboarding
export const isOnboardingComplete = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEYS.onboardingComplete) === 'true';
};
export const setOnboardingComplete = () =>
  localStorage.setItem(KEYS.onboardingComplete, 'true');
export const resetAll = () => {
  Object.values(KEYS).forEach(remove);
};

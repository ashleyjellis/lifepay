export interface Account {
  id: string;
  name: string;
  type: 'current' | 'savings' | 'investment' | 'credit' | 'loan' | 'mortgage';
  balance: number;
  provider?: string;
  accountNumber?: string;
  interestRate?: number; // % APR / AER
  // Credit card
  creditLimit?: number;
  dealEndDate?: string; // ISO date — end of promotional rate
  dealDescription?: string; // e.g. "0% purchases"
  // Loan / Mortgage
  originalAmount?: number;
  termMonths?: number; // months remaining
  monthlyPayment?: number;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'one-off';
  paydayDayOfMonth?: number; // for monthly
  nextDate?: string; // ISO date string
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDayOfMonth: number;
}

export type EventCategory = 'birthday' | 'holiday' | 'expense';

export interface LifeEvent {
  id: string;
  name: string;
  date: string; // ISO date string
  budget: number;
  category: EventCategory;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: 'groceries' | 'eating-out' | 'transport' | 'entertainment' | 'clothing' | 'health' | 'household' | 'other';
  notes?: string;
  payPeriod: string; // e.g. "2025-01" to scope to pay period
}

export interface Preferences {
  lowBalanceThreshold: number;
  paydayDay: number;
}

export interface PaydaySnapshot {
  id: string;
  date: string; // ISO date string
  forecastBalance: number;
  actualBalance: number;
}

export type TrafficLight = 'green' | 'amber' | 'red';

export interface ForecastItem {
  label: string;
  amount: number;
  type: 'income' | 'bill' | 'event';
}

export interface ForecastDay {
  date: string;
  items: ForecastItem[];
  closingBalance: number;
  trafficLight: TrafficLight;
}

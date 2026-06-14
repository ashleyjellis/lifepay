'use client';
import { useAccounts, useBills, useIncome } from '@/hooks/useStorage';
import { formatCurrency } from '@/lib/format';
import { CardSkeleton } from '@/components/Skeleton';

export default function SummaryPage() {
  const { accounts, loading: aLoading } = useAccounts();
  const { bills, loading: bLoading } = useBills();
  const { income, loading: iLoading } = useIncome();

  const loading = aLoading || bLoading || iLoading;

  const current = accounts.filter(a => a.type === 'current').reduce((s, a) => s + a.balance, 0);
  const savings = accounts.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0);
  const investments = accounts.filter(a => a.type === 'investment').reduce((s, a) => s + a.balance, 0);
  const creditDebt = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0);
  const loanDebt = accounts.filter(a => a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0);
  const mortgageDebt = accounts.filter(a => a.type === 'mortgage').reduce((s, a) => s + Math.abs(a.balance), 0);

  const totalAssets = current + savings + investments;
  const totalDebt = creditDebt + loanDebt + mortgageDebt;
  const netWorth = totalAssets - totalDebt;

  const totalIncome = income.reduce((s, i) => {
    if (i.frequency === 'monthly') return s + i.amount;
    if (i.frequency === 'weekly') return s + i.amount * 52 / 12;
    return s;
  }, 0);
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const monthlySurplus = totalIncome - totalBills;

  if (loading) return <div className="p-4 md:p-6"><CardSkeleton /></div>;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Summary</h1>

      {/* Net worth hero */}
      <div className={`rounded-xl p-5 ${netWorth >= 0 ? 'bg-[#EAF3DE]' : 'bg-[#FCEBEB]'}`}>
        <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${netWorth >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>Net worth</p>
        <p className={`text-3xl font-bold ${netWorth >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>{formatCurrency(netWorth)}</p>
      </div>

      {/* Assets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Assets</p>
        </div>
        <Row label="Current accounts" value={current} />
        <Row label="Savings" value={savings} />
        <Row label="Investments" value={investments} />
        <div className="px-4 py-3 bg-gray-50 flex justify-between">
          <p className="text-sm font-semibold">Total assets</p>
          <p className="text-sm font-bold">{formatCurrency(totalAssets)}</p>
        </div>
      </div>

      {/* Debts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Debts</p>
        </div>
        <Row label="Credit cards" value={-creditDebt} />
        <Row label="Loans" value={-loanDebt} />
        <Row label="Mortgage" value={-mortgageDebt} />
        <div className="px-4 py-3 bg-gray-50 flex justify-between">
          <p className="text-sm font-semibold">Total debt</p>
          <p className="text-sm font-bold text-[#A32D2D]">{formatCurrency(totalDebt)}</p>
        </div>
      </div>

      {/* Monthly cash flow */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Monthly cash flow</p>
        </div>
        <Row label="Income" value={totalIncome} />
        <Row label="Bills & commitments" value={-totalBills} />
        <div className={`px-4 py-3 flex justify-between ${monthlySurplus >= 0 ? 'bg-[#EAF3DE]' : 'bg-[#FCEBEB]'}`}>
          <p className="text-sm font-semibold">Surplus</p>
          <p className={`text-sm font-bold ${monthlySurplus >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>{formatCurrency(monthlySurplus)}</p>
        </div>
      </div>

      {/* Individual accounts */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">All accounts</p>
          </div>
          {accounts.map(a => {
            const isDebt = a.type === 'credit' || a.type === 'loan' || a.type === 'mortgage';
            return (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{a.type}{a.provider ? ` · ${a.provider}` : ''}</p>
                </div>
                <p className={`text-sm font-semibold ${isDebt ? 'text-[#A32D2D]' : 'text-gray-900'}`}>
                  {isDebt ? '-' : ''}{formatCurrency(Math.abs(a.balance))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  const isNeg = value < 0;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
      <p className="text-sm text-gray-700">{label}</p>
      <p className={`text-sm font-medium ${isNeg ? 'text-[#A32D2D]' : value === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

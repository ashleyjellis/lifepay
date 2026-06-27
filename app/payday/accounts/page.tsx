'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'], weight: ['500', '600', '700'] });

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currencyDenominatedBalance: { unscaledValue: number; scale: number; currencyCode: string } | null;
  accountNumber: string;
  closed: boolean;
}

interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currencyDenominatedAmount: { unscaledValue: number; scale: number; currencyCode: string } | null;
  date: number;
  description: string;
  originalDescription: string;
  status: string;
  type: string;
  pending?: boolean;
}

function tinkAmount(tx: Transaction): number {
  if (tx.currencyDenominatedAmount) {
    const { unscaledValue, scale } = tx.currencyDenominatedAmount;
    return unscaledValue / Math.pow(10, scale);
  }
  return tx.amount / 100;
}

function accountBalance(acc: Account): { amount: number; currency: string } {
  if (acc.currencyDenominatedBalance) {
    const { unscaledValue, scale, currencyCode } = acc.currencyDenominatedBalance;
    return { amount: unscaledValue / Math.pow(10, scale), currency: currencyCode };
  }
  return { amount: acc.balance / 100, currency: 'GBP' };
}

const fmt = (v: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(v);

const TYPE_LABEL: Record<string, string> = {
  CHECKING: 'Current',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  LOAN: 'Loan',
  PENSION: 'Pension',
  MORTGAGE: 'Mortgage',
  OTHER: 'Other',
};

const TYPE_EMOJI: Record<string, string> = {
  WITHDRAWAL: '💸', TRANSFER: '↔️', PAYMENT: '💳', DEPOSIT: '💰',
  CREDIT_CARD: '🏦', OTHER: '📋',
};

export default function AccountsPage() {
  const router = useRouter();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError('Bank connection was cancelled or failed. Please try again.');

    fetch('/api/payday/tink/accounts')
      .then(r => { if (r.status === 401) { router.replace('/payday/login'); return null; } return r.ok ? r.json() : null; })
      .then(data => {
        if (!data) return;
        setConnected(data.connected);
        const active = (data.accounts ?? []).filter((a: Account) => !a.closed);
        setAccounts(active);
        if (active.length > 0) setSelectedAccount(active[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setTxLoading(true);
    setTransactions([]);
    fetch(`/api/payday/tink/transactions?accountId=${selectedAccount}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.transactions) setTransactions(data.transactions); })
      .finally(() => setTxLoading(false));
  }, [selectedAccount]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/payday/tink/connect');
      const data = await res.json();
      if (data.linkUrl) window.location.href = data.linkUrl;
    } catch {
      setError('Could not start connection. Please try again.');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect your bank? You can reconnect at any time.')) return;
    setDisconnecting(true);
    await fetch('/api/payday/tink/disconnect', { method: 'DELETE' });
    setConnected(false);
    setAccounts([]);
    setSelectedAccount(null);
    setTransactions([]);
    setDisconnecting(false);
  }

  const selected = accounts.find(a => a.id === selectedAccount);

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#f7faf8] px-4 py-8 max-w-2xl mx-auto`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#181c1c]">Accounts</h1>
          <p className="text-sm text-[#717970] mt-0.5">Connected bank accounts</p>
        </div>
        {connected && (
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="text-xs text-[#ba1a1a] border border-[#ba1a1a]/30 rounded-xl px-3 py-1.5 hover:bg-[#ba1a1a]/5 transition-colors font-semibold disabled:opacity-50">
            {disconnecting ? 'Disconnecting…' : 'Disconnect bank'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-[#fff0f0] border border-[#ba1a1a]/20 rounded-xl px-4 py-3 mb-4 text-sm text-[#ba1a1a] font-medium">
          {error}
        </div>
      )}

      {/* ── Not connected ── */}
      {connected === false && (
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_16px_rgba(57,105,64,0.07)] text-center">
          <div className="text-5xl mb-4">🏦</div>
          <h2 className="text-lg font-bold text-[#181c1c] mb-2">Connect your bank</h2>
          <p className="text-sm text-[#717970] mb-6 max-w-sm mx-auto">
            Securely link your bank account to see live balances and transactions. We use Tink&apos;s
            Open Banking connection — your credentials are never shared with us.
          </p>
          <button onClick={handleConnect} disabled={connecting}
            className="bg-[#396940] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#2d5534] transition-colors disabled:opacity-50">
            {connecting ? 'Connecting…' : 'Connect bank account'}
          </button>
          <p className="text-xs text-[#9aaa98] mt-4">
            Powered by Tink · Read-only access · Disconnect any time
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {connected === null && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] animate-pulse h-24" />
          ))}
        </div>
      )}

      {/* ── Connected ── */}
      {connected && accounts.length > 0 && (
        <>
          <div className="space-y-3 mb-6">
            {accounts.map(a => {
              const bal = accountBalance(a);
              return (
                <button key={a.id} onClick={() => setSelectedAccount(a.id)}
                  className={`w-full text-left bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] transition-all border-2 ${
                    selectedAccount === a.id ? 'border-[#7bae7f]' : 'border-transparent'
                  }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#181c1c] text-sm">{a.name}</span>
                        <span className="text-xs text-[#717970] bg-[#f1f4f2] px-2 py-0.5 rounded-full">
                          {TYPE_LABEL[a.type] ?? a.type}
                        </span>
                      </div>
                      {a.accountNumber && (
                        <div className="text-xs text-[#9aaa98] font-medium">{a.accountNumber}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-lg text-[#181c1c]">{fmt(bal.amount, bal.currency)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Transactions ── */}
          {selected && (
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-[#181c1c]">Recent transactions</div>
                  <div className="text-xs text-[#717970] mt-0.5">{selected.name}</div>
                </div>
                {transactions.length > 0 && (
                  <span className="text-xs text-[#717970] bg-[#f1f4f2] px-2 py-1 rounded-full font-semibold">
                    {transactions.length}
                  </span>
                )}
              </div>

              {txLoading && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex justify-between items-center py-2 animate-pulse">
                      <div className="flex gap-3 items-center">
                        <div className="w-8 h-8 rounded-full bg-[#f1f4f2]" />
                        <div>
                          <div className="h-3 bg-[#f1f4f2] rounded w-32 mb-1.5" />
                          <div className="h-2.5 bg-[#f1f4f2] rounded w-20" />
                        </div>
                      </div>
                      <div className="h-3 bg-[#f1f4f2] rounded w-16" />
                    </div>
                  ))}
                </div>
              )}

              {!txLoading && transactions.length === 0 && (
                <div className="text-center py-8 text-[#9aaa98] text-sm">No transactions found.</div>
              )}

              {!txLoading && transactions.length > 0 && (
                <div className="divide-y divide-[#f0f2f0]">
                  {[...transactions]
                    .sort((a, b) => b.date - a.date)
                    .map(tx => {
                      const amt = tinkAmount(tx);
                      const isCredit = amt > 0;
                      const date = new Date(tx.date);
                      const label = tx.description || tx.originalDescription;
                      const emoji = TYPE_EMOJI[tx.type] ?? '📋';
                      const currency = tx.currencyDenominatedAmount?.currencyCode ?? 'GBP';
                      return (
                        <div key={tx.id} className="flex items-center justify-between py-3 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#f1f4f2] flex items-center justify-center text-base shrink-0">
                              {emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#181c1c] truncate">{label}</div>
                              <div className="text-xs text-[#9aaa98]">
                                {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {tx.pending && <span className="ml-1 text-[#f4a261]">· Pending</span>}
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-bold shrink-0 ${isCredit ? 'text-[#396940]' : 'text-[#181c1c]'}`}>
                            {isCredit ? '+' : ''}{fmt(amt, currency)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {connected && accounts.length === 0 && (
        <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_16px_rgba(57,105,64,0.07)] text-center">
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-sm text-[#717970] mb-4">No accounts found. Your bank may still be syncing.</p>
          <button onClick={() => window.location.reload()}
            className="text-sm text-[#396940] font-semibold hover:underline">Refresh</button>
        </div>
      )}
    </main>
  );
}

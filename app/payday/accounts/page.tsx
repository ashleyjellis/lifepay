'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'], weight: ['500', '600', '700'] });

interface AccountNumber {
  iban?: string;
  number?: string;
  sort_code?: string;
}
interface Balance {
  available: number;
  current: number;
  currency: string;
  update_timestamp: string;
}
interface Account {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number: AccountNumber;
  provider: { display_name: string; logo_uri?: string };
  balance?: Balance | null;
}
interface Transaction {
  transaction_id: string;
  timestamp: string;
  description: string;
  merchant_name?: string;
  transaction_type: string;
  transaction_category: string;
  amount: number;
  currency: string;
}

const fmt = (v: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(v);

const CATEGORY_EMOJI: Record<string, string> = {
  PURCHASE: '🛍️', TRANSFER: '↔️', DIRECT_DEBIT: '📋', STANDING_ORDER: '📆',
  CREDIT: '💳', ATM: '🏧', FEE: '💸', INTEREST: '📈', CASH: '💵',
};

function sortCode(raw?: string) {
  if (!raw) return null;
  return raw.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
}

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
    // Check for error from callback redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError('Bank connection was denied or failed. Please try again.');

    fetch('/api/payday/truelayer/accounts')
      .then(r => { if (r.status === 401) router.replace('/payday/login'); return r.ok ? r.json() : null; })
      .then(data => {
        if (!data) return;
        setConnected(data.connected);
        setAccounts(data.accounts ?? []);
        if (data.accounts?.length > 0) setSelectedAccount(data.accounts[0].account_id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setTxLoading(true);
    setTransactions([]);
    fetch(`/api/payday/truelayer/transactions?accountId=${selectedAccount}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.transactions) setTransactions(data.transactions); })
      .finally(() => setTxLoading(false));
  }, [selectedAccount]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/payday/truelayer/connect');
      const data = await res.json();
      if (data.authUrl) window.location.href = data.authUrl;
    } catch {
      setError('Could not start connection. Please try again.');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect your bank? You can reconnect at any time.')) return;
    setDisconnecting(true);
    await fetch('/api/payday/truelayer/disconnect', { method: 'DELETE' });
    setConnected(false);
    setAccounts([]);
    setSelectedAccount(null);
    setTransactions([]);
    setDisconnecting(false);
  }

  const selected = accounts.find(a => a.account_id === selectedAccount);

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
            Securely link your bank account to see live balances and transactions. We use TrueLayer&apos;s
            Open Banking connection — your credentials are never shared with us.
          </p>
          <button onClick={handleConnect} disabled={connecting}
            className="bg-[#396940] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#2d5534] transition-colors disabled:opacity-50">
            {connecting ? 'Connecting…' : 'Connect bank account'}
          </button>
          <p className="text-xs text-[#9aaa98] mt-4">
            Powered by TrueLayer · Read-only access · Disconnect any time
          </p>
        </div>
      )}

      {/* ── Loading state ── */}
      {connected === null && (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] animate-pulse h-24" />
          ))}
        </div>
      )}

      {/* ── Connected: account list ── */}
      {connected && accounts.length > 0 && (
        <>
          <div className="space-y-3 mb-6">
            {accounts.map(a => (
              <button key={a.account_id} onClick={() => setSelectedAccount(a.account_id)}
                className={`w-full text-left bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] transition-all border-2 ${
                  selectedAccount === a.account_id ? 'border-[#7bae7f]' : 'border-transparent'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#181c1c] text-sm">{a.display_name}</span>
                      <span className="text-xs text-[#717970] bg-[#f1f4f2] px-2 py-0.5 rounded-full capitalize">
                        {a.account_type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <div className="text-xs text-[#9aaa98] font-medium">{a.provider.display_name}</div>
                    {a.account_number.sort_code && (
                      <div className="text-xs text-[#717970] mt-1">
                        {sortCode(a.account_number.sort_code)} · {a.account_number.number}
                      </div>
                    )}
                    {a.account_number.iban && !a.account_number.sort_code && (
                      <div className="text-xs text-[#717970] mt-1 font-mono">{a.account_number.iban}</div>
                    )}
                  </div>
                  {a.balance && (
                    <div className="text-right shrink-0">
                      <div className="font-bold text-lg text-[#181c1c]">
                        {fmt(a.balance.current, a.balance.currency)}
                      </div>
                      {a.balance.available !== a.balance.current && (
                        <div className="text-xs text-[#717970]">
                          {fmt(a.balance.available, a.balance.currency)} available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* ── Transactions ── */}
          {selected && (
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-[#181c1c]">Recent transactions</div>
                  <div className="text-xs text-[#717970] mt-0.5">{selected.display_name} · last 30 days</div>
                </div>
                {transactions.length > 0 && (
                  <span className="text-xs text-[#717970] bg-[#f1f4f2] px-2 py-1 rounded-full font-semibold">
                    {transactions.length} transactions
                  </span>
                )}
              </div>

              {txLoading && (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => (
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
                <div className="text-center py-8 text-[#9aaa98] text-sm">No transactions found for this period.</div>
              )}

              {!txLoading && transactions.length > 0 && (
                <div className="divide-y divide-[#f0f2f0]">
                  {transactions
                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                    .map(tx => {
                      const isCredit = tx.amount > 0;
                      const date = new Date(tx.timestamp);
                      const label = tx.merchant_name || tx.description;
                      const emoji = CATEGORY_EMOJI[tx.transaction_category] ?? '💳';
                      return (
                        <div key={tx.transaction_id} className="flex items-center justify-between py-3 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#f1f4f2] flex items-center justify-center text-base shrink-0">
                              {emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#181c1c] truncate">{label}</div>
                              <div className="text-xs text-[#9aaa98]">
                                {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {' · '}
                                <span className="capitalize">{tx.transaction_category.replace(/_/g, ' ').toLowerCase()}</span>
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-bold shrink-0 ${isCredit ? 'text-[#396940]' : 'text-[#181c1c]'}`}>
                            {isCredit ? '+' : ''}{fmt(tx.amount, tx.currency)}
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
    </main>
  );
}

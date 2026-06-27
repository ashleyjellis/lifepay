// Server-only — never import from client components

const isSandbox = process.env.TRUELAYER_ENV !== 'production';
const AUTH_BASE = isSandbox
  ? 'https://auth.truelayer-sandbox.com'
  : 'https://auth.truelayer.com';
const API_BASE = isSandbox
  ? 'https://api.truelayer-sandbox.com'
  : 'https://api.truelayer.com';

const CLIENT_ID = process.env.TRUELAYER_CLIENT_ID!;
const CLIENT_SECRET = process.env.TRUELAYER_CLIENT_SECRET!;
const REDIRECT_URI = process.env.TRUELAYER_REDIRECT_URI!;

const SCOPES = 'accounts balance transactions offline_access';

export interface TLAccount {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number: { iban?: string; number?: string; sort_code?: string; swift_bic?: string };
  provider: { display_name: string; logo_uri?: string; provider_id: string };
}

export interface TLBalance {
  currency: string;
  available: number;
  current: number;
  overdraft?: number;
  update_timestamp: string;
}

export interface TLTransaction {
  transaction_id: string;
  timestamp: string;
  description: string;
  transaction_type: string;
  transaction_category: string;
  amount: number;
  currency: string;
  merchant_name?: string;
  running_balance?: { amount: number; currency: string };
}

export interface TLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    providers: 'uk-ob-all uk-oauth-all',
  });
  return `${AUTH_BASE}/?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<TLTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TrueLayer token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TLTokenResponse> {
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TrueLayer token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchAccounts(accessToken: string): Promise<TLAccount[]> {
  const res = await fetch(`${API_BASE}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`fetchAccounts failed: ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

export async function fetchBalance(accessToken: string, accountId: string): Promise<TLBalance | null> {
  const res = await fetch(`${API_BASE}/data/v1/accounts/${accountId}/balance`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

export async function fetchTransactions(
  accessToken: string,
  accountId: string,
  from: string,
  to: string
): Promise<TLTransaction[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(
    `${API_BASE}/data/v1/accounts/${accountId}/transactions?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`fetchTransactions failed: ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

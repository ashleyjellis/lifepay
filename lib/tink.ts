// Server-only — never import from client components

const API_BASE = 'https://api.tink.com/api/v1';
const LINK_BASE = 'https://link.tink.com/1.0';

const CLIENT_ID = process.env.TINK_CLIENT_ID!;
const CLIENT_SECRET = process.env.TINK_CLIENT_SECRET!;
const REDIRECT_URI = process.env.TINK_REDIRECT_URI!;

// App-level token (client_credentials) — cached in memory per server instance
let _appToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (_appToken && _appToken.expiresAt > Date.now() + 60_000) return _appToken.token;
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'authorization:grant user:create',
    }),
  });
  if (!res.ok) throw new Error(`Tink app token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  _appToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function createTinkUser(externalUserId: string): Promise<string> {
  const token = await getAppToken();
  const res = await fetch(`${API_BASE}/user/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_user_id: externalUserId, market: 'GB', locale: 'en_GB' }),
  });
  const body = await res.json();
  console.log('[Tink createUser] status:', res.status, 'body:', JSON.stringify(body));
  if (!res.ok) throw new Error(`Tink createUser failed: ${res.status} ${JSON.stringify(body)}`);
  return body.user_id;
}

async function getAuthCode(tinkUserId: string): Promise<string> {
  const token = await getAppToken();
  const res = await fetch(`${API_BASE}/oauth/authorization-grant/delegate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      user_id: tinkUserId,
      id_hint: tinkUserId,
      actor_client_id: CLIENT_ID,
      scope: 'accounts:read balances:read transactions:read credentials:read credentials:write credentials:refresh providers:read provider-consents:read',
    }),
  });
  if (!res.ok) throw new Error(`Tink getAuthCode failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.code;
}

export async function buildLinkUrl(tinkUserId: string): Promise<string> {
  const code = await getAuthCode(tinkUserId);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    authorization_code: code,
    market: 'GB',
    locale: 'en_GB',
  });
  return `${LINK_BASE}/credentials/add?${params}`;
}

export interface TinkTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCode(code: string): Promise<TinkTokenResponse> {
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  });
  if (!res.ok) throw new Error(`Tink code exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshUserToken(refreshToken: string): Promise<TinkTokenResponse> {
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Tink token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface TinkAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currencyDenominatedBalance: { unscaledValue: number; scale: number; currencyCode: string } | null;
  accountNumber: string;
  financialInstitutionId: string;
  closed: boolean;
}

export interface TinkTransaction {
  id: string;
  accountId: string;
  amount: number;
  currencyDenominatedAmount: { unscaledValue: number; scale: number; currencyCode: string } | null;
  currencyDenominatedOriginalAmount: { unscaledValue: number; scale: number; currencyCode: string } | null;
  date: number; // epoch ms
  description: string;
  originalDate: number;
  originalDescription: string;
  status: string;
  type: string;
  categoryId?: string;
  merchantId?: string;
  pending?: boolean;
}

export async function fetchAccounts(accessToken: string): Promise<TinkAccount[]> {
  const res = await fetch(`${API_BASE}/accounts/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Tink fetchAccounts failed: ${res.status}`);
  const data = await res.json();
  return data.accounts ?? [];
}

export async function fetchTransactions(
  accessToken: string,
  accountId: string,
  pageSize = 100
): Promise<TinkTransaction[]> {
  const params = new URLSearchParams({
    accountIdIn: accountId,
    pageSize: String(pageSize),
    status: 'BOOKED',
  });
  const res = await fetch(`${API_BASE}/transactions?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Tink fetchTransactions failed: ${res.status}`);
  const data = await res.json();
  return data.transactions ?? [];
}

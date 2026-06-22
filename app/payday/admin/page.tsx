'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'] });

interface Household {
  id: string; name: string; mode: string;
  session_count: number; pot_count: number;
}

interface User {
  id: string; email: string; created_at: string;
  is_admin: number; active_sessions: number;
  household_count: number; households: Household[];
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ConfirmDeleteModal({
  user, onConfirm, onCancel,
}: { user: User; onConfirm: () => void; onCancel: () => void }) {
  const [typed, setTyped] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-7 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl">⚠</div>
          <h2 className="text-lg font-bold text-[#1a2b1a]">Delete user & all data</h2>
        </div>
        <p className="text-sm text-[#414940] mb-2">
          This will permanently delete <span className="font-semibold text-[#1a2b1a]">{user.email}</span> and all associated data:
        </p>
        <ul className="text-sm text-[#717970] mb-4 space-y-0.5 list-disc list-inside">
          <li>{user.household_count} household{user.household_count !== 1 ? 's' : ''}</li>
          {user.households.map(h => (
            <li key={h.id} className="ml-4 list-none text-xs">
              — {h.name}: {h.session_count} paydays, {h.pot_count} pots
            </li>
          ))}
          <li>All payday sessions, savings, growth snapshots, forecasts</li>
          <li>All auth sessions (user will be signed out everywhere)</li>
        </ul>
        <p className="text-sm text-[#414940] mb-3">Type <span className="font-mono font-bold">DELETE</span> to confirm:</p>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="DELETE"
          className="w-full bg-[#f0f0eb] border-0 rounded-2xl px-4 py-3 text-sm font-medium text-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-red-400 mb-5"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border-2 border-[#c1c9be] text-[#414940] py-3 rounded-full font-semibold hover:border-[#396940] transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={typed !== 'DELETE'}
            className="flex-1 bg-red-600 text-white py-3 rounded-full font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/payday/admin');
    if (res.status === 403) {
      router.push('/payday');
      return;
    }
    if (res.status === 401) {
      router.push('/payday/login');
      return;
    }
    if (!res.ok) { setError('Failed to load users'); setLoading(false); return; }
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(user: User) {
    setDeleting(user.id);
    setDeleteTarget(null);
    const res = await fetch(`/api/payday/admin?userId=${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } else {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
    }
    setDeleting(null);
  }

  async function handleToggleAdmin(user: User) {
    setTogglingAdmin(user.id);
    const res = await fetch('/api/payday/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, isAdmin: !user.is_admin }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: user.is_admin ? 0 : 1 } : u));
    }
    setTogglingAdmin(null);
  }

  const totalUsers = users.length;
  const totalHouseholds = users.reduce((s, u) => s + u.household_count, 0);
  const activeSessions = users.reduce((s, u) => s + Number(u.active_sessions), 0);

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      {deleteTarget && (
        <ConfirmDeleteModal
          user={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
            <span className="text-xs bg-[#396940] text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">ADMIN</span>
          </div>
          <div className="flex gap-5 items-center">
            <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">← Back to App</Link>
            <button
              onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors"
            >Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 pt-8 pb-24">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1a2b1a]">User Management</h1>
          <p className="text-sm text-[#717970] mt-0.5">Monitor and manage all Payd accounts</p>
        </div>

        {/* Summary stats */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Users', value: totalUsers, icon: '👤' },
              { label: 'Households', value: totalHouseholds, icon: '🏠' },
              { label: 'Active Sessions', value: activeSessions, icon: '🔐' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#e6e9e7] px-5 py-4">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-2xl font-bold text-[#1a2b1a]">{s.value}</p>
                <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-[#e6e9e7] p-12 text-center">
            <p className="text-[#717970]">Loading users…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e6e9e7] p-12 text-center">
            <p className="text-[#717970]">No users found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e6e9e7] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e6e9e7] bg-[#f7faf8]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">User</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Joined</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Households</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Sessions</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Role</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#717970] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <>
                    <tr
                      key={user.id}
                      className={`border-b border-[#f0f2f0] hover:bg-[#f7faf8] transition-colors ${deleting === user.id ? 'opacity-40' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                          className="text-left"
                        >
                          <p className="text-sm font-semibold text-[#1a2b1a] flex items-center gap-2">
                            {user.email}
                            {user.is_admin === 1 && (
                              <span className="text-xs bg-[#396940] text-white px-1.5 py-0.5 rounded-full font-semibold">Admin</span>
                            )}
                          </p>
                          <p className="text-xs text-[#717970] mt-0.5 font-mono">{user.id.slice(0, 8)}…</p>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-center text-[#717970]">{fmt(user.created_at)}</td>
                      <td className="py-3.5 px-4 text-sm text-center font-semibold text-[#1a2b1a]">{user.household_count}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${Number(user.active_sessions) > 0 ? 'bg-[#d1f0d4] text-[#1a5c20]' : 'bg-[#f0f0eb] text-[#717970]'}`}>
                          {user.active_sessions} active
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          disabled={togglingAdmin === user.id}
                          title={user.is_admin ? 'Remove admin' : 'Make admin'}
                          className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors disabled:opacity-50 ${user.is_admin ? 'bg-[#396940] text-white hover:bg-[#2d5533]' : 'bg-[#f0f0eb] text-[#414940] hover:bg-[#e0e5e0]'}`}
                        >
                          {togglingAdmin === user.id ? '…' : user.is_admin ? 'Admin' : 'User'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setDeleteTarget(user)}
                          disabled={deleting === user.id}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {deleting === user.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                    {expandedUser === user.id && user.households.length > 0 && (
                      <tr key={user.id + '-expand'} className="border-b border-[#f0f2f0] bg-[#f7faf8]">
                        <td colSpan={6} className="px-4 py-3">
                          <p className="text-xs font-semibold text-[#717970] uppercase tracking-wide mb-2">Households</p>
                          <div className="flex flex-wrap gap-2">
                            {user.households.map((h: Household) => (
                              <div key={h.id} className="bg-white border border-[#e6e9e7] rounded-xl px-3 py-2 text-xs">
                                <p className="font-semibold text-[#1a2b1a]">{h.name}</p>
                                <p className="text-[#717970]">{h.mode} · {h.session_count} paydays · {h.pot_count} pots</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-[#717970] mt-6 text-center">
          To grant yourself admin access, run: <code className="font-mono bg-[#f0f0eb] px-2 py-0.5 rounded">UPDATE users SET is_admin=1 WHERE email=&apos;your@email.com&apos;;</code> in your Turso console.
        </p>
      </div>
    </div>
  );
}

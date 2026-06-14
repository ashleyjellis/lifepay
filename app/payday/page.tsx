'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PaydayHome() {
  const router = useRouter();
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    async function check() {
      try {
        const initRes = await fetch('/api/payday/init', { method: 'POST' });
        if (!initRes.ok) {
          const data = await initRes.json();
          setDbError(data.error ?? 'Database error');
          return;
        }
        // Middleware already ensures user is logged in if they reach here.
        // Just check if they have a household.
        const hRes = await fetch('/api/payday/households');
        if (hRes.status === 401) { router.replace('/payday/login'); return; }
        const household = hRes.ok ? await hRes.json() : null;
        router.replace(household ? '/payday/session' : '/payday/setup');
      } catch {
        setDbError('Could not connect to database. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      }
    }
    check();
  }, [router]);

  if (dbError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm border border-red-100">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2 text-red-700">Database not configured</h1>
          <p className="text-gray-600 text-sm mb-4">{dbError}</p>
          <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 space-y-1">
            <div>TURSO_DATABASE_URL=libsql://...</div>
            <div>TURSO_AUTH_TOKEN=eyJ...</div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Add these to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file and restart the server.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-gray-500 hover:text-gray-700">← Back to LifeCash</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );
}

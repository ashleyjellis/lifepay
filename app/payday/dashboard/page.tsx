'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function go() {
      const hRes = await fetch('/api/payday/households');
      if (!hRes.ok) { router.push('/payday/session'); return; }
      const hh = await hRes.json();
      if (!hh) { router.push('/payday/setup'); return; }

      const sRes = await fetch(`/api/payday/sessions?householdId=${hh.id}`);
      const sessions = sRes.ok ? await sRes.json() : [];
      const locked = sessions.filter((s: { locked_at: string | null }) => s.locked_at)
        .sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date));

      if (locked.length > 0) {
        router.replace(`/payday/dashboard/${locked[0].id}`);
      } else {
        router.replace('/payday/session');
      }
    }
    go();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );
}

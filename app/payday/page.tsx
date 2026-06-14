'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Household {
  id: string; name: string; mode: 'solo' | 'partner';
  person_a_name: string; person_b_name: string;
  joint_split_a: number;
}
interface SessionSummary {
  id: string; date: string; locked_at: string | null;
  income_a: number; income_b: number;
  spending_a: number; spending_b: number;
  travel_a: number; travel_b: number;
}
interface SessionBill { id: string; name: string; amount: number; category: string; }
interface Allocation { id: string; pot_id: string; amount: number; }
interface Pot { id: string; name: string; color: string; owner: string; pot_type: string; }

interface SessionDetail {
  session: SessionSummary;
  bills: SessionBill[];
  allocations: Allocation[];
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function monthShort(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function getLockableMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function generateMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  months.push(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  return months;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Math.abs(v));

const LOCKABLE_MONTH = getLockableMonth();

export default function PaydayHome() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(LOCKABLE_MONTH);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        await fetch('/api/payday/init', { method: 'POST' });
        const hRes = await fetch('/api/payday/households');
        if (hRes.status === 401) { router.replace('/payday/login'); return; }
        const hh = hRes.ok ? await hRes.json() : null;
        if (!hh) { router.replace('/payday/setup'); return; }
        setHousehold(hh);

        const [sRes, pRes] = await Promise.all([
          fetch(`/api/payday/sessions?householdId=${hh.id}`),
          fetch(`/api/payday/pots?householdId=${hh.id}`),
        ]);
        const all: SessionSummary[] = sRes.ok ? await sRes.json() : [];
        const pts: Pot[] = pRes.ok ? await pRes.json() : [];
        setSessions(all.sort((a, b) => b.date.localeCompare(a.date)));
        setPots(pts);

        // Default to most recent locked month
        const latestLocked = all.filter(s => s.locked_at).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (latestLocked) setSelectedMonth(latestLocked.date.slice(0, 7));
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [router]);

  const loadDetail = useCallback(async (sessId: string) => {
    setDetailLoading(true);
    setDetail(null);
    const res = await fetch(`/api/payday/sessions?id=${sessId}`);
    if (res.ok) setDetail(await res.json() as SessionDetail);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    const sess = sessions.find(s => s.date.startsWith(selectedMonth) && s.locked_at);
    if (sess) loadDetail(sess.id);
    else setDetail(null);
  }, [selectedMonth, sessions, loadDetail]);

  if (loading || !household) {
    return <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]"><div className="text-gray-400 text-sm">Loading...</div></div>;
  }

  const hh = household;
  const isPartner = hh.mode === 'partner';
  const months = generateMonths();
  const selectedSession = sessions.find(s => s.date.startsWith(selectedMonth));
  const isLocked = !!selectedSession?.locked_at;
  const isDraft = !!selectedSession && !selectedSession.locked_at;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{hh.name}</div>
            <div className="font-semibold text-sm">Payday</div>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/payday/history" className="text-xs text-gray-400 hover:text-gray-600">History</Link>
            <Link href="/payday/setup" className="text-xs text-gray-400 hover:text-gray-600">Setup</Link>
            <button onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        {/* Month pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4">
          {months.map(ym => {
            const sess = sessions.find(s => s.date.startsWith(ym));
            const locked = !!sess?.locked_at;
            const draft = !!sess && !sess.locked_at;
            const selected = ym === selectedMonth;
            return (
              <button key={ym} onClick={() => setSelectedMonth(ym)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors
                  ${selected ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${locked ? 'bg-emerald-400' : draft ? 'bg-amber-400' : selected ? 'bg-gray-400' : 'bg-gray-300'}`} />
                {monthShort(ym)}
                {ym === LOCKABLE_MONTH && !locked && <span className="opacity-60">↑</span>}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="pb-10 space-y-6">
          {/* Month heading */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-gray-900">{monthLabel(selectedMonth)}</div>
              <div className={`text-xs mt-0.5 font-medium ${isLocked ? 'text-emerald-600' : isDraft ? 'text-amber-600' : 'text-gray-400'}`}>
                {isLocked ? '● Locked in' : isDraft ? '● In progress' : selectedMonth === LOCKABLE_MONTH ? 'Not yet set up' : 'No payday recorded'}
              </div>
            </div>
            {(isDraft || (!selectedSession && selectedMonth === LOCKABLE_MONTH)) && (
              <Link href="/payday/session"
                className="bg-[#1a1a1a] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
                {isDraft ? 'Continue editing →' : 'Set up payday →'}
              </Link>
            )}
          </div>

          {/* Locked session — full dashboard inline */}
          {isLocked && detailLoading && <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>}

          {isLocked && !detailLoading && detail && (() => {
            const sess = detail.session;
            const bills = detail.bills;
            const allocations = detail.allocations;
            const splitA = hh.joint_split_a;
            const splitB = 100 - splitA;
            const potMap = Object.fromEntries(pots.map(p => [p.id, p]));

            const jointFixed = bills.filter(b => b.category === 'joint_fixed');
            const jointExtras = bills.filter(b => ['joint_extra','joint_extra_a','joint_extra_b'].includes(b.category));
            const personalBillsA = bills.filter(b => b.category === 'individual_a');
            const personalBillsB = bills.filter(b => b.category === 'individual_b');
            const debtsA = bills.filter(b => b.category === 'debt_a');
            const debtsB = bills.filter(b => b.category === 'debt_b');

            const jointFixedTotal = jointFixed.reduce((s,b)=>s+Number(b.amount),0);
            const extrasForA = jointExtras.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitA/100):b.category==='joint_extra_a'?s+Number(b.amount):s, 0);
            const extrasForB = jointExtras.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitB/100):b.category==='joint_extra_b'?s+Number(b.amount):s, 0);
            const jointContribA = jointFixedTotal*(splitA/100)+extrasForA;
            const jointContribB = jointFixedTotal*(splitB/100)+extrasForB;
            const personalTotalA = personalBillsA.reduce((s,b)=>s+Number(b.amount),0)+debtsA.reduce((s,d)=>s+Number(d.amount),0)+Number(sess.spending_a)+Number(sess.travel_a);
            const personalTotalB = personalBillsB.reduce((s,b)=>s+Number(b.amount),0)+debtsB.reduce((s,d)=>s+Number(d.amount),0)+Number(sess.spending_b)+Number(sess.travel_b);
            const potAllocsA = allocations.filter(a=>potMap[a.pot_id]?.owner==='person_a');
            const potAllocsB = allocations.filter(a=>potMap[a.pot_id]?.owner==='person_b');
            const totalSavingsA = potAllocsA.reduce((s,a)=>s+Number(a.amount),0);
            const totalSavingsB = potAllocsB.reduce((s,a)=>s+Number(a.amount),0);
            const availableA = Number(sess.income_a)-jointContribA-personalTotalA;
            const availableB = Number(sess.income_b)-jointContribB-personalTotalB;

            return (
              <>
                <div className="bg-[#1a1a1a] text-white rounded-2xl p-5">
                  <div className="flex gap-4">
                    <div className="flex-1 text-center">
                      <div className="text-xs text-gray-400 mb-0.5">{hh.person_a_name}</div>
                      <div className="text-lg font-semibold">{fmt(Number(sess.income_a))}</div>
                    </div>
                    {isPartner && <><div className="w-px bg-white/10" /><div className="flex-1 text-center">
                      <div className="text-xs text-gray-400 mb-0.5">{hh.person_b_name}</div>
                      <div className="text-lg font-semibold">{fmt(Number(sess.income_b))}</div>
                    </div></>}
                    <div className="w-px bg-white/10" />
                    <div className="flex-1 text-center">
                      <div className="text-xs text-gray-400 mb-0.5">Total in</div>
                      <div className="text-lg font-semibold">{fmt(Number(sess.income_a)+Number(sess.income_b))}</div>
                    </div>
                  </div>
                </div>

                <DSection title="Joint account" icon="🏦" subtitle={isPartner ? "Transfer your share in — covers all shared bills" : "Household bills for the month"}>
                  {isPartner && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <ActionCard label={`${hh.person_a_name} transfers`} amount={jointContribA} />
                      <ActionCard label={`${hh.person_b_name} transfers`} amount={jointContribB} />
                    </div>
                  )}
                  <div className="space-y-1">
                    {jointFixed.length > 0 && <><SLabel>Fixed bills</SLabel>{jointFixed.map(b=><BillRow key={b.id} name={b.name} amount={Number(b.amount)} splitA={isPartner?`${hh.person_a_name}: ${fmt(Number(b.amount)*splitA/100)}`:undefined} splitB={isPartner?`${hh.person_b_name}: ${fmt(Number(b.amount)*splitB/100)}`:undefined} />)}</>}
                    {jointExtras.length > 0 && <><SLabel>One-offs this month</SLabel>{jointExtras.map(b=>{const who=b.category==='joint_extra_a'?hh.person_a_name:b.category==='joint_extra_b'?hh.person_b_name:undefined;return <BillRow key={b.id} name={b.name} amount={Number(b.amount)} tag={who?`${who} only`:undefined} />;})}</>}
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mt-3">
                    <span className="text-gray-600">Total joint outgoings</span>
                    <span>{fmt(jointFixedTotal+jointExtras.reduce((s,b)=>s+Number(b.amount),0))}</span>
                  </div>
                </DSection>

                <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
                  <PersonCard name={hh.person_a_name} income={Number(sess.income_a)} jointContrib={jointContribA} personalBills={personalBillsA} debts={debtsA} spending={Number(sess.spending_a)} travel={Number(sess.travel_a)} personalTotal={personalTotalA} savingsTotal={totalSavingsA} />
                  {isPartner && <PersonCard name={hh.person_b_name} income={Number(sess.income_b)} jointContrib={jointContribB} personalBills={personalBillsB} debts={debtsB} spending={Number(sess.spending_b)} travel={Number(sess.travel_b)} personalTotal={personalTotalB} savingsTotal={totalSavingsB} />}
                </div>

                {(potAllocsA.length > 0 || potAllocsB.length > 0) && (
                  <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
                    {potAllocsA.length > 0 && <SavingsCard name={hh.person_a_name} allocs={potAllocsA} potMap={potMap} total={totalSavingsA} available={availableA} />}
                    {isPartner && potAllocsB.length > 0 && <SavingsCard name={hh.person_b_name} allocs={potAllocsB} potMap={potMap} total={totalSavingsB} available={availableB} />}
                  </div>
                )}

                <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Month at a glance</div>
                  <Recap label="Total income" value={fmt(Number(sess.income_a)+Number(sess.income_b))} />
                  <Recap label="Joint outgoings" value={fmt(jointFixedTotal+jointExtras.reduce((s,b)=>s+Number(b.amount),0))} negative />
                  <Recap label={`${hh.person_a_name}'s personal`} value={fmt(personalTotalA)} negative />
                  {isPartner && <Recap label={`${hh.person_b_name}'s personal`} value={fmt(personalTotalB)} negative />}
                  <Recap label="Saved / invested" value={fmt(totalSavingsA+totalSavingsB)} positive />
                  <div className="border-t border-gray-100 pt-3">
                    <Recap label="Savings rate" value={`${Math.round(((totalSavingsA+totalSavingsB)/(Number(sess.income_a)+Number(sess.income_b)))*100)}%`} positive bold />
                  </div>
                </div>

                {selectedSession && (
                  <div className="pb-4">
                    <Link href={`/payday/dashboard/${selectedSession.id}`} className="block border border-gray-200 py-3 rounded-xl text-sm font-medium text-center hover:border-gray-400 transition-colors">
                      Open full dashboard →
                    </Link>
                  </div>
                )}
              </>
            );
          })()}

          {/* Draft session */}
          {isDraft && selectedSession && (
            <div className="bg-white border border-amber-100 rounded-2xl p-6">
              <div className="text-sm font-semibold text-gray-800 mb-1">Payday in progress</div>
              <p className="text-xs text-gray-400 mb-4">You&apos;ve started setting up this month but haven&apos;t locked it in yet.</p>
              {(Number(selectedSession.income_a) > 0 || Number(selectedSession.income_b) > 0) && (
                <div className="flex gap-6 mb-4">
                  {Number(selectedSession.income_a) > 0 && <div><div className="text-xs text-gray-400">{hh.person_a_name}</div><div className="font-semibold">{fmt(Number(selectedSession.income_a))}</div></div>}
                  {isPartner && Number(selectedSession.income_b) > 0 && <div><div className="text-xs text-gray-400">{hh.person_b_name}</div><div className="font-semibold">{fmt(Number(selectedSession.income_b))}</div></div>}
                </div>
              )}
              <Link href="/payday/session" className="inline-block bg-[#1a1a1a] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                Continue editing →
              </Link>
            </div>
          )}

          {/* Empty past month */}
          {!selectedSession && selectedMonth !== LOCKABLE_MONTH && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-3">📅</div>
              <p className="text-sm">No payday recorded for this month.</p>
            </div>
          )}

          {/* Empty upcoming month */}
          {!selectedSession && selectedMonth === LOCKABLE_MONTH && (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
              <div className="text-3xl mb-3">📅</div>
              <div className="font-semibold text-gray-800 mb-1">Ready for payday?</div>
              <p className="text-xs text-gray-400 mb-5">Set up your {monthLabel(selectedMonth)} budget — lock it in once you&apos;re happy.</p>
              <Link href="/payday/session" className="inline-block bg-[#1a1a1a] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
                Set up payday →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function DSection({ title, icon, subtitle, children }: { title: string; icon: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5"><span>{icon}</span><h3 className="font-semibold text-gray-900">{title}</h3></div>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-400 uppercase tracking-wide font-medium pt-1 pb-0.5">{children}</div>;
}

function ActionCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-xl p-3 bg-blue-50 border border-blue-100">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-blue-700">{fmt(amount)}</div>
    </div>
  );
}

function BillRow({ name, amount, splitA, splitB, tag }: { name: string; amount: number; splitA?: string; splitB?: string; tag?: string }) {
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">{name}</span>
          {tag && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>}
        </div>
        <span className="text-sm font-medium">{fmt(amount)}</span>
      </div>
      {(splitA || splitB) && (
        <div className="flex gap-4 mt-0.5">
          {splitA && <span className="text-xs text-gray-400">{splitA}</span>}
          {splitB && <span className="text-xs text-gray-400">{splitB}</span>}
        </div>
      )}
    </div>
  );
}

function PersonCard({ name, income, jointContrib, personalBills, debts, spending, travel, personalTotal, savingsTotal }: {
  name: string; income: number; jointContrib: number;
  personalBills: SessionBill[]; debts: SessionBill[];
  spending: number; travel: number; personalTotal: number; savingsTotal: number;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="font-semibold text-gray-900">👤 {name}</h3>
        <span className="text-sm font-medium text-gray-500">{fmt(income)}</span>
      </div>
      <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-blue-600 font-medium">Transfer to joint account</div>
          <div className="text-xs text-gray-400 mt-0.5">Your share of shared bills</div>
        </div>
        <div className="text-lg font-bold text-blue-700">{fmt(jointContrib)}</div>
      </div>
      {(personalBills.length > 0 || debts.length > 0 || spending > 0 || travel > 0) && (
        <div>
          <SLabel>Personal outgoings</SLabel>
          <div className="space-y-0">
            {personalBills.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{b.name}</span>
                <span className="text-sm font-medium">{fmt(Number(b.amount))}</span>
              </div>
            ))}
            {debts.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600 flex items-center gap-1.5">
                  <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">debt</span>{d.name}
                </span>
                <span className="text-sm font-medium">{fmt(Number(d.amount))}</span>
              </div>
            ))}
            {spending > 0 && <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-600">Spending money</span><span className="text-sm font-medium">{fmt(spending)}</span></div>}
            {travel > 0 && <div className="flex items-center justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-600">Travel</span><span className="text-sm font-medium">{fmt(travel)}</span></div>}
            <div className="flex justify-between text-xs text-gray-400 pt-1"><span>Personal total</span><span className="font-medium">{fmt(personalTotal)}</span></div>
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-gray-600">Remainder after savings</span>
          <span className={income - jointContrib - personalTotal - savingsTotal < -0.01 ? 'text-red-600' : 'text-gray-900'}>
            {fmt(income - jointContrib - personalTotal - savingsTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SavingsCard({ name, allocs, potMap, total, available }: {
  name: string; allocs: Allocation[]; potMap: Record<string, Pot>; total: number; available: number;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5"><span>💰</span><h3 className="font-semibold text-gray-900">{name}&apos;s savings</h3></div>
        <p className="text-xs text-gray-400">Transfers to make this month</p>
      </div>
      <div className="space-y-0">
        {allocs.map(a => {
          const pot = potMap[a.pot_id];
          if (!pot) return null;
          const pct = available > 0 ? Math.round((Number(a.amount) / available) * 100) : 0;
          return (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pot.color }} />
              <span className="text-sm flex-1 text-gray-700">{pot.name}</span>
              {pct > 0 && <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>}
              <span className="text-sm font-semibold text-emerald-700">{fmt(Number(a.amount))}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3">
        <span className="text-gray-600">Total to save</span>
        <span className="text-emerald-600">{fmt(total)}</span>
      </div>
    </div>
  );
}

function Recap({ label, value, negative, positive, bold }: { label: string; value: string; negative?: boolean; positive?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-500">{label}</span>
      <span className={positive ? 'text-emerald-600 font-semibold' : negative ? 'text-gray-700' : 'font-medium'}>
        {negative ? '−' : ''}{value}
      </span>
    </div>
  );
}

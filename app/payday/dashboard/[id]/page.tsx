'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Household {
  id: string; name: string; mode: 'solo' | 'partner';
  person_a_name: string; person_b_name: string;
  joint_split_a: number;
}

interface SessionRow {
  id: string; date: string;
  income_a: number; income_b: number;
  spending_a: number; spending_b: number;
  travel_a: number; travel_b: number;
  locked_at: string | null;
}

interface SessionBill {
  id: string; name: string; amount: number; category: string;
}

interface Allocation {
  id: string; pot_id: string; amount: number;
}

interface Pot {
  id: string; name: string; color: string; owner: string; pot_type: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Math.abs(v));

function getPayPeriod(dateStr: string) {
  const d = new Date(dateStr);
  // Paid at end of month (day >= 20) → covers the following month
  const covers = new Date(d);
  if (d.getDate() >= 20) covers.setMonth(covers.getMonth() + 1);
  return covers.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [household, setHousehold] = useState<Household | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [bills, setBills] = useState<SessionBill[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const meRes = await fetch('/api/payday/auth/me');
    if (meRes.status === 401) { router.push('/payday/login'); return; }

    const hRes = await fetch('/api/payday/households');
    if (!hRes.ok) return;
    const hh: Household = await hRes.json();
    if (!hh) { router.push('/payday/setup'); return; }
    setHousehold(hh);

    const [sRes, pRes, allRes] = await Promise.all([
      fetch(`/api/payday/sessions?id=${id}`),
      fetch(`/api/payday/pots?householdId=${hh.id}`),
      fetch(`/api/payday/sessions?householdId=${hh.id}`),
    ]);

    const sData = await sRes.json();
    const pts: Pot[] = await pRes.json();
    const all: SessionRow[] = await allRes.json();

    setSession(sData.session as SessionRow);
    setBills(sData.bills as SessionBill[]);
    setAllocations(sData.allocations as Allocation[]);
    setPots(pts);
    setAllSessions(all.filter((s: SessionRow) => s.locked_at).sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading || !session || !household) {
    return <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]"><div className="text-gray-400 text-sm">Loading...</div></div>;
  }

  const hh = household;
  const isPartner = hh.mode === 'partner';
  const splitA = hh.joint_split_a;
  const splitB = 100 - splitA;

  // Categorise bills
  const jointFixed = bills.filter(b => b.category === 'joint_fixed');
  const jointExtras = bills.filter(b => ['joint_extra', 'joint_extra_a', 'joint_extra_b'].includes(b.category));
  const personalBillsA = bills.filter(b => b.category === 'individual_a');
  const personalBillsB = bills.filter(b => b.category === 'individual_b');
  const debtsA = bills.filter(b => b.category === 'debt_a');
  const debtsB = bills.filter(b => b.category === 'debt_b');

  const jointFixedTotal = jointFixed.reduce((s, b) => s + Number(b.amount), 0);
  const extrasForA = jointExtras.reduce((s, b) => {
    if (b.category === 'joint_extra') return s + Number(b.amount) * (splitA / 100);
    if (b.category === 'joint_extra_a') return s + Number(b.amount);
    return s;
  }, 0);
  const extrasForB = jointExtras.reduce((s, b) => {
    if (b.category === 'joint_extra') return s + Number(b.amount) * (splitB / 100);
    if (b.category === 'joint_extra_b') return s + Number(b.amount);
    return s;
  }, 0);

  const jointContribA = jointFixedTotal * (splitA / 100) + extrasForA;
  const jointContribB = jointFixedTotal * (splitB / 100) + extrasForB;

  const personalTotalA = personalBillsA.reduce((s, b) => s + Number(b.amount), 0)
    + debtsA.reduce((s, d) => s + Number(d.amount), 0)
    + Number(session.spending_a) + Number(session.travel_a);
  const personalTotalB = personalBillsB.reduce((s, b) => s + Number(b.amount), 0)
    + debtsB.reduce((s, d) => s + Number(d.amount), 0)
    + Number(session.spending_b) + Number(session.travel_b);

  // Savings per pot / per person
  const potMap = Object.fromEntries(pots.map(p => [p.id, p]));
  const potAllocsA = allocations.filter(a => potMap[a.pot_id]?.owner === 'person_a');
  const potAllocsB = allocations.filter(a => potMap[a.pot_id]?.owner === 'person_b');

  const totalSavingsA = potAllocsA.reduce((s, a) => s + Number(a.amount), 0);
  const totalSavingsB = potAllocsB.reduce((s, a) => s + Number(a.amount), 0);

  const availableA = Number(session.income_a) - jointContribA - personalTotalA;
  const availableB = Number(session.income_b) - jointContribB - personalTotalB;

  // Prev/next sessions
  const idx = allSessions.findIndex(s => s.id === id);
  const prevSession = idx < allSessions.length - 1 ? allSessions[idx + 1] : null;
  const nextSession = idx > 0 ? allSessions[idx - 1] : null;

  const payPeriod = getPayPeriod(session.date);
  const isLatest = idx === 0;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">{hh.name}</div>
            <div className="font-semibold text-sm">Payday Dashboard</div>
          </div>
          <div className="flex gap-3 items-center">
            {isLatest && (
              <Link href="/payday/session"
                className="text-xs bg-[#1a1a1a] text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                New payday →
              </Link>
            )}
            <button onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Pay period banner */}
        <div className="bg-[#1a1a1a] text-white rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => prevSession && router.push(`/payday/dashboard/${prevSession.id}`)}
              disabled={!prevSession}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white">
              ←
            </button>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Paid on {fmtDate(session.date)}</div>
              <div className="text-xl font-bold">{payPeriod}</div>
              <div className="text-xs text-gray-400 mt-0.5">budget period</div>
            </div>
            <button onClick={() => nextSession && router.push(`/payday/dashboard/${nextSession.id}`)}
              disabled={!nextSession}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white">
              →
            </button>
          </div>

          {/* Income summary */}
          <div className="border-t border-white/10 mt-4 pt-4 flex gap-4">
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-400 mb-0.5">{hh.person_a_name}</div>
              <div className="text-lg font-semibold">{fmt(Number(session.income_a))}</div>
            </div>
            {isPartner && (
              <>
                <div className="w-px bg-white/10" />
                <div className="flex-1 text-center">
                  <div className="text-xs text-gray-400 mb-0.5">{hh.person_b_name}</div>
                  <div className="text-lg font-semibold">{fmt(Number(session.income_b))}</div>
                </div>
              </>
            )}
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-400 mb-0.5">Total in</div>
              <div className="text-lg font-semibold">{fmt(Number(session.income_a) + Number(session.income_b))}</div>
            </div>
          </div>
        </div>

        {/* Joint account section */}
        <Section title="Joint account" icon="🏦" subtitle={isPartner ? "Transfer your share in — this covers all shared bills" : "Your household bills for the month"}>
          {isPartner && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ActionCard
                label={`${hh.person_a_name} transfers`}
                amount={jointContribA}
                highlight
              />
              <ActionCard
                label={`${hh.person_b_name} transfers`}
                amount={jointContribB}
                highlight
              />
            </div>
          )}

          <div className="space-y-1">
            {jointFixed.length > 0 && (
              <>
                <SectionLabel>Fixed bills</SectionLabel>
                {jointFixed.map(b => (
                  <BillRow key={b.id} name={b.name} amount={Number(b.amount)}
                    splitA={isPartner ? `${hh.person_a_name}: ${fmt(Number(b.amount) * splitA / 100)}` : undefined}
                    splitB={isPartner ? `${hh.person_b_name}: ${fmt(Number(b.amount) * splitB / 100)}` : undefined}
                  />
                ))}
              </>
            )}
            {jointExtras.length > 0 && (
              <>
                <SectionLabel>One-offs this month</SectionLabel>
                {jointExtras.map(b => {
                  const who = b.category === 'joint_extra_a' ? hh.person_a_name
                    : b.category === 'joint_extra_b' ? hh.person_b_name
                    : undefined;
                  return (
                    <BillRow key={b.id} name={b.name} amount={Number(b.amount)}
                      tag={who ? `${who} only` : undefined} />
                  );
                })}
              </>
            )}
          </div>

          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mt-3">
            <span className="text-gray-600">Total joint outgoings</span>
            <span>{fmt(jointFixed.reduce((s, b) => s + Number(b.amount), 0) + jointExtras.reduce((s, b) => s + Number(b.amount), 0))}</span>
          </div>
        </Section>

        {/* Per-person sections */}
        <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
          <PersonSection
            name={hh.person_a_name}
            income={Number(session.income_a)}
            jointContrib={jointContribA}
            personalBills={personalBillsA}
            debts={debtsA}
            spending={Number(session.spending_a)}
            travel={Number(session.travel_a)}
            personalTotal={personalTotalA}
            savingsTotal={totalSavingsA}
          />
          {isPartner && (
            <PersonSection
              name={hh.person_b_name}
              income={Number(session.income_b)}
              jointContrib={jointContribB}
              personalBills={personalBillsB}
              debts={debtsB}
              spending={Number(session.spending_b)}
              travel={Number(session.travel_b)}
              personalTotal={personalTotalB}
              savingsTotal={totalSavingsB}
            />
          )}
        </div>

        {/* Per-person savings blocks */}
        {(potAllocsA.length > 0 || potAllocsB.length > 0) && (
          <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
            {potAllocsA.length > 0 && (
              <SavingsSection
                name={hh.person_a_name}
                allocs={potAllocsA}
                potMap={potMap}
                total={totalSavingsA}
                available={availableA}
              />
            )}
            {isPartner && potAllocsB.length > 0 && (
              <SavingsSection
                name={hh.person_b_name}
                allocs={potAllocsB}
                potMap={potMap}
                total={totalSavingsB}
                available={availableB}
              />
            )}
          </div>
        )}

        {/* Bottom recap */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-3">Month at a glance</div>
          <RecapRow label="Total income" value={fmt(Number(session.income_a) + Number(session.income_b))} />
          <RecapRow label="Joint outgoings" value={fmt(jointFixed.reduce((s, b) => s + Number(b.amount), 0) + jointExtras.reduce((s, b) => s + Number(b.amount), 0))} negative />
          <RecapRow label={`${hh.person_a_name}'s personal`} value={fmt(personalTotalA)} negative />
          {isPartner && <RecapRow label={`${hh.person_b_name}'s personal`} value={fmt(personalTotalB)} negative />}
          <RecapRow label="Saved / invested" value={fmt(totalSavingsA + totalSavingsB)} positive />
          <div className="border-t border-gray-100 pt-3">
            <RecapRow
              label="Savings rate"
              value={`${Math.round(((totalSavingsA + totalSavingsB) / (Number(session.income_a) + Number(session.income_b))) * 100)}%`}
              positive
              bold
            />
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <Link href="/payday/history" className="flex-1 border border-gray-200 py-3 rounded-xl text-sm font-medium text-center hover:border-gray-400 transition-colors">
            View all sessions
          </Link>
          {isLatest && (
            <Link href="/payday/session" className="flex-1 bg-[#1a1a1a] text-white py-3 rounded-xl text-sm font-medium text-center hover:bg-gray-800 transition-colors">
              Start next payday →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function Section({ title, icon, subtitle, children }: { title: string; icon: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span>{icon}</span>
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-400 uppercase tracking-wide font-medium pt-1 pb-0.5">{children}</div>;
}

function ActionCard({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
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

interface Pot { id: string; name: string; color: string; owner: string; pot_type: string; }
interface Allocation { id: string; pot_id: string; amount: number; }

function PersonSection({ name, income, jointContrib, personalBills, debts, spending, travel, personalTotal, savingsTotal }: {
  name: string;
  income: number;
  jointContrib: number;
  personalBills: SessionBill[];
  debts: SessionBill[];
  spending: number;
  travel: number;
  personalTotal: number;
  savingsTotal: number;
}) {
  const fmt2 = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Math.abs(v));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="font-semibold text-gray-900">👤 {name}</h3>
        <span className="text-sm font-medium text-gray-500">{fmt2(income)}</span>
      </div>

      {/* Joint contribution */}
      <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-blue-600 font-medium">Transfer to joint account</div>
          <div className="text-xs text-gray-400 mt-0.5">Covers your share of shared bills</div>
        </div>
        <div className="text-lg font-bold text-blue-700">{fmt2(jointContrib)}</div>
      </div>

      {/* Personal bills */}
      {(personalBills.length > 0 || debts.length > 0 || spending > 0 || travel > 0) && (
        <div>
          <SectionLabel>Personal outgoings</SectionLabel>
          <div className="space-y-0">
            {personalBills.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{b.name}</span>
                <span className="text-sm font-medium">{fmt2(Number(b.amount))}</span>
              </div>
            ))}
            {debts.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600 flex items-center gap-1.5">
                  <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">debt</span>
                  {d.name}
                </span>
                <span className="text-sm font-medium">{fmt2(Number(d.amount))}</span>
              </div>
            ))}
            {spending > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">Spending money</span>
                <span className="text-sm font-medium">{fmt2(spending)}</span>
              </div>
            )}
            {travel > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">Travel</span>
                <span className="text-sm font-medium">{fmt2(travel)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 pt-1">
              <span>Personal total</span>
              <span className="font-medium">{fmt2(personalTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Person net */}
      <div className="border-t border-gray-100 pt-3 space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Joint + personal + savings</span>
          <span>{fmt2(jointContrib + personalTotal + savingsTotal)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-gray-600">Remainder</span>
          <span className={income - jointContrib - personalTotal - savingsTotal < -0.01 ? 'text-red-600' : 'text-gray-900'}>
            {fmt2(income - jointContrib - personalTotal - savingsTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SavingsSection({ name, allocs, potMap, total, available }: {
  name: string;
  allocs: Allocation[];
  potMap: Record<string, Pot>;
  total: number;
  available: number;
}) {
  const fmt2 = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Math.abs(v));
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span>💰</span>
          <h3 className="font-semibold text-gray-900">{name}&apos;s savings</h3>
        </div>
        <p className="text-xs text-gray-400">Transfers to make this month</p>
      </div>
      <div className="space-y-0">
        {allocs.map(a => {
          const pot = potMap[a.pot_id];
          if (!pot) return null;
          return (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pot.color }} />
              <span className="text-sm flex-1 text-gray-700">{pot.name}</span>
              <span className="text-xs text-gray-400 w-10 text-right">{available > 0 ? `${Math.round((Number(a.amount) / available) * 100)}%` : ''}</span>
              <span className="text-sm font-semibold text-emerald-700">{fmt2(Number(a.amount))}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3">
        <span className="text-gray-600">Total to save</span>
        <span className="text-emerald-600">{fmt2(total)}</span>
      </div>
    </div>
  );
}

function RecapRow({ label, value, negative, positive, bold }: { label: string; value: string; negative?: boolean; positive?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-500">{label}</span>
      <span className={positive ? 'text-emerald-600 font-semibold' : negative ? 'text-gray-700' : 'font-medium'}>
        {negative ? '−' : ''}{value}
      </span>
    </div>
  );
}

interface SessionBill { id: string; name: string; amount: number; category: string; }

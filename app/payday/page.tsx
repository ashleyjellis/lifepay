'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Quicksand } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'], weight: ['500', '600', '700'] });

interface Household {
  id: string; name: string; mode: 'solo' | 'partner';
  person_a_name: string; person_b_name: string;
  joint_split_a: number;
  default_spending_a: number; default_spending_b: number;
  default_transport_a: number; default_transport_b: number;
  payday_day: number;
}
interface SessionSummary {
  id: string; date: string; locked_at: string | null;
  income_a: number; income_b: number;
  spending_a: number; spending_b: number;
  travel_a: number; travel_b: number;
}
interface SessionBill { id: string; name: string; amount: number; category: string; }
interface Allocation { id: string; pot_id: string; amount: number; }
interface Pot { id: string; name: string; color: string; owner: string; pot_type: string; account_type?: string | null; provider?: string | null; }
interface SessionDetail { session: SessionSummary; bills: SessionBill[]; allocations: Allocation[]; }

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function monthShort(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
function toYM(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function getEditableMonths(): string[] {
  const now = new Date();
  return [0, 1, 2].map(i => toYM(new Date(now.getFullYear(), now.getMonth() + i, 1)));
}
function generateMonths(sessionDates: string[]): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 12; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = toYM(d);
    if (sessionDates.some(sd => sd.startsWith(m))) months.push(m);
  }
  const editable = getEditableMonths();
  editable.forEach(m => { if (!months.includes(m)) months.push(m); });
  return months;
}
function uid() { return Math.random().toString(36).slice(2); }
const ACCT_LABELS: Record<string, string> = { savings_account: 'Savings', cash_isa: 'Cash ISA', stocks_isa: 'S&S ISA', lisa: 'LISA', pension: 'Pension' };
const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Math.abs(v));

export default function PaydayHome() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(toYM(new Date()));
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [householdBills, setHouseholdBills] = useState<{id:string;name:string;amount:number;category:string}[]>([]);
  const [householdDebts, setHouseholdDebts] = useState<{id:string;name:string;amount:number;person:string}[]>([]);
  const [onboardingStep, setOnboardingStep] = useState<0|1|2>(0);

  useEffect(() => {
    async function load() {
      try {
        await fetch('/api/payday/init', { method: 'POST' });
        const hRes = await fetch('/api/payday/households');
        if (hRes.status === 401) { router.replace('/payday/login'); return; }
        const hh = hRes.ok ? await hRes.json() : null;
        if (!hh) { router.replace('/payday/setup'); return; }
        setHousehold(hh);
        const [sRes, pRes, bRes, dRes] = await Promise.all([
          fetch(`/api/payday/sessions?householdId=${hh.id}`),
          fetch(`/api/payday/pots?householdId=${hh.id}`),
          fetch(`/api/payday/bills?householdId=${hh.id}`),
          fetch(`/api/payday/debts?householdId=${hh.id}`),
        ]);
        const all: SessionSummary[] = sRes.ok ? await sRes.json() : [];
        const pts: Pot[] = pRes.ok ? await pRes.json() : [];
        setSessions(all.sort((a, b) => b.date.localeCompare(a.date)));
        setPots(pts);
        if (bRes.ok) setHouseholdBills(await bRes.json());
        if (dRes.ok) setHouseholdDebts(await dRes.json());
        const latestLocked = all.filter(s => s.locked_at).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (latestLocked) setSelectedMonth(latestLocked.date.slice(0, 7));
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [router]);

  useEffect(() => {
    if (!loading && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('onboarding') === '1') {
      setOnboardingStep(1);
      router.replace('/payday');
    }
  }, [loading, router]);

  const loadDetail = useCallback(async (sessId: string) => {
    setDetailLoading(true); setDetail(null);
    const res = await fetch(`/api/payday/sessions?id=${sessId}`);
    if (res.ok) setDetail(await res.json() as SessionDetail);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    const sess = sessions.find(s => s.date.startsWith(selectedMonth));
    if (sess) loadDetail(sess.id);
    else setDetail(null);
  }, [selectedMonth, sessions, loadDetail]);

  const refreshSessions = useCallback(async (hh: Household) => {
    const res = await fetch(`/api/payday/sessions?householdId=${hh.id}`);
    if (res.ok) setSessions((await res.json() as SessionSummary[]).sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const [latestLockedDetail, setLatestLockedDetail] = useState<SessionDetail | null>(null);
  const latestLockedSession = sessions.filter(s => s.locked_at).sort((a,b) => b.date.localeCompare(a.date))[0];
  useEffect(() => {
    if (latestLockedSession) {
      fetch(`/api/payday/sessions?id=${latestLockedSession.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setLatestLockedDetail(d));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestLockedSession?.id]);

  if (loading || !household) return (
    <div className={`flex items-center justify-center min-h-screen bg-[#f7faf8] ${quicksand.className}`}>
      <div className="text-[#414940] text-sm font-medium">Loading...</div>
    </div>
  );

  const hh = household;
  const isPartner = hh.mode === 'partner';
  const curYM = toYM(new Date());
  const paydayDay = hh.payday_day ?? 25;
  const now = new Date();
  // Has this month's payday happened yet?
  const paydayThisMonth = new Date(now.getFullYear(), now.getMonth(), paydayDay);
  const paydayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, paydayDay);
  const nextPaydayDate = now < paydayThisMonth ? paydayThisMonth : paydayNextMonth;
  const daysUntilNextPayday = Math.ceil((nextPaydayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  // Has today passed the payday day in the selected month?
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const selectedMonthPayday = new Date(selY, selM - 1, paydayDay);
  const paydayHasPassed = now >= selectedMonthPayday;
  // The spend month is the month AFTER the payday month (e.g. paid Jun 25 → spending July)
  const spendMonthLabel = new Date(selY, selM, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const nextMonthYM = toYM(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const editableMonths = getEditableMonths();
  const months = generateMonths(sessions.map(s => s.date));
  const selectedSession = sessions.find(s => s.date.startsWith(selectedMonth));
  const isLocked = !!selectedSession?.locked_at;
  const isDraft = !!selectedSession && !selectedSession.locked_at;
  const isEditable = editableMonths.includes(selectedMonth) && !isLocked;

  // Greeting: names for the header
  const names = isPartner ? `${hh.person_a_name} & ${hh.person_b_name}` : hh.person_a_name;

  return (
    <div className={`min-h-screen bg-[#f7faf8] ${quicksand.className}`}>

      {/* ── Onboarding step 1 ── */}
      {onboardingStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-[0_8px_40px_rgba(57,105,64,0.18)] text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-[#181c1c] mb-2">Your baseline is set up!</h2>
            <p className="text-sm text-[#414940] leading-relaxed mb-4">
              This is your Payday baseline — it captures your income, bills, spending, and savings goals. Each month you&apos;ll lock in your actual payday to confirm everything still tracks.
            </p>
            <p className="text-sm text-[#414940] leading-relaxed mb-6">
              You can update your baseline any time from <strong>Setup</strong> in the menu.
            </p>
            <button
              onClick={() => { setOnboardingStep(2); setSelectedMonth(nextMonthYM); }}
              className="w-full bg-[#396940] text-white py-3 rounded-full font-semibold hover:bg-[#2d5533] transition-colors">
              Got it — show me next steps →
            </button>
          </div>
        </div>
      )}

      {/* ── Onboarding step 2 ── */}
      {onboardingStep === 2 && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOnboardingStep(0)}>
          <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
            <div className="bg-[#2d3130] text-white rounded-2xl p-5 shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
              <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1">Next payday</div>
              <p className="text-sm leading-relaxed mb-3">
                Your next payday is in <strong>{daysUntilNextPayday} days</strong>. Tap{' '}
                <strong>{monthShort(nextMonthYM)}</strong> to plan it — confirm your income and bills, then allocate leftover money to savings.
              </p>
              <button onClick={() => setOnboardingStep(0)} className="w-full border border-white/30 text-white py-2 rounded-full text-sm font-semibold hover:bg-white/10 transition-colors">
                Let&apos;s go
              </button>
            </div>
            <div className="w-3 h-3 bg-[#2d3130] rotate-45 absolute -top-1.5 left-1/2 -translate-x-1/2" />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-[#e6e9e7] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="text-[#396940] font-bold text-lg tracking-tight">Payd</div>
          <div className="flex gap-5 items-center">
            <Link href="/payday" className="text-sm text-[#414940] hover:text-[#396940] font-semibold transition-colors">Paydays</Link>
            <Link href="/payday/history" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">History</Link>
            <Link href="/payday/setup" className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Setup</Link>
            <button onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }}
              className="text-sm text-[#414940] hover:text-[#396940] font-medium transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-5">

        {/* ── Month timeline + countdown ── */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-5 px-5 items-center">
          {months.map(ym => {
            const sess = sessions.find(s => s.date.startsWith(ym));
            const locked = !!sess?.locked_at;
            const selected = ym === selectedMonth;
            return (
              <button key={ym} onClick={() => { setSelectedMonth(ym); if (onboardingStep === 2) setOnboardingStep(0); }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${onboardingStep === 2 && ym === nextMonthYM ? 'ring-2 ring-[#396940] ring-offset-2' : ''} ${selected ? 'bg-[#396940] text-white border-[#396940]' : locked ? 'bg-white border-[#7bae7f] text-[#396940]' : 'bg-white border-[#c1c9be] text-[#414940] hover:border-[#7bae7f]'}`}>
                {monthShort(ym)}
              </button>
            );
          })}
          {/* Countdown pill */}
          <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white border border-[#c1c9be] text-[#414940] whitespace-nowrap">
            <span>📅</span>
            <span>{daysUntilNextPayday === 0 ? 'Payday today! 🎉' : `${daysUntilNextPayday} days until payday`}</span>
          </div>
        </div>

        <div className="pb-10 space-y-8">
          {/* ── Greeting + status ── */}
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="text-[#396940] font-semibold text-sm mb-1">Happy Payday, {names}! 🌿</div>
              <div className="text-2xl font-bold text-[#181c1c]">{monthLabel(selectedMonth)} payday</div>
              <div className="text-sm text-[#717970] mt-0.5">📆 Sort out your <span className="font-semibold text-[#414940]">{spendMonthLabel}</span> spend</div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mt-1 ${
              isLocked ? 'bg-[#baf0bc] text-[#002109]' :
              paydayHasPassed && isDraft ? 'bg-[#ffdcc4] text-[#2f1400]' :
              paydayHasPassed && !selectedSession ? 'bg-[#ffdcc4] text-[#2f1400]' :
              isDraft ? 'bg-[#ffdcc4] text-[#2f1400]' :
              isEditable ? 'bg-[#ffdf96] text-[#251a00]' :
              'bg-[#ebeeed] text-[#414940]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLocked?'bg-[#396940]':paydayHasPassed&&!isLocked?'bg-[#8e4e14]':isEditable?'bg-[#765a05]':'bg-[#717970]'}`} />
              {isLocked ? 'Locked in' : paydayHasPassed && isDraft ? 'Awaiting lock-in' : paydayHasPassed && !selectedSession ? 'Payday passed' : isDraft ? 'In progress' : isEditable ? 'Plan ahead' : 'No data'}
            </div>
          </div>

          {/* ── Past-payday nudge ── */}
          {paydayHasPassed && !isLocked && isEditable && (
            <div className="flex items-start gap-3 bg-[#fff3e0] border border-[#ffcc80] rounded-2xl px-4 py-3.5 text-sm">
              <span className="text-lg shrink-0">💸</span>
              <div>
                <div className="font-semibold text-[#5d3a00]">Your {monthLabel(selectedMonth)} payday has passed</div>
                <div className="text-[#7c4a00] mt-0.5">Check your actuals and lock in this month once you&apos;re happy — it can&apos;t be edited after that.</div>
              </div>
            </div>
          )}

          {detailLoading && <div className="text-center py-12 text-[#717970] text-sm font-medium">Loading...</div>}

          {isLocked && !detailLoading && detail && (
            <LockedDashboard hh={hh} pots={pots} detail={detail} sessionId={selectedSession!.id} />
          )}

          {isEditable && !detailLoading && (
            <InlineEdit
              key={selectedMonth}
              hh={hh} pots={pots}
              existingId={selectedSession?.id ?? null}
              detail={isDraft ? detail : null}
              latestLockedDetail={(!selectedSession && selectedMonth !== curYM) ? latestLockedDetail : null}
              mostRecentSession={!selectedSession ? ([...sessions].sort((a,b) => b.date.localeCompare(a.date))[0] ?? null) : null}
              householdBills={householdBills}
              householdDebts={householdDebts}
              month={selectedMonth}
              onSaved={() => { refreshSessions(hh); }}
              onLocked={(newId) => {
                refreshSessions(hh);
                setSelectedMonth(selectedMonth);
                loadDetail(newId);
              }}
              onPotsChanged={(newPots) => setPots(newPots)}
            />
          )}

          {!selectedSession && !isEditable && !detailLoading && (
            <div className="text-center py-20 text-[#717970]">
              <div className="text-3xl mb-3">📅</div>
              <p className="text-sm font-medium">No payday recorded for this month.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Locked read-only dashboard ──────────────────────────────────────────────

function LockedDashboard({ hh, pots, detail, sessionId }: { hh: Household; pots: Pot[]; detail: SessionDetail; sessionId: string }) {
  const isPartner = hh.mode === 'partner';
  const splitA = hh.joint_split_a; const splitB = 100 - splitA;
  const { session: sess, bills, allocations } = detail;
  const potMap = Object.fromEntries(pots.map(p => [p.id, p]));

  const jointFixed = bills.filter(b => b.category === 'joint_fixed');
  const jointExtras = bills.filter(b => ['joint_extra','joint_extra_a','joint_extra_b'].includes(b.category));
  const personalBillsA = bills.filter(b => b.category === 'individual_a');
  const personalBillsB = bills.filter(b => b.category === 'individual_b');
  const debtsA = bills.filter(b => b.category === 'debt_a');
  const debtsB = bills.filter(b => b.category === 'debt_b');

  const jointFixedTotal = jointFixed.reduce((s,b)=>s+Number(b.amount),0);
  const extrasForA = jointExtras.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitA/100):b.category==='joint_extra_a'?s+Number(b.amount):s,0);
  const extrasForB = jointExtras.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitB/100):b.category==='joint_extra_b'?s+Number(b.amount):s,0);
  const jointContribA = jointFixedTotal*(splitA/100)+extrasForA;
  const jointContribB = jointFixedTotal*(splitB/100)+extrasForB;
  const personalTotalA = personalBillsA.reduce((s,b)=>s+Number(b.amount),0)+debtsA.reduce((s,d)=>s+Number(d.amount),0)+Number(sess.spending_a)+Number(sess.travel_a);
  const personalTotalB = personalBillsB.reduce((s,b)=>s+Number(b.amount),0)+debtsB.reduce((s,d)=>s+Number(d.amount),0)+Number(sess.spending_b)+Number(sess.travel_b);
  const potAllocsA = allocations.filter(a=>potMap[a.pot_id]?.owner==='person_a'||potMap[a.pot_id]?.owner==='joint');
  const potAllocsB = allocations.filter(a=>potMap[a.pot_id]?.owner==='person_b');
  const totalSavingsA = potAllocsA.reduce((s,a)=>s+Number(a.amount),0);
  const totalSavingsB = potAllocsB.reduce((s,a)=>s+Number(a.amount),0);
  const availableA = Number(sess.income_a)-jointContribA-personalTotalA;
  const availableB = Number(sess.income_b)-jointContribB-personalTotalB;
  const totalIncome = Number(sess.income_a)+Number(sess.income_b);
  const totalJoint = jointFixedTotal+jointExtras.reduce((s,b)=>s+Number(b.amount),0);

  return (
    <div className="space-y-8">
      {/* Income card — dark */}
      <div className="bg-[#2d3130] text-white rounded-[20px] p-6">
        <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Income this month</div>
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="text-xs text-white/60 font-medium mb-1">{hh.person_a_name}</div>
            <div className="text-2xl font-bold">{fmt(Number(sess.income_a))}</div>
          </div>
          {isPartner && (
            <div className="flex-1">
              <div className="text-xs text-white/60 font-medium mb-1">{hh.person_b_name}</div>
              <div className="text-2xl font-bold">{fmt(Number(sess.income_b))}</div>
            </div>
          )}
        </div>
        {isPartner && (
          <div className="border-t border-white/10 mt-5 pt-4 flex justify-between items-center">
            <span className="text-sm text-white/60 font-medium">Total in</span>
            <span className="text-2xl font-bold">{fmt(totalIncome)}</span>
          </div>
        )}
      </div>

      {/* Joint Bills */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[#181c1c] flex items-center gap-2">
          <span>👥</span> Joint Bills
        </h2>
        <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
          <p className="text-sm text-[#717970] mb-4">Shared bills split by your ratio</p>
          {isPartner && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <ActionCard label={`${hh.person_a_name} transfers`} amount={jointContribA} />
              <ActionCard label={`${hh.person_b_name} transfers`} amount={jointContribB} />
            </div>
          )}
          {jointFixed.length>0 && (
            <>
              <SLabel>Fixed bills</SLabel>
              {jointFixed.map(b=><BillRow key={b.id} name={b.name} amount={Number(b.amount)}
                splitA={isPartner?`${hh.person_a_name}: ${fmt(Number(b.amount)*splitA/100)}`:undefined}
                splitB={isPartner?`${hh.person_b_name}: ${fmt(Number(b.amount)*splitB/100)}`:undefined} />)}
            </>
          )}
          {jointExtras.length>0 && (
            <>
              <SLabel>One-offs this month</SLabel>
              {jointExtras.map(b=>{
                const who=b.category==='joint_extra_a'?hh.person_a_name:b.category==='joint_extra_b'?hh.person_b_name:undefined;
                return <BillRow key={b.id} name={b.name} amount={Number(b.amount)} tag={who?`${who} only`:undefined} />;
              })}
            </>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-[#ebeeed] pt-3 mt-3">
            <span className="text-[#414940]">Total joint outgoings</span>
            <span className="text-[#181c1c]">{fmt(totalJoint)}</span>
          </div>
        </div>
      </div>

      {/* Per-person */}
      <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}>
        <PersonCard name={hh.person_a_name} income={Number(sess.income_a)} jointContrib={jointContribA}
          personalBills={personalBillsA} debts={debtsA} spending={Number(sess.spending_a)} travel={Number(sess.travel_a)}
          personalTotal={personalTotalA} savingsTotal={totalSavingsA} />
        {isPartner && (
          <PersonCard name={hh.person_b_name} income={Number(sess.income_b)} jointContrib={jointContribB}
            personalBills={personalBillsB} debts={debtsB} spending={Number(sess.spending_b)} travel={Number(sess.travel_b)}
            personalTotal={personalTotalB} savingsTotal={totalSavingsB} />
        )}
      </div>

      {/* Savings */}
      {(potAllocsA.length>0||potAllocsB.length>0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[#181c1c] flex items-center gap-2"><span>🏦</span> Savings</h2>
          <div className={isPartner?'grid grid-cols-1 md:grid-cols-2 gap-4':''}>
            {potAllocsA.length>0 && <SavingsCard name={hh.person_a_name} allocs={potAllocsA} potMap={potMap} total={totalSavingsA} available={availableA} />}
            {isPartner&&potAllocsB.length>0 && <SavingsCard name={hh.person_b_name} allocs={potAllocsB} potMap={potMap} total={totalSavingsB} available={availableB} />}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
        <div className="text-base font-bold text-[#181c1c] mb-4">Month at a glance</div>
        <div className="space-y-3">
          <Recap label="Total income" value={fmt(totalIncome)} />
          <Recap label="Joint outgoings" value={fmt(totalJoint)} negative />
          <Recap label={`${hh.person_a_name}&apos;s personal`} value={fmt(personalTotalA)} negative />
          {isPartner && <Recap label={`${hh.person_b_name}&apos;s personal`} value={fmt(personalTotalB)} negative />}
          <Recap label="Saved / invested" value={fmt(totalSavingsA+totalSavingsB)} positive />
          <div className="border-t border-[#ebeeed] pt-3">
            <Recap label="Savings rate" value={`${Math.round(((totalSavingsA+totalSavingsB)/totalIncome)*100)}%`} positive bold />
          </div>
        </div>
      </div>

      <Link href={`/payday/dashboard/${sessionId}`}
        className="block border-2 border-[#7bae7f] py-3.5 rounded-full text-sm font-bold text-[#396940] text-center hover:bg-[#f1f4f2] transition-colors">
        Open full dashboard →
      </Link>
    </div>
  );
}

// ── Sub-components defined OUTSIDE InlineEdit to prevent remount on render ──

interface EditBill { _key: string; name: string; amount: string; }
interface EditExtra { _key: string; name: string; amount: string; who: 'both' | 'a' | 'b'; }

function EInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void; }) {
  return (
    <div className="flex-1">
      <div className="text-xs mb-2 text-white/60 font-medium">{label}</div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-sm font-medium">£</span>
        <input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
          className="w-full pl-8 pr-3 py-3 text-base font-semibold rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30" />
      </div>
    </div>
  );
}

function EditBillRow({ bill, onChange, onRemove }: { bill: EditBill; onChange: (f: 'name'|'amount', v: string) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#ebeeed] last:border-0">
      <input value={bill.name} onChange={e=>onChange('name',e.target.value)} placeholder="Bill name"
        className="flex-1 text-sm text-[#181c1c] bg-transparent border-0 focus:outline-none focus:bg-[#f1f4f2] rounded-lg px-1 -mx-1 font-medium" />
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
        <input type="number" min="0" value={bill.amount} onChange={e=>onChange('amount',e.target.value)} placeholder="0"
          className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
      </div>
      <button onClick={onRemove} className="text-[#c1c9be] hover:text-[#ba1a1a] transition-colors shrink-0" aria-label="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full border border-dashed border-[#c1c9be] py-2.5 rounded-xl text-sm text-[#717970] hover:border-[#7bae7f] hover:text-[#396940] transition-colors mt-2 font-medium">
      {label}
    </button>
  );
}

function AddPotRow({ owner, onAdd }: { owner: 'person_a' | 'person_b'; onAdd: (owner: 'person_a'|'person_b', potType: 'short_term'|'long_term', name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'short_term'|'long_term'>('short_term');
  const [adding, setAdding] = useState(false);
  if (!open) return (
    <button onClick={()=>setOpen(true)}
      className="w-full border border-dashed border-[#c1c9be] py-2.5 rounded-xl text-sm text-[#717970] hover:border-[#7bae7f] hover:text-[#396940] transition-colors mt-2 font-medium">
      + Add savings / investment pot
    </button>
  );
  return (
    <div className="mt-2 border border-[#c1c9be] rounded-xl p-4 space-y-3">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Pot name (e.g. ISA, Holiday)"
        className="w-full text-sm border border-[#c1c9be] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7bae7f] font-medium" />
      <div className="flex gap-2">
        {(['short_term','long_term'] as const).map(t=>(
          <button key={t} onClick={()=>setType(t)}
            className={`flex-1 text-xs py-2 rounded-full border transition-colors font-bold ${type===t?'bg-[#396940] text-white border-[#396940]':'border-[#c1c9be] text-[#414940] hover:border-[#7bae7f]'}`}>
            {t==='short_term'?'Short-term':'Long-term'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={async()=>{if(!name.trim())return;setAdding(true);await onAdd(owner,type,name.trim());setName('');setOpen(false);setAdding(false);}}
          disabled={!name.trim()||adding}
          className="flex-1 text-sm bg-[#396940] text-white py-2.5 rounded-full disabled:opacity-40 font-bold">
          {adding?'Adding…':'Add pot'}
        </button>
        <button onClick={()=>setOpen(false)} className="text-sm text-[#717970] px-4 py-2.5 rounded-full border border-[#c1c9be] font-medium">Cancel</button>
      </div>
    </div>
  );
}

// ── Inline editable session ─────────────────────────────────────────────────

function InlineEdit({ hh, pots: initPots, existingId, detail, latestLockedDetail, mostRecentSession, householdBills, householdDebts, month, onSaved, onLocked, onPotsChanged }: {
  hh: Household; pots: Pot[];
  existingId: string | null;
  detail: SessionDetail | null;
  latestLockedDetail: SessionDetail | null;
  mostRecentSession: SessionSummary | null;
  householdBills: {id:string;name:string;amount:number;category:string}[];
  householdDebts: {id:string;name:string;amount:number;person:string}[];
  month: string;
  onSaved: () => void;
  onLocked: (id: string) => void;
  onPotsChanged: (pots: Pot[]) => void;
}) {
  const [pots, setPots] = useState<Pot[]>(initPots);
  useEffect(() => { setPots(initPots); }, [initPots]);
  const isPartner = hh.mode === 'partner';
  const splitA = hh.joint_split_a; const splitB = 100 - splitA;

  const [sessionId, setSessionId] = useState<string | null>(existingId);
  const [incomeA, setIncomeA] = useState('');
  const [incomeB, setIncomeB] = useState('');
  const [jointBills, setJointBills] = useState<EditBill[]>([]);
  const [extras, setExtras] = useState<EditExtra[]>([]);
  const [billsA, setBillsA] = useState<EditBill[]>([]);
  const [billsB, setBillsB] = useState<EditBill[]>([]);
  const [debtsA, setDebtsA] = useState<EditBill[]>([]);
  const [debtsB, setDebtsB] = useState<EditBill[]>([]);
  const [spendingA, setSpendingA] = useState('');
  const [spendingB, setSpendingB] = useState('');
  const [travelA, setTravelA] = useState('');
  const [travelB, setTravelB] = useState('');
  const [percentsA, setPercentsA] = useState<Record<string,string>>({});
  const [percentsB, setPercentsB] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const pa: Record<string,string> = {}; const pb: Record<string,string> = {};
    pots.forEach(p => { pa[p.id] = ''; pb[p.id] = ''; });

    if (detail) {
      const s = detail.session;
      setIncomeA(s.income_a ? String(s.income_a) : '');
      setIncomeB(s.income_b ? String(s.income_b) : '');
      setSpendingA(s.spending_a ? String(s.spending_a) : '');
      setSpendingB(s.spending_b ? String(s.spending_b) : '');
      setTravelA(s.travel_a ? String(s.travel_a) : '');
      setTravelB(s.travel_b ? String(s.travel_b) : '');
      setJointBills(detail.bills.filter(b=>b.category==='joint_fixed').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
      setExtras(detail.bills.filter(b=>['joint_extra','joint_extra_a','joint_extra_b'].includes(b.category)).map(b=>({ _key: uid(), name: b.name, amount: String(b.amount), who: b.category==='joint_extra_a'?'a':b.category==='joint_extra_b'?'b':'both' } as EditExtra)));
      setBillsA(detail.bills.filter(b=>b.category==='individual_a').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
      setBillsB(detail.bills.filter(b=>b.category==='individual_b').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
      setDebtsA(detail.bills.filter(b=>b.category==='debt_a').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
      setDebtsB(detail.bills.filter(b=>b.category==='debt_b').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
      const allocs = detail.allocations;
      const dJF = detail.bills.filter(b=>b.category==='joint_fixed').reduce((s,b)=>s+Number(b.amount),0);
      const dExA = detail.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitA/100):b.category==='joint_extra_a'?s+Number(b.amount):s,0);
      const dExB = detail.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitB/100):b.category==='joint_extra_b'?s+Number(b.amount):s,0);
      const dPA = detail.bills.filter(b=>['individual_a','debt_a'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_a)+Number(s.travel_a);
      const dPB = detail.bills.filter(b=>['individual_b','debt_b'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_b)+Number(s.travel_b);
      const dAvA = Number(s.income_a)-(dJF*splitA/100)-dExA-dPA;
      const dAvB = Number(s.income_b)-(dJF*splitB/100)-dExB-dPB;
      if (dAvA > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_a'||pot?.owner==='joint')pa[a.pot_id]=String(Math.round(Number(a.amount)/dAvA*100));});
      if (dAvB > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_b')pb[a.pot_id]=String(Math.round(Number(a.amount)/dAvB*100));});
    } else {
      const src = latestLockedDetail;
      if (src) {
        const s = src.session;
        setIncomeA(s.income_a ? String(s.income_a) : '');
        setIncomeB(s.income_b ? String(s.income_b) : '');
        setSpendingA(s.spending_a ? String(s.spending_a) : '');
        setSpendingB(s.spending_b ? String(s.spending_b) : '');
        setTravelA(s.travel_a ? String(s.travel_a) : '');
        setTravelB(s.travel_b ? String(s.travel_b) : '');
        setJointBills(src.bills.filter(b=>b.category==='joint_fixed').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
        setBillsA(src.bills.filter(b=>b.category==='individual_a').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
        setBillsB(src.bills.filter(b=>b.category==='individual_b').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
        setDebtsA(src.bills.filter(b=>b.category==='debt_a').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
        setDebtsB(src.bills.filter(b=>b.category==='debt_b').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
        const allocs = src.allocations;
        const dJF = src.bills.filter(b=>b.category==='joint_fixed').reduce((s,b)=>s+Number(b.amount),0);
        const dExA = src.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitA/100):b.category==='joint_extra_a'?s+Number(b.amount):s,0);
        const dExB = src.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitB/100):b.category==='joint_extra_b'?s+Number(b.amount):s,0);
        const dPA = src.bills.filter(b=>['individual_a','debt_a'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_a)+Number(s.travel_a);
        const dPB = src.bills.filter(b=>['individual_b','debt_b'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_b)+Number(s.travel_b);
        const dAvA = Number(s.income_a)-(dJF*splitA/100)-dExA-dPA;
        const dAvB = Number(s.income_b)-(dJF*splitB/100)-dExB-dPB;
        if (dAvA > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_a'||pot?.owner==='joint')pa[a.pot_id]=String(Math.round(Number(a.amount)/dAvA*100));});
        if (dAvB > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_b')pb[a.pot_id]=String(Math.round(Number(a.amount)/dAvB*100));});
      } else {
        if (mostRecentSession) {
          setIncomeA(mostRecentSession.income_a > 0 ? String(mostRecentSession.income_a) : '');
          setIncomeB(mostRecentSession.income_b > 0 ? String(mostRecentSession.income_b) : '');
        }
        setSpendingA(hh.default_spending_a > 0 ? String(hh.default_spending_a) : '');
        setSpendingB(hh.default_spending_b > 0 ? String(hh.default_spending_b) : '');
        setTravelA(hh.default_transport_a > 0 ? String(hh.default_transport_a) : '');
        setTravelB(hh.default_transport_b > 0 ? String(hh.default_transport_b) : '');
        if (householdBills.length > 0) {
          setJointBills(householdBills.filter(b=>b.category==='joint_fixed').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
          setBillsA(householdBills.filter(b=>b.category==='individual_a').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
          setBillsB(householdBills.filter(b=>b.category==='individual_b').map(b=>({ _key: uid(), name: b.name, amount: String(b.amount) })));
        }
        if (householdDebts.length > 0) {
          setDebtsA(householdDebts.filter(d=>d.person==='a').map(d=>({ _key: uid(), name: d.name, amount: String(d.amount) })));
          setDebtsB(householdDebts.filter(d=>d.person==='b').map(d=>({ _key: uid(), name: d.name, amount: String(d.amount) })));
        }
      }
    }
    setPercentsA(pa); setPercentsB(pb);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, latestLockedDetail]);

  // Calculations
  const iA = parseFloat(incomeA)||0; const iB = parseFloat(incomeB)||0;
  const jointTotal = jointBills.reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
  const extrasForA = extras.reduce((s,e)=>{const a=parseFloat(e.amount)||0;return e.who==='a'?s+a:e.who==='both'?s+a*(splitA/100):s;},0);
  const extrasForB = extras.reduce((s,e)=>{const a=parseFloat(e.amount)||0;return e.who==='b'?s+a:e.who==='both'?s+a*(splitB/100):s;},0);
  const personalTotalA = billsA.reduce((s,b)=>s+(parseFloat(b.amount)||0),0)+debtsA.reduce((s,d)=>s+(parseFloat(d.amount)||0),0)+(parseFloat(spendingA)||0)+(parseFloat(travelA)||0);
  const personalTotalB = billsB.reduce((s,b)=>s+(parseFloat(b.amount)||0),0)+debtsB.reduce((s,d)=>s+(parseFloat(d.amount)||0),0)+(parseFloat(spendingB)||0)+(parseFloat(travelB)||0);
  const availableA = iA-(jointTotal*splitA/100)-extrasForA-personalTotalA;
  const availableB = iB-(jointTotal*splitB/100)-extrasForB-personalTotalB;
  const jointContribA = jointTotal*(splitA/100)+extrasForA;
  const jointContribB = jointTotal*(splitB/100)+extrasForB;

  const potsA = pots.filter(p=>p.owner==='person_a'||p.owner==='joint');
  const potsB = pots.filter(p=>p.owner==='person_b');
  const potAmountA = (id: string) => availableA*((parseFloat(percentsA[id])||0)/100);
  const potAmountB = (id: string) => availableB*((parseFloat(percentsB[id])||0)/100);
  const allocPctA = potsA.reduce((s,p)=>s+(parseFloat(percentsA[p.id])||0),0);
  const allocPctB = potsB.reduce((s,p)=>s+(parseFloat(percentsB[p.id])||0),0);
  const aReady = Math.abs(100-allocPctA)<0.01;
  const bReady = !isPartner||Math.abs(100-allocPctB)<0.01;
  const canLock = aReady&&bReady&&availableA>=0&&(!isPartner||availableB>=0);
  const totalSavingsA = potsA.reduce((s,p)=>s+potAmountA(p.id),0);
  const totalSavingsB = potsB.reduce((s,p)=>s+potAmountB(p.id),0);
  const totalJointAllExtras = jointTotal + extras.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);

  async function persist(lock: boolean) {
    setSaving(true);
    const allBills = [
      ...jointBills.filter(b=>b.name).map(b=>({ name:b.name, amount:parseFloat(b.amount)||0, category:'joint_fixed' })),
      ...extras.filter(e=>e.name&&e.amount).map(e=>({ name:e.name, amount:parseFloat(e.amount)||0, category:e.who==='both'?'joint_extra':e.who==='a'?'joint_extra_a':'joint_extra_b' })),
      ...billsA.filter(b=>b.name).map(b=>({ name:b.name, amount:parseFloat(b.amount)||0, category:'individual_a' })),
      ...billsB.filter(b=>b.name).map(b=>({ name:b.name, amount:parseFloat(b.amount)||0, category:'individual_b' })),
      ...debtsA.filter(d=>d.name).map(d=>({ name:d.name, amount:parseFloat(d.amount)||0, category:'debt_a' })),
      ...debtsB.filter(d=>d.name).map(d=>({ name:d.name, amount:parseFloat(d.amount)||0, category:'debt_b' })),
    ];
    const allocMap: Record<string,number> = {};
    potsA.forEach(p=>{const amt=potAmountA(p.id);if(amt>0)allocMap[p.id]=(allocMap[p.id]??0)+amt;});
    potsB.forEach(p=>{const amt=potAmountB(p.id);if(amt>0)allocMap[p.id]=(allocMap[p.id]??0)+amt;});
    const allAllocs = Object.entries(allocMap).map(([potId,amount])=>({potId,amount}));
    const payload = { householdId:hh.id, date:`${month}-01`, incomeA:iA, incomeB:iB, startingBalance:0, spendingA:parseFloat(spendingA)||0, spendingB:parseFloat(spendingB)||0, travelA:parseFloat(travelA)||0, travelB:parseFloat(travelB)||0, bills:allBills, allocations:allAllocs, lock };
    let savedId = sessionId;
    if (sessionId) {
      await fetch('/api/payday/sessions', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:sessionId, ...payload }) });
    } else {
      const res = await fetch('/api/payday/sessions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await res.json();
      savedId = data.id;
      setSessionId(data.id);
    }
    setSaving(false);
    if (lock && savedId) onLocked(savedId);
    else if (savedId) { setSaved(true); setTimeout(()=>setSaved(false),2000); onSaved(); }
  }

  async function addPot(owner: 'person_a' | 'person_b', potType: 'short_term' | 'long_term', name: string) {
    const colors = ['#7bae7f','#f4a261','#e9c46a','#3b82f6','#8b5cf6','#14b8a6','#f97316','#6366f1'];
    const color = colors[pots.length % colors.length];
    const res = await fetch('/api/payday/pots', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ householdId:hh.id, name, owner, potType, color, sortOrder:pots.length }) });
    if (res.ok) {
      const newPot: Pot = await res.json();
      const updated = [...pots, newPot];
      setPots(updated);
      onPotsChanged(updated);
      setPercentsA(p=>({...p,[newPot.id]:''}));
      setPercentsB(p=>({...p,[newPot.id]:''}));
    }
  }

  const whoLabel = (who: 'both'|'a'|'b') => who==='both'?'Both':who==='a'?hh.person_a_name:hh.person_b_name;

  return (
    <div className="space-y-8">

      {/* ── Income card — dark charcoal ── */}
      <div className="bg-[#2d3130] text-white rounded-[20px] p-6">
        <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Income this month</div>
        <div className="flex gap-4">
          <EInput label={hh.person_a_name} value={incomeA} onChange={setIncomeA} />
          {isPartner && <EInput label={hh.person_b_name} value={incomeB} onChange={setIncomeB} />}
        </div>
        {(iA>0||iB>0) && (
          <div className="border-t border-white/10 mt-5 pt-4 flex justify-between items-center">
            <span className="text-sm text-white/60 font-medium">Total in</span>
            <span className="text-2xl font-bold">{fmt(iA+iB)}</span>
          </div>
        )}
      </div>

      {/* ── Joint Bills ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[#181c1c] flex items-center gap-2">
          <span>👥</span> Joint Bills
        </h2>
        <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
          <p className="text-sm text-[#717970] mb-4">Shared bills split by your ratio</p>
          {isPartner && (iA>0||iB>0) && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <ActionCard label={`${hh.person_a_name} transfers`} amount={jointContribA} />
              <ActionCard label={`${hh.person_b_name} transfers`} amount={jointContribB} />
            </div>
          )}
          <SLabel>Fixed bills</SLabel>
          {jointBills.map(b => (
            <EditBillRow key={b._key} bill={b}
              onChange={(f,v)=>setJointBills(l=>l.map(x=>x._key===b._key?{...x,[f]:v}:x))}
              onRemove={()=>setJointBills(l=>l.filter(x=>x._key!==b._key))} />
          ))}
          <AddBtn label="+ Add joint bill" onClick={()=>setJointBills(l=>[...l,{_key:uid(),name:'',amount:''}])} />

          <div className="mt-5">
            <SLabel>One-offs this month</SLabel>
            {extras.map(e => (
              <div key={e._key} className="flex items-center gap-3 py-3 border-b border-[#ebeeed] last:border-0">
                <input value={e.name} onChange={ev=>setExtras(l=>l.map(x=>x._key===e._key?{...x,name:ev.target.value}:x))} placeholder="Description"
                  className="flex-1 text-sm text-[#181c1c] bg-transparent border-0 focus:outline-none focus:bg-[#f1f4f2] rounded-lg px-1 -mx-1 font-medium" />
                <div className="relative w-24 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
                  <input type="number" min="0" value={e.amount} onChange={ev=>setExtras(l=>l.map(x=>x._key===e._key?{...x,amount:ev.target.value}:x))} placeholder="0"
                    className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                </div>
                {isPartner && (
                  <div className="flex rounded-lg border border-[#c1c9be] overflow-hidden shrink-0">
                    {(['both','a','b'] as const).map(w => (
                      <button key={w} onClick={()=>setExtras(l=>l.map(x=>x._key===e._key?{...x,who:w}:x))}
                        className={`px-2 py-1.5 text-xs font-bold transition-colors ${e.who===w?'bg-[#396940] text-white':'text-[#414940] hover:bg-[#f1f4f2]'}`}>
                        {whoLabel(w)}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={()=>setExtras(l=>l.filter(x=>x._key!==e._key))} className="text-[#c1c9be] hover:text-[#ba1a1a] transition-colors shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
            <AddBtn label="+ Add one-off" onClick={()=>setExtras(l=>[...l,{_key:uid(),name:'',amount:'',who:'both'}])} />
          </div>
        </div>
      </div>

      {/* ── Per-person outgoings ── */}
      <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}>
        {/* Person A */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[#181c1c] flex items-center justify-between">
            <span className="flex items-center gap-2"><span>👤</span> {hh.person_a_name}</span>
            {iA>0 && <span className="text-sm font-medium text-[#717970]">{fmt(iA)} income</span>}
          </h2>
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] space-y-4">
            <SLabel>Personal bills</SLabel>
            {billsA.map(b=><EditBillRow key={b._key} bill={b} onChange={(f,v)=>setBillsA(l=>l.map(x=>x._key===b._key?{...x,[f]:v}:x))} onRemove={()=>setBillsA(l=>l.filter(x=>x._key!==b._key))} />)}
            <AddBtn label="+ Add personal bill" onClick={()=>setBillsA(l=>[...l,{_key:uid(),name:'',amount:''}])} />
            {debtsA.length > 0 && (
              <>
                <SLabel>Debt repayments</SLabel>
                {debtsA.map(d=><EditBillRow key={d._key} bill={d} onChange={(f,v)=>setDebtsA(l=>l.map(x=>x._key===d._key?{...x,[f]:v}:x))} onRemove={()=>setDebtsA(l=>l.filter(x=>x._key!==d._key))} />)}
              </>
            )}
            <AddBtn label="+ Add debt repayment" onClick={()=>setDebtsA(l=>[...l,{_key:uid(),name:'',amount:''}])} />
            <SLabel>Lifestyle</SLabel>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-[#ebeeed]">
                <span className="text-sm text-[#414940] font-medium">Spending Money</span>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
                  <input type="number" min="0" value={spendingA} onChange={e=>setSpendingA(e.target.value)} placeholder="0"
                    className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[#414940] font-medium">Travel</span>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
                  <input type="number" min="0" value={travelA} onChange={e=>setTravelA(e.target.value)} placeholder="0"
                    className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                </div>
              </div>
            </div>
            {personalTotalA>0 && (
              <div className="flex justify-between pt-2 border-t border-[#ebeeed]">
                <span className="text-sm text-[#414940] font-medium">Personal total</span>
                <span className="text-sm font-bold text-[#396940]">{fmt(personalTotalA)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Person B */}
        {isPartner && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-[#181c1c] flex items-center justify-between">
              <span className="flex items-center gap-2"><span>👤</span> {hh.person_b_name}</span>
              {iB>0 && <span className="text-sm font-medium text-[#717970]">{fmt(iB)} income</span>}
            </h2>
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] space-y-4">
              <SLabel>Personal bills</SLabel>
              {billsB.map(b=><EditBillRow key={b._key} bill={b} onChange={(f,v)=>setBillsB(l=>l.map(x=>x._key===b._key?{...x,[f]:v}:x))} onRemove={()=>setBillsB(l=>l.filter(x=>x._key!==b._key))} />)}
              <AddBtn label="+ Add personal bill" onClick={()=>setBillsB(l=>[...l,{_key:uid(),name:'',amount:''}])} />
              {debtsB.length > 0 && (
                <>
                  <SLabel>Debt repayments</SLabel>
                  {debtsB.map(d=><EditBillRow key={d._key} bill={d} onChange={(f,v)=>setDebtsB(l=>l.map(x=>x._key===d._key?{...x,[f]:v}:x))} onRemove={()=>setDebtsB(l=>l.filter(x=>x._key!==d._key))} />)}
                </>
              )}
              <AddBtn label="+ Add debt repayment" onClick={()=>setDebtsB(l=>[...l,{_key:uid(),name:'',amount:''}])} />
              <SLabel>Lifestyle</SLabel>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-[#ebeeed]">
                  <span className="text-sm text-[#414940] font-medium">Spending Money</span>
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
                    <input type="number" min="0" value={spendingB} onChange={e=>setSpendingB(e.target.value)} placeholder="0"
                      className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-[#414940] font-medium">Travel</span>
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">£</span>
                    <input type="number" min="0" value={travelB} onChange={e=>setTravelB(e.target.value)} placeholder="0"
                      className="w-full pl-7 pr-2 py-2 text-sm border border-[#c1c9be] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                  </div>
                </div>
              </div>
              {personalTotalB>0 && (
                <div className="flex justify-between pt-2 border-t border-[#ebeeed]">
                  <span className="text-sm text-[#414940] font-medium">Personal total</span>
                  <span className="text-sm font-bold text-[#396940]">{fmt(personalTotalB)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Savings ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[#181c1c] flex items-center gap-2"><span>🏦</span> Savings</h2>
        <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><span>💰</span><span className="font-bold text-[#181c1c]">{hh.person_a_name}&apos;s savings</span></div>
              <span className="text-xs text-[#717970] font-medium">Available: {fmt(availableA)}</span>
            </div>
            <div className="space-y-2">
              {pots.filter(p=>p.pot_type==='short_term'&&(p.owner==='person_a'||p.owner==='joint')).length>0 && <SLabel>Short-term goals</SLabel>}
              {pots.filter(p=>p.pot_type==='short_term'&&(p.owner==='person_a'||p.owner==='joint')).map(p => {
                const pct = parseFloat(percentsA[p.id])||0; const amount = availableA*(pct/100);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-[#f1f4f2] rounded-xl px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                    <span className="text-sm flex-1 text-[#181c1c] truncate font-medium">{p.name}{p.account_type && ACCT_LABELS[p.account_type] && <span className="ml-1 text-xs text-[#717970]">· {ACCT_LABELS[p.account_type]}</span>}</span>
                    <div className="relative w-20 shrink-0">
                      <input type="number" min="0" max="100" value={percentsA[p.id]??''} onChange={e=>setPercentsA(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                        className="w-full pr-7 pl-2 py-1.5 text-sm rounded-lg border border-[#c1c9be] focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">%</span>
                    </div>
                    <span className="text-sm text-[#414940] w-20 text-right tabular-nums shrink-0 font-semibold">{amount>0?fmt(amount):'—'}</span>
                  </div>
                );
              })}
              {pots.filter(p=>p.pot_type!=='short_term'&&(p.owner==='person_a'||p.owner==='joint')).length>0 && <SLabel>Long-term savings</SLabel>}
              {pots.filter(p=>p.pot_type!=='short_term'&&(p.owner==='person_a'||p.owner==='joint')).map(p => {
                const pct = parseFloat(percentsA[p.id])||0; const amount = availableA*(pct/100);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-[#f1f4f2] rounded-xl px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                    <span className="text-sm flex-1 text-[#181c1c] truncate font-medium">{p.name}{p.account_type && ACCT_LABELS[p.account_type] && <span className="ml-1 text-xs text-[#717970]">· {ACCT_LABELS[p.account_type]}</span>}</span>
                    <div className="relative w-20 shrink-0">
                      <input type="number" min="0" max="100" value={percentsA[p.id]??''} onChange={e=>setPercentsA(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                        className="w-full pr-7 pl-2 py-1.5 text-sm rounded-lg border border-[#c1c9be] focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">%</span>
                    </div>
                    <span className="text-sm text-[#414940] w-20 text-right tabular-nums shrink-0 font-semibold">{amount>0?fmt(amount):'—'}</span>
                  </div>
                );
              })}
            </div>
            <AddPotRow owner="person_a" onAdd={addPot} />
            <div className={`flex justify-between text-xs mt-3 font-bold ${aReady?'text-[#396940]':'text-[#717970]'}`}>
              <span>{Math.round(allocPctA)}% allocated</span>
              <span>{aReady?'✓ All allocated':`${(100-allocPctA).toFixed(0)}% remaining`}</span>
            </div>
          </div>

          {isPartner && (
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><span>💰</span><span className="font-bold text-[#181c1c]">{hh.person_b_name}&apos;s savings</span></div>
                <span className="text-xs text-[#717970] font-medium">Available: {fmt(availableB)}</span>
              </div>
              <div className="space-y-2">
                {pots.filter(p=>p.pot_type==='short_term'&&p.owner==='person_b').length>0 && <SLabel>Short-term goals</SLabel>}
                {pots.filter(p=>p.pot_type==='short_term'&&p.owner==='person_b').map(p => {
                  const pct = parseFloat(percentsB[p.id])||0; const amount = availableB*(pct/100);
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-[#f1f4f2] rounded-xl px-3 py-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                      <span className="text-sm flex-1 text-[#181c1c] truncate font-medium">{p.name}{p.account_type && ACCT_LABELS[p.account_type] && <span className="ml-1 text-xs text-[#717970]">· {ACCT_LABELS[p.account_type]}</span>}</span>
                      <div className="relative w-20 shrink-0">
                        <input type="number" min="0" max="100" value={percentsB[p.id]??''} onChange={e=>setPercentsB(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                          className="w-full pr-7 pl-2 py-1.5 text-sm rounded-lg border border-[#c1c9be] focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">%</span>
                      </div>
                      <span className="text-sm text-[#414940] w-20 text-right tabular-nums shrink-0 font-semibold">{amount>0?fmt(amount):'—'}</span>
                    </div>
                  );
                })}
                {pots.filter(p=>p.pot_type!=='short_term'&&p.owner==='person_b').length>0 && <SLabel>Long-term savings</SLabel>}
                {pots.filter(p=>p.pot_type!=='short_term'&&p.owner==='person_b').map(p => {
                  const pct = parseFloat(percentsB[p.id])||0; const amount = availableB*(pct/100);
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-[#f1f4f2] rounded-xl px-3 py-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                      <span className="text-sm flex-1 text-[#181c1c] truncate font-medium">{p.name}{p.account_type && ACCT_LABELS[p.account_type] && <span className="ml-1 text-xs text-[#717970]">· {ACCT_LABELS[p.account_type]}</span>}</span>
                      <div className="relative w-20 shrink-0">
                        <input type="number" min="0" max="100" value={percentsB[p.id]??''} onChange={e=>setPercentsB(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                          className="w-full pr-7 pl-2 py-1.5 text-sm rounded-lg border border-[#c1c9be] focus:outline-none focus:ring-2 focus:ring-[#7bae7f] text-right font-semibold" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717970] text-xs font-medium">%</span>
                      </div>
                      <span className="text-sm text-[#414940] w-20 text-right tabular-nums shrink-0 font-semibold">{amount>0?fmt(amount):'—'}</span>
                    </div>
                  );
                })}
              </div>
              <AddPotRow owner="person_b" onAdd={addPot} />
              <div className={`flex justify-between text-xs mt-3 font-bold ${bReady?'text-[#396940]':'text-[#717970]'}`}>
                <span>{Math.round(allocPctB)}% allocated</span>
                <span>{bReady?'✓ All allocated':`${(100-allocPctB).toFixed(0)}% remaining`}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview ── */}
      {(iA>0||iB>0) && (
        <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
          <div className="text-base font-bold text-[#181c1c] mb-5">Preview</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-[#414940] font-medium">Total income</span><span className="font-bold text-[#181c1c]">{fmt(iA+iB)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#414940] font-medium">Joint outgoings</span><span className="font-bold text-[#ba1a1a]">−{fmt(totalJointAllExtras)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#414940] font-medium">{hh.person_a_name}&apos;s personal</span><span className="font-bold text-[#ba1a1a]">−{fmt(personalTotalA)}</span></div>
            {isPartner && <div className="flex justify-between text-sm"><span className="text-[#414940] font-medium">{hh.person_b_name}&apos;s personal</span><span className="font-bold text-[#ba1a1a]">−{fmt(personalTotalB)}</span></div>}
          </div>
          {(totalSavingsA+totalSavingsB)>0 && (
            <div className="flex justify-between items-baseline border-t border-[#ebeeed] mt-5 pt-4">
              <span className="text-base font-bold text-[#181c1c]">Saving this month</span>
              <span className="text-2xl font-bold text-[#396940]">{fmt(totalSavingsA+totalSavingsB)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom padding for sticky footer ── */}
      <div className="h-28" />

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#f7faf8]/95 backdrop-blur-sm border-t border-[#e6e9e7] px-5 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {!canLock && (aReady===false||bReady===false) && (
            <div className="text-xs text-[#8e4e14] text-center font-medium">
              {!aReady && <span>{hh.person_a_name}: {(100-allocPctA).toFixed(0)}% still to allocate</span>}
              {isPartner&&!bReady&&!aReady && <span> · </span>}
              {isPartner&&!bReady && <span>{hh.person_b_name}: {(100-allocPctB).toFixed(0)}% still to allocate</span>}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={()=>persist(false)} disabled={saving}
              className="flex-1 border-2 border-[#c1c9be] py-3.5 rounded-full text-sm font-bold text-[#414940] hover:border-[#7bae7f] hover:text-[#396940] disabled:opacity-40 transition-colors bg-white">
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save draft'}
            </button>
            <button onClick={()=>persist(true)} disabled={!canLock||saving}
              className="flex-1 bg-[#396940] text-white py-3.5 rounded-full font-bold disabled:opacity-40 hover:bg-[#2d5533] transition-colors">
              {saving ? 'Saving…' : 'Lock in 🔒'}
            </button>
          </div>
          <p className="text-center text-xs text-[#717970] italic pt-1">
            &ldquo;Financial wellness is a journey, not a destination. You&apos;re doing great!&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared display sub-components ──────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-[#717970] uppercase tracking-wider font-bold pt-1 pb-1">{children}</div>;
}

function ActionCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-xl p-4 bg-[#ebeeed] border-l-4 border-[#7bae7f]">
      <div className="text-xs text-[#414940] mb-1.5 font-medium">{label}</div>
      <div className="text-xl font-bold text-[#396940]">{fmt(amount)}</div>
    </div>
  );
}

function BillRow({ name, amount, splitA, splitB, tag }: { name: string; amount: number; splitA?: string; splitB?: string; tag?: string }) {
  return (
    <div className="py-3 border-b border-[#ebeeed] last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#181c1c] font-medium">{name}</span>
          {tag && <span className="text-xs bg-[#ebeeed] text-[#414940] px-2 py-0.5 rounded-full font-medium">{tag}</span>}
        </div>
        <span className="text-sm font-bold text-[#181c1c]">{fmt(amount)}</span>
      </div>
      {(splitA||splitB) && (
        <div className="flex gap-4 mt-0.5">
          {splitA && <span className="text-xs text-[#717970]">{splitA}</span>}
          {splitB && <span className="text-xs text-[#717970]">{splitB}</span>}
        </div>
      )}
    </div>
  );
}

function PersonCard({ name, income, jointContrib, personalBills, debts, spending, travel, personalTotal, savingsTotal }: {
  name: string; income: number; jointContrib: number; personalBills: SessionBill[]; debts: SessionBill[]; spending: number; travel: number; personalTotal: number; savingsTotal: number;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-[#181c1c] flex items-center justify-between">
        <span className="flex items-center gap-2"><span>👤</span> {name}</span>
        <span className="text-sm font-medium text-[#717970]">{fmt(income)} income</span>
      </h2>
      <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)] space-y-3">
        <div className="bg-[#f1f4f2] rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-[#396940] font-bold">Transfer to joint account</span>
          <span className="text-base font-bold text-[#396940]">{fmt(jointContrib)}</span>
        </div>
        {(personalBills.length>0||debts.length>0||spending>0||travel>0) && (
          <>
            <SLabel>Personal outgoings</SLabel>
            {personalBills.map(b=>(
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-[#ebeeed] last:border-0">
                <span className="text-sm text-[#414940] font-medium">{b.name}</span>
                <span className="text-sm font-bold">{fmt(Number(b.amount))}</span>
              </div>
            ))}
            {debts.map(d=>(
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-[#ebeeed] last:border-0">
                <span className="text-sm text-[#414940] flex items-center gap-1.5 font-medium">
                  <span className="text-xs bg-[#ffdcc4] text-[#8e4e14] px-1.5 py-0.5 rounded-full font-bold">debt</span>{d.name}
                </span>
                <span className="text-sm font-bold">{fmt(Number(d.amount))}</span>
              </div>
            ))}
            {spending>0 && <div className="flex items-center justify-between py-2 border-b border-[#ebeeed] last:border-0"><span className="text-sm text-[#414940] font-medium">Spending money</span><span className="text-sm font-bold">{fmt(spending)}</span></div>}
            {travel>0 && <div className="flex items-center justify-between py-2 border-b border-[#ebeeed]"><span className="text-sm text-[#414940] font-medium">Travel</span><span className="text-sm font-bold">{fmt(travel)}</span></div>}
            <div className="flex justify-between pt-1">
              <span className="text-sm text-[#414940] font-medium">Personal total</span>
              <span className="text-sm font-bold text-[#396940]">{fmt(personalTotal)}</span>
            </div>
          </>
        )}
        <div className="border-t border-[#ebeeed] pt-3">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-[#414940]">Remainder after savings</span>
            <span className={income-jointContrib-personalTotal-savingsTotal<-0.01?'text-[#ba1a1a]':'text-[#181c1c]'}>
              {fmt(income-jointContrib-personalTotal-savingsTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SavingsCard({ name, allocs, potMap, total, available }: { name: string; allocs: Allocation[]; potMap: Record<string,Pot>; total: number; available: number }) {
  return (
    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_16px_rgba(57,105,64,0.07)]">
      <div className="flex items-center gap-2 mb-1"><span>💰</span><h3 className="font-bold text-[#181c1c]">{name}&apos;s savings</h3></div>
      <p className="text-xs text-[#717970] mb-4">Transfers to make this month</p>
      <div className="space-y-0">
        {allocs.map(a=>{
          const pot=potMap[a.pot_id]; if(!pot) return null;
          const pct=available>0?Math.round(Number(a.amount)/available*100):0;
          return (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-[#ebeeed] last:border-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:pot.color}} />
              <span className="text-sm flex-1 text-[#181c1c] font-medium">{pot.name}</span>
              {pct>0&&<span className="text-xs text-[#717970] w-10 text-right font-medium">{pct}%</span>}
              <span className="text-sm font-bold text-[#396940]">{fmt(Number(a.amount))}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-sm font-bold border-t border-[#ebeeed] pt-3 mt-1">
        <span className="text-[#414940]">Total to save</span>
        <span className="text-[#396940]">{fmt(total)}</span>
      </div>
    </div>
  );
}

function Recap({ label, value, negative, positive, bold }: { label: string; value: string; negative?: boolean; positive?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold?'font-bold':''}`}>
      <span className="text-[#414940] font-medium">{label}</span>
      <span className={positive?'text-[#396940] font-bold':negative?'text-[#ba1a1a] font-bold':'font-bold text-[#181c1c]'}>
        {negative?'−':''}{value}
      </span>
    </div>
  );
}

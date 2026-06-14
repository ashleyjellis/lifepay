'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
interface Pot { id: string; name: string; color: string; owner: string; pot_type: string; }
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

  useEffect(() => {
    async function load() {
      try {
        await fetch('/api/payday/init', { method: 'POST' });
        const hRes = await fetch('/api/payday/households');
        if (hRes.status === 401) { router.replace('/payday/login'); return; }
        const hh = hRes.ok ? await hRes.json() : null;
        if (!hh) { router.replace('/payday/setup'); return; }
        setHousehold(hh);
        const [sRes, pRes] = await Promise.all([fetch(`/api/payday/sessions?householdId=${hh.id}`), fetch(`/api/payday/pots?householdId=${hh.id}`)]);
        const all: SessionSummary[] = sRes.ok ? await sRes.json() : [];
        const pts: Pot[] = pRes.ok ? await pRes.json() : [];
        setSessions(all.sort((a, b) => b.date.localeCompare(a.date)));
        setPots(pts);
        const latestLocked = all.filter(s => s.locked_at).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (latestLocked) setSelectedMonth(latestLocked.date.slice(0, 7));
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [router]);

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

  if (loading || !household) return <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]"><div className="text-gray-400 text-sm">Loading...</div></div>;

  const hh = household;
  const isPartner = hh.mode === 'partner';
  const curYM = toYM(new Date());
  const editableMonths = getEditableMonths();
  const months = generateMonths(sessions.map(s => s.date));
  const selectedSession = sessions.find(s => s.date.startsWith(selectedMonth));
  const isLocked = !!selectedSession?.locked_at;
  const isDraft = !!selectedSession && !selectedSession.locked_at;
  const isEditable = editableMonths.includes(selectedMonth) && !isLocked;
  // Pre-populate future months from latest locked session
  const latestLockedDetail = detail; // loaded for all sessions including for pre-pop
  const latestLockedSession = sessions.filter(s => s.locked_at).sort((a,b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div><div className="text-xs text-gray-400">{hh.name}</div><div className="font-semibold text-sm">Payday</div></div>
          <div className="flex gap-3 items-center">
            <Link href="/payday/history" className="text-xs text-gray-400 hover:text-gray-600">History</Link>
            <Link href="/payday/setup" className="text-xs text-gray-400 hover:text-gray-600">Setup</Link>
            <button onClick={async () => { await fetch('/api/payday/auth/logout', { method: 'POST' }); router.push('/payday/login'); }} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        {/* Month pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4">
          {months.map(ym => {
            const sess = sessions.find(s => s.date.startsWith(ym));
            const locked = !!sess?.locked_at; const draft = !!sess && !sess.locked_at; const selected = ym === selectedMonth;
            return (
              <button key={ym} onClick={() => setSelectedMonth(ym)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors ${selected ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${locked ? 'bg-emerald-400' : draft ? 'bg-amber-400' : editableMonths.includes(ym) ? 'bg-blue-300' : selected ? 'bg-gray-400' : 'bg-gray-300'}`} />
                {monthShort(ym)}
              </button>
            );
          })}
        </div>

        <div className="pb-10 space-y-6">
          {/* Month heading */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-gray-900">{monthLabel(selectedMonth)}</div>
              <div className={`text-xs mt-0.5 font-medium ${isLocked ? 'text-emerald-600' : isDraft ? 'text-amber-600' : isEditable ? 'text-blue-500' : 'text-gray-400'}`}>
                {isLocked ? '● Locked in' : isDraft ? '● In progress' : isEditable ? '● Plan ahead' : 'No payday recorded'}
              </div>
            </div>
          </div>

          {detailLoading && <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>}

          {/* Locked session — read-only dashboard */}
          {isLocked && !detailLoading && detail && <LockedDashboard hh={hh} pots={pots} detail={detail} sessionId={selectedSession!.id} />}

          {/* Draft / new / future editable session — inline editable */}
          {isEditable && !detailLoading && (
            <InlineEdit
              hh={hh} pots={pots}
              existingId={selectedSession?.id ?? null}
              detail={isDraft ? detail : null}
              latestLockedDetail={(!selectedSession && selectedMonth !== curYM) ? latestLockedDetail : null}
              month={selectedMonth}
              onSaved={(newId) => {
                refreshSessions(hh);
                loadDetail(newId);
              }}
              onLocked={(newId) => {
                refreshSessions(hh);
                setSelectedMonth(selectedMonth);
                loadDetail(newId);
              }}
              onPotsChanged={(newPots) => setPots(newPots)}
            />
          )}

          {/* Empty past month */}
          {!selectedSession && !isEditable && !detailLoading && (
            <div className="text-center py-16 text-gray-400"><div className="text-3xl mb-3">📅</div><p className="text-sm">No payday recorded for this month.</p></div>
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
          <div className="flex-1 text-center"><div className="text-xs text-gray-400 mb-0.5">{hh.person_a_name}</div><div className="text-lg font-semibold">{fmt(Number(sess.income_a))}</div></div>
          {isPartner && <><div className="w-px bg-white/10" /><div className="flex-1 text-center"><div className="text-xs text-gray-400 mb-0.5">{hh.person_b_name}</div><div className="text-lg font-semibold">{fmt(Number(sess.income_b))}</div></div></>}
          <div className="w-px bg-white/10" />
          <div className="flex-1 text-center"><div className="text-xs text-gray-400 mb-0.5">Total in</div><div className="text-lg font-semibold">{fmt(Number(sess.income_a)+Number(sess.income_b))}</div></div>
        </div>
      </div>
      <DSection title="Joint account" icon="🏦" subtitle={isPartner?"Transfer your share in — covers all shared bills":"Household bills for the month"}>
        {isPartner && <div className="grid grid-cols-2 gap-3 mb-4"><ActionCard label={`${hh.person_a_name} transfers`} amount={jointContribA} /><ActionCard label={`${hh.person_b_name} transfers`} amount={jointContribB} /></div>}
        <div className="space-y-1">
          {jointFixed.length>0 && <><SLabel>Fixed bills</SLabel>{jointFixed.map(b=><BillRow key={b.id} name={b.name} amount={Number(b.amount)} splitA={isPartner?`${hh.person_a_name}: ${fmt(Number(b.amount)*splitA/100)}`:undefined} splitB={isPartner?`${hh.person_b_name}: ${fmt(Number(b.amount)*splitB/100)}`:undefined} />)}</>}
          {jointExtras.length>0 && <><SLabel>One-offs this month</SLabel>{jointExtras.map(b=>{const who=b.category==='joint_extra_a'?hh.person_a_name:b.category==='joint_extra_b'?hh.person_b_name:undefined;return <BillRow key={b.id} name={b.name} amount={Number(b.amount)} tag={who?`${who} only`:undefined} />;})}</>}
        </div>
        <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mt-3"><span className="text-gray-600">Total joint outgoings</span><span>{fmt(jointFixedTotal+jointExtras.reduce((s,b)=>s+Number(b.amount),0))}</span></div>
      </DSection>
      <div className={isPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
        <PersonCard name={hh.person_a_name} income={Number(sess.income_a)} jointContrib={jointContribA} personalBills={personalBillsA} debts={debtsA} spending={Number(sess.spending_a)} travel={Number(sess.travel_a)} personalTotal={personalTotalA} savingsTotal={totalSavingsA} />
        {isPartner && <PersonCard name={hh.person_b_name} income={Number(sess.income_b)} jointContrib={jointContribB} personalBills={personalBillsB} debts={debtsB} spending={Number(sess.spending_b)} travel={Number(sess.travel_b)} personalTotal={personalTotalB} savingsTotal={totalSavingsB} />}
      </div>
      {(potAllocsA.length>0||potAllocsB.length>0) && (
        <div className={isPartner?'grid grid-cols-1 md:grid-cols-2 gap-4':''}>
          {potAllocsA.length>0 && <SavingsCard name={hh.person_a_name} allocs={potAllocsA} potMap={potMap} total={totalSavingsA} available={availableA} />}
          {isPartner&&potAllocsB.length>0 && <SavingsCard name={hh.person_b_name} allocs={potAllocsB} potMap={potMap} total={totalSavingsB} available={availableB} />}
        </div>
      )}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold text-gray-700 mb-3">Month at a glance</div>
        <Recap label="Total income" value={fmt(Number(sess.income_a)+Number(sess.income_b))} />
        <Recap label="Joint outgoings" value={fmt(jointFixedTotal+jointExtras.reduce((s,b)=>s+Number(b.amount),0))} negative />
        <Recap label={`${hh.person_a_name}'s personal`} value={fmt(personalTotalA)} negative />
        {isPartner && <Recap label={`${hh.person_b_name}'s personal`} value={fmt(personalTotalB)} negative />}
        <Recap label="Saved / invested" value={fmt(totalSavingsA+totalSavingsB)} positive />
        <div className="border-t border-gray-100 pt-3"><Recap label="Savings rate" value={`${Math.round(((totalSavingsA+totalSavingsB)/(Number(sess.income_a)+Number(sess.income_b)))*100)}%`} positive bold /></div>
      </div>
      <div className="pb-4">
        <Link href={`/payday/dashboard/${sessionId}`} className="block border border-gray-200 py-3 rounded-xl text-sm font-medium text-center hover:border-gray-400 transition-colors">Open full dashboard →</Link>
      </div>
    </>
  );
}

// ── Inline editable session ─────────────────────────────────────────────────

interface EditBill { _key: string; name: string; amount: string; }
interface EditExtra { _key: string; name: string; amount: string; who: 'both' | 'a' | 'b'; }

function InlineEdit({ hh, pots: initPots, existingId, detail, latestLockedDetail, month, onSaved, onLocked, onPotsChanged }: {
  hh: Household; pots: Pot[];
  existingId: string | null;
  detail: SessionDetail | null;
  latestLockedDetail: SessionDetail | null;
  month: string;
  onSaved: (id: string) => void;
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

  useEffect(() => {
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
      // Back-calc savings % from allocations
      const allocs = detail.allocations;
      const dJF = detail.bills.filter(b=>b.category==='joint_fixed').reduce((s,b)=>s+Number(b.amount),0);
      const dExA = detail.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitA/100):b.category==='joint_extra_a'?s+Number(b.amount):s,0);
      const dExB = detail.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitB/100):b.category==='joint_extra_b'?s+Number(b.amount):s,0);
      const dPA = detail.bills.filter(b=>['individual_a','debt_a'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_a)+Number(s.travel_a);
      const dPB = detail.bills.filter(b=>['individual_b','debt_b'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_b)+Number(s.travel_b);
      const dAvA = Number(s.income_a)-(dJF*splitA/100)-dExA-dPA;
      const dAvB = Number(s.income_b)-(dJF*splitB/100)-dExB-dPB;
      if (dAvA > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_a')pa[a.pot_id]=String(Math.round(Number(a.amount)/dAvA*100));});
      if (dAvB > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_b')pb[a.pot_id]=String(Math.round(Number(a.amount)/dAvB*100));});
    } else {
      // No draft — try to pre-fill from latest locked session
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
        // Back-calc savings %
        const allocs = src.allocations;
        const dJF = src.bills.filter(b=>b.category==='joint_fixed').reduce((s,b)=>s+Number(b.amount),0);
        const dExA = src.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitA/100):b.category==='joint_extra_a'?s+Number(b.amount):s,0);
        const dExB = src.bills.reduce((s,b)=>b.category==='joint_extra'?s+Number(b.amount)*(splitB/100):b.category==='joint_extra_b'?s+Number(b.amount):s,0);
        const dPA = src.bills.filter(b=>['individual_a','debt_a'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_a)+Number(s.travel_a);
        const dPB = src.bills.filter(b=>['individual_b','debt_b'].includes(b.category)).reduce((s,b)=>s+Number(b.amount),0)+Number(s.spending_b)+Number(s.travel_b);
        const dAvA = Number(s.income_a)-(dJF*splitA/100)-dExA-dPA;
        const dAvB = Number(s.income_b)-(dJF*splitB/100)-dExB-dPB;
        if (dAvA > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_a')pa[a.pot_id]=String(Math.round(Number(a.amount)/dAvA*100));});
        if (dAvB > 0) allocs.forEach(a=>{const pot=pots.find(p=>p.id===a.pot_id);if(pot?.owner==='person_b')pb[a.pot_id]=String(Math.round(Number(a.amount)/dAvB*100));});
      } else {
        // Truly fresh — pre-fill from household defaults
        setSpendingA(hh.default_spending_a > 0 ? String(hh.default_spending_a) : '');
        setSpendingB(hh.default_spending_b > 0 ? String(hh.default_spending_b) : '');
        setTravelA(hh.default_transport_a > 0 ? String(hh.default_transport_a) : '');
        setTravelB(hh.default_transport_b > 0 ? String(hh.default_transport_b) : '');
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

  const potsA = pots.filter(p=>p.owner==='person_a');
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
    else if (savedId) { setSaved(true); setTimeout(()=>setSaved(false),2000); onSaved(savedId); }
  }

  async function addPot(owner: 'person_a' | 'person_b', potType: 'short_term' | 'long_term', name: string) {
    const colors = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#f97316','#14b8a6'];
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

  function AddPotRow({ owner, onAdd }: { owner: 'person_a' | 'person_b'; onAdd: (owner: 'person_a'|'person_b', potType: 'short_term'|'long_term', name: string) => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState<'short_term'|'long_term'>('short_term');
    const [adding, setAdding] = useState(false);
    if (!open) return <button onClick={()=>setOpen(true)} className="w-full border border-dashed border-gray-200 py-2 rounded-xl text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors mt-1">+ Add savings / investment pot</button>;
    return (
      <div className="mt-1 border border-gray-200 rounded-xl p-3 space-y-2">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Pot name (e.g. ISA, Holiday)" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        <div className="flex gap-2">
          {(['short_term','long_term'] as const).map(t=>(
            <button key={t} onClick={()=>setType(t)} className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${type===t?'bg-[#1a1a1a] text-white border-[#1a1a1a]':'border-gray-200 text-gray-500'}`}>{t==='short_term'?'Short-term':'Long-term'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={async()=>{if(!name.trim())return;setAdding(true);await onAdd(owner,type,name.trim());setName('');setOpen(false);setAdding(false);}} disabled={!name.trim()||adding} className="flex-1 text-xs bg-[#1a1a1a] text-white py-1.5 rounded-lg disabled:opacity-40">{adding?'Adding…':'Add pot'}</button>
          <button onClick={()=>setOpen(false)} className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">Cancel</button>
        </div>
      </div>
    );
  }

  function EInput({ label, value, onChange, dark }: { label: string; value: string; onChange: (v: string) => void; dark?: boolean }) {
    return (
      <div className="flex-1">
        <div className={`text-xs mb-1 ${dark?'text-gray-400':'text-gray-500'}`}>{label}</div>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${dark?'text-gray-400':'text-gray-400'}`}>£</span>
          <input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
            className={`w-full pl-7 pr-2 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 ${dark?'bg-white/10 border border-white/20 text-white focus:ring-white/30':'border border-gray-200 bg-white focus:ring-gray-900'}`} />
        </div>
      </div>
    );
  }

  function EditBillRow({ bill, onChange, onRemove }: { bill: EditBill; onChange: (f: 'name'|'amount', v: string) => void; onRemove: () => void }) {
    return (
      <div className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
        <input value={bill.name} onChange={e=>onChange('name',e.target.value)} placeholder="Name"
          className="flex-1 text-sm text-gray-700 bg-transparent border-0 focus:outline-none focus:bg-gray-50 rounded px-1 -mx-1" />
        <div className="relative w-28 shrink-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span>
          <input type="number" min="0" value={bill.amount} onChange={e=>onChange('amount',e.target.value)} placeholder="0"
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" />
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none w-5">×</button>
      </div>
    );
  }

  function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
    return <button onClick={onClick} className="w-full border border-dashed border-gray-200 py-2 rounded-xl text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors mt-1">{label}</button>;
  }

  const whoLabel = (who: 'both'|'a'|'b') => who==='both'?'Both':who==='a'?hh.person_a_name:hh.person_b_name;

  return (
    <div className="space-y-6">
      {/* Income */}
      <div className="bg-[#1a1a1a] text-white rounded-2xl p-5">
        <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Income this month</div>
        <div className="flex gap-3">
          <EInput label={hh.person_a_name} value={incomeA} onChange={setIncomeA} dark />
          {isPartner && <EInput label={hh.person_b_name} value={incomeB} onChange={setIncomeB} dark />}
        </div>
        {(iA>0||iB>0) && (
          <div className="border-t border-white/10 mt-4 pt-3 text-xs text-gray-400 flex justify-between">
            <span>Total in</span><span className="font-semibold text-white">{fmt(iA+iB)}</span>
          </div>
        )}
      </div>

      {/* Joint account */}
      <DSection title="Joint account" icon="🏦" subtitle="Shared bills split by your ratio">
        {isPartner && (iA>0||iB>0) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
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

        <div className="mt-4">
          <SLabel>One-offs this month</SLabel>
          {extras.map(e => (
            <div key={e._key} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
              <input value={e.name} onChange={ev=>setExtras(l=>l.map(x=>x._key===e._key?{...x,name:ev.target.value}:x))} placeholder="Description"
                className="flex-1 text-sm text-gray-700 bg-transparent border-0 focus:outline-none focus:bg-gray-50 rounded px-1 -mx-1" />
              <div className="relative w-24 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span>
                <input type="number" min="0" value={e.amount} onChange={ev=>setExtras(l=>l.map(x=>x._key===e._key?{...x,amount:ev.target.value}:x))} placeholder="0"
                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none text-right" />
              </div>
              {isPartner && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                  {(['both','a','b'] as const).map(w => (
                    <button key={w} onClick={()=>setExtras(l=>l.map(x=>x._key===e._key?{...x,who:w}:x))}
                      className={`px-2 py-1.5 text-xs font-medium transition-colors ${e.who===w?'bg-[#1a1a1a] text-white':'text-gray-500 hover:bg-gray-50'}`}>
                      {whoLabel(w)}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={()=>setExtras(l=>l.filter(x=>x._key!==e._key))} className="text-gray-300 hover:text-red-400 text-lg leading-none w-5">×</button>
            </div>
          ))}
          <AddBtn label="+ Add one-off" onClick={()=>setExtras(l=>[...l,{_key:uid(),name:'',amount:'',who:'both'}])} />
        </div>
      </DSection>

      {/* Per-person outgoings */}
      <div className={isPartner?'grid grid-cols-1 md:grid-cols-2 gap-4':''}>
        {/* Person A */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-semibold text-gray-900">👤 {hh.person_a_name}</h3>
            {iA>0 && <span className="text-sm text-gray-400">{fmt(iA)}</span>}
          </div>
          {isPartner && iA>0 && jointContribA>0 && <div className="text-xs text-gray-400 -mt-1">Joint contribution: {fmt(jointContribA)}</div>}
          <SLabel>Personal bills</SLabel>
          {billsA.map(b=><EditBillRow key={b._key} bill={b} onChange={(f,v)=>setBillsA(l=>l.map(x=>x._key===b._key?{...x,[f]:v}:x))} onRemove={()=>setBillsA(l=>l.filter(x=>x._key!==b._key))} />)}
          <AddBtn label="+ Add personal bill" onClick={()=>setBillsA(l=>[...l,{_key:uid(),name:'',amount:''}])} />
          <SLabel>Debt repayments</SLabel>
          {debtsA.map(d=><EditBillRow key={d._key} bill={d} onChange={(f,v)=>setDebtsA(l=>l.map(x=>x._key===d._key?{...x,[f]:v}:x))} onRemove={()=>setDebtsA(l=>l.filter(x=>x._key!==d._key))} />)}
          <AddBtn label="+ Add debt repayment" onClick={()=>setDebtsA(l=>[...l,{_key:uid(),name:'',amount:''}])} />
          <SLabel>Lifestyle</SLabel>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><span className="text-sm text-gray-600 flex-1">Spending money</span><div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span><input type="number" min="0" value={spendingA} onChange={e=>setSpendingA(e.target.value)} placeholder="0" className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" /></div></div>
            <div className="flex items-center gap-2"><span className="text-sm text-gray-600 flex-1">Travel</span><div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span><input type="number" min="0" value={travelA} onChange={e=>setTravelA(e.target.value)} placeholder="0" className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" /></div></div>
          </div>
          {personalTotalA>0 && <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2"><span>Personal total</span><span className="font-medium">{fmt(personalTotalA)}</span></div>}
        </div>

        {/* Person B */}
        {isPartner && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-semibold text-gray-900">👤 {hh.person_b_name}</h3>
              {iB>0 && <span className="text-sm text-gray-400">{fmt(iB)}</span>}
            </div>
            {iB>0 && jointContribB>0 && <div className="text-xs text-gray-400 -mt-1">Joint contribution: {fmt(jointContribB)}</div>}
            <SLabel>Personal bills</SLabel>
            {billsB.map(b=><EditBillRow key={b._key} bill={b} onChange={(f,v)=>setBillsB(l=>l.map(x=>x._key===b._key?{...x,[f]:v}:x))} onRemove={()=>setBillsB(l=>l.filter(x=>x._key!==b._key))} />)}
            <AddBtn label="+ Add personal bill" onClick={()=>setBillsB(l=>[...l,{_key:uid(),name:'',amount:''}])} />
            <SLabel>Debt repayments</SLabel>
            {debtsB.map(d=><EditBillRow key={d._key} bill={d} onChange={(f,v)=>setDebtsB(l=>l.map(x=>x._key===d._key?{...x,[f]:v}:x))} onRemove={()=>setDebtsB(l=>l.filter(x=>x._key!==d._key))} />)}
            <AddBtn label="+ Add debt repayment" onClick={()=>setDebtsB(l=>[...l,{_key:uid(),name:'',amount:''}])} />
            <SLabel>Lifestyle</SLabel>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><span className="text-sm text-gray-600 flex-1">Spending money</span><div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span><input type="number" min="0" value={spendingB} onChange={e=>setSpendingB(e.target.value)} placeholder="0" className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" /></div></div>
              <div className="flex items-center gap-2"><span className="text-sm text-gray-600 flex-1">Travel</span><div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span><input type="number" min="0" value={travelB} onChange={e=>setTravelB(e.target.value)} placeholder="0" className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" /></div></div>
            </div>
            {personalTotalB>0 && <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2"><span>Personal total</span><span className="font-medium">{fmt(personalTotalB)}</span></div>}
          </div>
        )}
      </div>

      {/* Savings */}
      <div className={isPartner?'grid grid-cols-1 md:grid-cols-2 gap-4':''}>
        {(potsA.length>0||true) && (
          <DSection title={`${hh.person_a_name}'s savings`} icon="💰" subtitle={`Available: ${fmt(availableA)}`}>
            <div className="space-y-2">
              {pots.filter(p=>p.pot_type==='short_term'&&p.owner==='person_a').length>0 && <SLabel>Short-term goals</SLabel>}
              {pots.filter(p=>p.pot_type==='short_term'&&p.owner==='person_a').map(p => {
                const pct = parseFloat(percentsA[p.id])||0; const amount = availableA*(pct/100);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                    <span className="text-sm flex-1 text-gray-700 truncate">{p.name}</span>
                    <div className="relative w-20 shrink-0">
                      <input type="number" min="0" max="100" value={percentsA[p.id]??''} onChange={e=>setPercentsA(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                        className="w-full pr-6 pl-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right tabular-nums shrink-0">{amount>0?fmt(amount):'—'}</span>
                  </div>
                );
              })}
              {pots.filter(p=>p.pot_type!=='short_term'&&p.owner==='person_a').length>0 && <SLabel>Long-term savings</SLabel>}
              {pots.filter(p=>p.pot_type!=='short_term'&&p.owner==='person_a').map(p => {
                const pct = parseFloat(percentsA[p.id])||0; const amount = availableA*(pct/100);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                    <span className="text-sm flex-1 text-gray-700 truncate">{p.name}</span>
                    <div className="relative w-20 shrink-0">
                      <input type="number" min="0" max="100" value={percentsA[p.id]??''} onChange={e=>setPercentsA(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                        className="w-full pr-6 pl-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right tabular-nums shrink-0">{amount>0?fmt(amount):'—'}</span>
                  </div>
                );
              })}
            </div>
            <AddPotRow owner="person_a" onAdd={addPot} />
            <div className={`flex justify-between text-xs mt-2 font-medium ${aReady?'text-emerald-600':Math.abs(100-allocPctA)<50?'text-gray-400':'text-amber-600'}`}>
              <span>{Math.round(allocPctA)}% allocated</span>
              <span>{aReady?'✓ All allocated':`${(100-allocPctA).toFixed(0)}% remaining`}</span>
            </div>
          </DSection>
        )}
        {isPartner && (
          <DSection title={`${hh.person_b_name}'s savings`} icon="💰" subtitle={`Available: ${fmt(availableB)}`}>
            <div className="space-y-2">
              {pots.filter(p=>p.pot_type==='short_term'&&p.owner==='person_b').length>0 && <SLabel>Short-term goals</SLabel>}
              {pots.filter(p=>p.pot_type==='short_term'&&p.owner==='person_b').map(p => {
                const pct = parseFloat(percentsB[p.id])||0; const amount = availableB*(pct/100);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                    <span className="text-sm flex-1 text-gray-700 truncate">{p.name}</span>
                    <div className="relative w-20 shrink-0">
                      <input type="number" min="0" max="100" value={percentsB[p.id]??''} onChange={e=>setPercentsB(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                        className="w-full pr-6 pl-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right tabular-nums shrink-0">{amount>0?fmt(amount):'—'}</span>
                  </div>
                );
              })}
              {pots.filter(p=>p.pot_type!=='short_term'&&p.owner==='person_b').length>0 && <SLabel>Long-term savings</SLabel>}
              {pots.filter(p=>p.pot_type!=='short_term'&&p.owner==='person_b').map(p => {
                const pct = parseFloat(percentsB[p.id])||0; const amount = availableB*(pct/100);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:p.color}} />
                    <span className="text-sm flex-1 text-gray-700 truncate">{p.name}</span>
                    <div className="relative w-20 shrink-0">
                      <input type="number" min="0" max="100" value={percentsB[p.id]??''} onChange={e=>setPercentsB(prev=>({...prev,[p.id]:e.target.value}))} placeholder="0"
                        className="w-full pr-6 pl-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right tabular-nums shrink-0">{amount>0?fmt(amount):'—'}</span>
                  </div>
                );
              })}
            </div>
            <div className={`flex justify-between text-xs mt-2 font-medium ${bReady?'text-emerald-600':Math.abs(100-allocPctB)<50?'text-gray-400':'text-amber-600'}`}>
              <span>{Math.round(allocPctB)}% allocated</span>
              <span>{bReady?'✓ All allocated':`${(100-allocPctB).toFixed(0)}% remaining`}</span>
            </div>
            <AddPotRow owner="person_b" onAdd={addPot} />
          </DSection>
        )}
      </div>

      {/* Summary preview */}
      {(iA>0||iB>0) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-3">Preview</div>
          <Recap label="Total income" value={fmt(iA+iB)} />
          <Recap label="Joint outgoings" value={fmt(jointTotal+extras.reduce((s,e)=>s+(parseFloat(e.amount)||0),0))} negative />
          <Recap label={`${hh.person_a_name}'s personal`} value={fmt(personalTotalA)} negative />
          {isPartner && <Recap label={`${hh.person_b_name}'s personal`} value={fmt(personalTotalB)} negative />}
          {(totalSavingsA+totalSavingsB)>0 && <Recap label="Saving this month" value={fmt(totalSavingsA+totalSavingsB)} positive />}
        </div>
      )}

      {/* Actions */}
      {!canLock && (aReady===false||bReady===false) && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
          {!aReady && <div>{hh.person_a_name}: {(100-allocPctA).toFixed(0)}% still to allocate in savings</div>}
          {isPartner&&!bReady && <div>{hh.person_b_name}: {(100-allocPctB).toFixed(0)}% still to allocate in savings</div>}
        </div>
      )}
      <div className="flex gap-3 pb-6">
        <button onClick={()=>persist(false)} disabled={saving}
          className="flex-1 border border-gray-200 py-3.5 rounded-xl text-sm font-medium hover:border-gray-400 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save draft'}
        </button>
        <button onClick={()=>persist(true)} disabled={!canLock||saving}
          className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-emerald-700 transition-colors">
          {saving ? 'Saving…' : 'Lock in 🔒'}
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function DSection({ title, icon, subtitle, children }: { title: string; icon: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div><div className="flex items-center gap-2 mb-0.5"><span>{icon}</span><h3 className="font-semibold text-gray-900">{title}</h3></div>{subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}</div>
      {children}
    </div>
  );
}
function SLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-400 uppercase tracking-wide font-medium pt-1 pb-0.5">{children}</div>;
}
function ActionCard({ label, amount }: { label: string; amount: number }) {
  return <div className="rounded-xl p-3 bg-blue-50 border border-blue-100"><div className="text-xs text-gray-500 mb-1">{label}</div><div className="text-lg font-bold text-blue-700">{fmt(amount)}</div></div>;
}
function BillRow({ name, amount, splitA, splitB, tag }: { name: string; amount: number; splitA?: string; splitB?: string; tag?: string }) {
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-sm text-gray-700">{name}</span>{tag && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>}</div>
        <span className="text-sm font-medium">{fmt(amount)}</span>
      </div>
      {(splitA||splitB) && <div className="flex gap-4 mt-0.5">{splitA && <span className="text-xs text-gray-400">{splitA}</span>}{splitB && <span className="text-xs text-gray-400">{splitB}</span>}</div>}
    </div>
  );
}
function PersonCard({ name, income, jointContrib, personalBills, debts, spending, travel, personalTotal, savingsTotal }: {
  name: string; income: number; jointContrib: number; personalBills: SessionBill[]; debts: SessionBill[]; spending: number; travel: number; personalTotal: number; savingsTotal: number;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3"><h3 className="font-semibold text-gray-900">👤 {name}</h3><span className="text-sm font-medium text-gray-500">{fmt(income)}</span></div>
      <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between"><div><div className="text-xs text-blue-600 font-medium">Transfer to joint account</div></div><div className="text-lg font-bold text-blue-700">{fmt(jointContrib)}</div></div>
      {(personalBills.length>0||debts.length>0||spending>0||travel>0) && (
        <div><SLabel>Personal outgoings</SLabel><div className="space-y-0">
          {personalBills.map(b=><div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-600">{b.name}</span><span className="text-sm font-medium">{fmt(Number(b.amount))}</span></div>)}
          {debts.map(d=><div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-600 flex items-center gap-1.5"><span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">debt</span>{d.name}</span><span className="text-sm font-medium">{fmt(Number(d.amount))}</span></div>)}
          {spending>0 && <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-600">Spending money</span><span className="text-sm font-medium">{fmt(spending)}</span></div>}
          {travel>0 && <div className="flex items-center justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-600">Travel</span><span className="text-sm font-medium">{fmt(travel)}</span></div>}
          <div className="flex justify-between text-xs text-gray-400 pt-1"><span>Personal total</span><span className="font-medium">{fmt(personalTotal)}</span></div>
        </div></div>
      )}
      <div className="border-t border-gray-100 pt-3"><div className="flex justify-between text-sm font-semibold"><span className="text-gray-600">Remainder after savings</span><span className={income-jointContrib-personalTotal-savingsTotal<-0.01?'text-red-600':'text-gray-900'}>{fmt(income-jointContrib-personalTotal-savingsTotal)}</span></div></div>
    </div>
  );
}
function SavingsCard({ name, allocs, potMap, total, available }: { name: string; allocs: Allocation[]; potMap: Record<string,Pot>; total: number; available: number }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div><div className="flex items-center gap-2 mb-0.5"><span>💰</span><h3 className="font-semibold text-gray-900">{name}&apos;s savings</h3></div><p className="text-xs text-gray-400">Transfers to make this month</p></div>
      <div className="space-y-0">
        {allocs.map(a=>{const pot=potMap[a.pot_id];if(!pot)return null;const pct=available>0?Math.round(Number(a.amount)/available*100):0;return(<div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"><div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:pot.color}} /><span className="text-sm flex-1 text-gray-700">{pot.name}</span>{pct>0&&<span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>}<span className="text-sm font-semibold text-emerald-700">{fmt(Number(a.amount))}</span></div>);})}
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3"><span className="text-gray-600">Total to save</span><span className="text-emerald-600">{fmt(total)}</span></div>
    </div>
  );
}
function Recap({ label, value, negative, positive, bold }: { label: string; value: string; negative?: boolean; positive?: boolean; bold?: boolean }) {
  return <div className={`flex justify-between text-sm ${bold?'font-bold':''}`}><span className="text-gray-500">{label}</span><span className={positive?'text-emerald-600 font-semibold':negative?'text-gray-700':'font-medium'}>{negative?'−':''}{value}</span></div>;
}

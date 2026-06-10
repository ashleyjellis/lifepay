'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccounts, useBills, useEvents, useIncome, usePreferences } from '@/hooks/useStorage';
import { forecastAtDay, runForecast } from '@/lib/forecast';
import { formatCurrency, nextOccurrence } from '@/lib/format';
import { format } from 'date-fns';

const CHIPS = [
  "Can I afford a £700 laptop next month?",
  "What happens if I pay £200 extra off my credit card?",
  "Will I go below £500 before payday?",
  "How much can I save each month?",
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIPage() {
  const { accounts } = useAccounts();
  const { income } = useIncome();
  const { bills } = useBills();
  const { events } = useEvents();
  const { prefs } = usePreferences();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const forecast = useMemo(() => runForecast(accounts, income, bills, events), [accounts, income, bills, events]);

  const currentBalance = accounts.filter(a => a.type === 'current').reduce((s, a) => s + a.balance, 0);
  const forecast30 = forecastAtDay(forecast, 30) ?? currentBalance;
  const forecast90 = forecastAtDay(forecast, 90) ?? currentBalance;
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);
  const salary = income.find(i => i.frequency === 'monthly');
  const nextPayday = salary ? nextOccurrence(salary.paydayDayOfMonth ?? prefs.paydayDay) : null;
  const daysToPayday = nextPayday ? Math.round((nextPayday.getTime() - Date.now()) / 86400000) : 0;

  const upcomingEvents = events.slice(0, 5).map(e => `${e.name} on ${e.date} (£${e.budget})`).join(', ') || 'None';

  const systemPrompt = `You are a personal cash flow assistant for LifeCash Planner.
The user's current financial situation:
- Current balance: ${formatCurrency(currentBalance)}
- Next payday: ${nextPayday ? format(nextPayday, 'dd MMM yyyy') : 'unknown'} in ${daysToPayday} days (${formatCurrency(salary?.amount ?? 0)})
- Monthly bills total: ${formatCurrency(billsTotal)}
- Upcoming events: ${upcomingEvents}
- Forecast balance in 30 days: ${formatCurrency(forecast30)}
- Forecast balance in 90 days: ${formatCurrency(forecast90)}

Answer based on these exact numbers. Be direct and practical.
Show the impact on their actual forecast figures in every answer.
Never give generic advice.`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, systemPrompt }),
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: updated[updated.length - 1].content + chunk };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I couldn\'t connect to the AI. Make sure ANTHROPIC_API_KEY is set.' };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh)] max-w-2xl mx-auto">
      <div className="p-4 md:p-6 border-b border-gray-100 bg-white">
        <h1 className="text-2xl font-bold">Ask AI</h1>
        <p className="text-sm text-gray-500">Your personal cash flow assistant</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Ask me anything about your finances:</p>
            <div className="flex flex-col gap-2">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  className="text-left text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              m.role === 'user'
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-800'
            }`}>
              {m.content || <span className="opacity-50">Thinking…</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Ask about your finances…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            disabled={loading}
          />
          <button
            className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

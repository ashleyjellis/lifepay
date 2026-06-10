import { formatCurrency } from '@/lib/format';

export function AmountText({ amount, className = '' }: { amount: number; className?: string }) {
  const color = amount >= 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]';
  return <span className={`font-semibold ${color} ${className}`}>{formatCurrency(amount)}</span>;
}

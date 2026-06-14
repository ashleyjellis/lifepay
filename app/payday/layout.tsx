import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payday — Ashley\'s Budgeting System',
  description: 'Household payday budgeting',
};

export default function PaydayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1a1a1a]">
      {children}
    </div>
  );
}

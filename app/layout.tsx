import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LifeCash Planner',
  description: 'Personal cash flow planner',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-50 text-gray-900`}>
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 pb-20 md:pb-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

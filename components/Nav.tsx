'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/forecast', label: 'Forecast', icon: '📈' },
  { href: '/tracker', label: 'Tracker', icon: '💳' },
  { href: '/events', label: 'Events', icon: '🎉' },
  { href: '/bills', label: 'Bills', icon: '📄' },
  { href: '/ai', label: 'Ask AI', icon: '🤖' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar for md+ */}
      <nav className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-100 min-h-screen p-4 gap-1">
        <div className="text-xl font-bold text-gray-900 mb-6 px-2">LifeCash</div>
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === t.href
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Bottom bar for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${
              pathname === t.href ? 'text-gray-900 font-semibold' : 'text-gray-400'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="hidden xs:block">{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

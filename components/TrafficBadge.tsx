import type { TrafficLight } from '@/types';

const styles: Record<TrafficLight, string> = {
  green: 'bg-[#EAF3DE] text-[#3B6D11]',
  amber: 'bg-[#FAEEDA] text-[#854F0B]',
  red: 'bg-[#FCEBEB] text-[#A32D2D]',
};

export function TrafficBadge({ light, children }: { light: TrafficLight; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[light]}`}>
      {children}
    </span>
  );
}

export function trafficBg(light: TrafficLight) {
  return styles[light];
}

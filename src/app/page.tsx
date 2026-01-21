'use client';

import dynamic from 'next/dynamic';

const PilotDashboard = dynamic(() => import('@/components/PilotDashboard').then(mod => ({ default: mod.PilotDashboard })), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-900 overflow-hidden flex items-center justify-center" style={{ height: '100dvh' }}>
      <div className="text-slate-400">Loading...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="bg-slate-900 overflow-hidden" style={{ height: '100dvh' }}>
      <PilotDashboard />
    </div>
  );
}

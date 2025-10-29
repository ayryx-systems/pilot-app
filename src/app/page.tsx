'use client';

import dynamic from 'next/dynamic';

const PilotDashboard = dynamic(() => import('@/components/PilotDashboard').then(mod => ({ default: mod.PilotDashboard })), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="bg-slate-900 overflow-hidden" style={{ height: '100dvh' }}>
      <PilotDashboard />
    </div>
  );
}

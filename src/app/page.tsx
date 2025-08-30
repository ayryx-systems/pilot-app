'use client';

import { PilotDashboard } from '@/components/PilotDashboard';

export default function Home() {
  return (
    <div className="h-screen bg-slate-900 overflow-hidden" style={{ height: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))' }}>
      <PilotDashboard />
    </div>
  );
}

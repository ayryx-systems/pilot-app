'use client';

import { PilotDashboard } from '@/components/PilotDashboard';

export default function Home() {
  return (
    <div className="bg-slate-900 overflow-hidden" style={{ height: '100dvh' }}>
      <PilotDashboard />
    </div>
  );
}

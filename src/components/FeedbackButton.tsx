'use client';

import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';

interface FeedbackButtonProps {
  appVersion?: string;
  airportContext?: string;
}

export function FeedbackButton({ appVersion, airportContext }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[1000] p-2.5 md:p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-105 flex items-center justify-center group"
        style={{ 
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Share feedback"
        title="Share feedback"
      >
        <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
        <span className="ml-2 text-sm font-medium hidden sm:inline">Feedback</span>
      </button>

      <FeedbackDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        appVersion={appVersion}
        airportContext={airportContext}
      />
    </>
  );
}

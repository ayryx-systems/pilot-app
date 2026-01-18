'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackSubmission, FeedbackResponse } from '@/types';
import { pilotApi } from '@/services/api';
import * as Toast from '@radix-ui/react-toast';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appVersion?: string;
  airportContext?: string;
}

const FEEDBACK_STORAGE_KEY = 'pilotApp_feedback_draft';

function clearDraftFeedback() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function FeedbackDialog({ open, onOpenChange, appVersion, airportContext }: FeedbackDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleSubmit = async (feedback: FeedbackSubmission) => {
    try {
      const response = await pilotApi.submitFeedback(feedback);
      
      if (response.success) {
        clearDraftFeedback();
        setToastMessage(response.message || 'Thank you for your feedback!');
        setToastType('success');
        setToastOpen(true);
        
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        throw new Error(response.error || 'Failed to submit feedback');
      }
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.');
      setToastType('error');
      setToastOpen(true);
      throw error;
    }
  };

  const dialog = (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 border-2 border-blue-500/50 rounded-lg shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto z-[9999]">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-xl font-semibold text-blue-300">
              Share Your Feedback
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <FeedbackForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            appVersion={appVersion}
            airportContext={airportContext}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  return (
    <>
      {mounted && typeof document !== 'undefined' && createPortal(dialog, document.body)}
      <Toast.Provider>
        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-[10000] ${
            toastType === 'success' 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}
        >
          <Toast.Title className="font-medium">{toastMessage}</Toast.Title>
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-0 right-0 flex flex-col p-6 gap-2 w-96 max-w-[100vw] m-0 list-none z-[10000] outline-none" />
      </Toast.Provider>
    </>
  );
}

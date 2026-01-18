'use client';

import React, { useState } from 'react';
import { FeedbackType, FeedbackSubmission } from '@/types';
import { ThumbsUp, AlertCircle, Lightbulb, HelpCircle, Loader2 } from 'lucide-react';

interface FeedbackFormProps {
  onSubmit: (feedback: FeedbackSubmission) => Promise<void>;
  onCancel: () => void;
  appVersion?: string;
  airportContext?: string;
}

const FEEDBACK_TYPES: Array<{ type: FeedbackType; label: string; icon: React.ReactNode; description: string }> = [
  {
    type: 'positive',
    label: 'What\'s working well',
    icon: <ThumbsUp className="w-5 h-5" />,
    description: 'Share what you like about the app',
  },
  {
    type: 'issue',
    label: 'Report an issue',
    icon: <AlertCircle className="w-5 h-5" />,
    description: 'Something isn\'t working correctly',
  },
  {
    type: 'suggestion',
    label: 'Suggest an improvement',
    icon: <Lightbulb className="w-5 h-5" />,
    description: 'Have an idea to make it better?',
  },
  {
    type: 'question',
    label: 'Ask a question',
    icon: <HelpCircle className="w-5 h-5" />,
    description: 'Need help or clarification',
  },
];

export function FeedbackForm({ onSubmit, onCancel, appVersion, airportContext }: FeedbackFormProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      setError('Please select a feedback type');
      return;
    }

    if (!message.trim() || message.trim().length < 3) {
      setError('Please provide at least 3 characters of feedback');
      return;
    }

    if (message.length > 2000) {
      setError('Feedback must be less than 2000 characters');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        type: selectedType,
        message: message.trim(),
        appVersion,
        airportContext,
        metadata: {
          screenWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
          screenHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!selectedType ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-300 mb-4">
            How can we help? Your feedback is anonymous and helps us improve the app.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {FEEDBACK_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedType(item.type)}
                className="flex items-start space-x-3 p-3 rounded-lg border-2 border-slate-700 bg-slate-800/50 hover:border-blue-500/50 hover:bg-slate-800 transition-colors text-left"
              >
                <div className={`flex-shrink-0 mt-0.5 ${
                  item.type === 'positive' ? 'text-green-400' :
                  item.type === 'issue' ? 'text-red-400' :
                  item.type === 'suggestion' ? 'text-yellow-400' :
                  'text-blue-400'
                }`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200">{item.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedType(null);
                  setMessage('');
                  setError(null);
                }}
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                ← Back
              </button>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-sm text-gray-400">
                {FEEDBACK_TYPES.find(t => t.type === selectedType)?.label}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-300 mb-2">
                Your feedback
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setError(null);
                }}
                placeholder={
                  selectedType === 'positive' ? 'What do you like about the app?' :
                  selectedType === 'issue' ? 'Describe the issue you encountered...' :
                  selectedType === 'suggestion' ? 'Share your idea for improvement...' :
                  'What would you like to know?'
                }
                rows={6}
                maxLength={2000}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  This feedback is anonymous
                </p>
                <p className="text-xs text-gray-500">
                  {message.length} / 2000 characters
                </p>
              </div>
            </div>

            {(appVersion || airportContext) && (
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Context (included automatically):</p>
                {appVersion && <p>App Version: {appVersion}</p>}
                {airportContext && <p>Airport: {airportContext}</p>}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || message.trim().length < 3}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Feedback</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

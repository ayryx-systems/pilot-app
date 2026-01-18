'use client';

import React, { useState } from 'react';
import { FeedbackType, FeedbackSubmission, UserRole } from '@/types';
import { ThumbsUp, AlertCircle, Lightbulb, HelpCircle, Loader2, Info, X } from 'lucide-react';

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

const FEEDBACK_STORAGE_KEY = 'pilotApp_feedback_draft';

function loadDraftFeedback() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.message || parsed.type || parsed.role) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveDraftFeedback(data: { type?: FeedbackType | null; role?: UserRole | null; message?: string }) {
  if (typeof window === 'undefined') return;
  try {
    if (data.message || data.type || data.role) {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(FEEDBACK_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function clearDraftFeedback() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function FeedbackForm({ onSubmit, onCancel, appVersion, airportContext }: FeedbackFormProps) {
  const draft = loadDraftFeedback();
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(draft?.type || null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(draft?.role || null);
  const [message, setMessage] = useState(draft?.message || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMetadataInfo, setShowMetadataInfo] = useState(false);

  React.useEffect(() => {
    saveDraftFeedback({ type: selectedType, role: selectedRole, message });
  }, [selectedType, selectedRole, message]);

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
        role: selectedRole,
        message: message.trim(),
        appVersion,
        airportContext,
        metadata: {
          screenWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
          screenHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
        },
      });
      clearDraftFeedback();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback. Please try again.');
      setIsSubmitting(false);
    }
  };

  const metadataItems = [
    'Feedback type (positive, issue, suggestion, or question)',
    'Your role (pilot, planner, dispatch, or other)',
    'Your feedback message',
    'App version (if available)',
    'Current airport context (if viewing an airport)',
    'Browser type and version',
    'Screen dimensions (width and height)',
    'Timestamp of submission',
  ];

  const hasDraft = message.trim().length > 0 || selectedRole !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!selectedType ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-300 mb-4">
            How can we help? Your feedback is anonymous and helps us improve the app.
          </p>
          {hasDraft && (
            <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg mb-3">
              <p className="text-xs text-blue-300">
                You have unsaved feedback. It will be preserved if you navigate away.
              </p>
            </div>
          )}
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
              <label htmlFor="feedback-role" className="block text-sm font-medium text-gray-300 mb-2">
                Your role <span className="text-gray-500">(optional but helpful)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['pilot', 'planner', 'dispatch', 'other'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(selectedRole === role ? null : role)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                      selectedRole === role
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 text-gray-300'
                    }`}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </button>
                ))}
              </div>
            </div>
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

            <div className="flex items-start justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowMetadataInfo(!showMetadataInfo)}
                className="flex items-center space-x-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <Info className="w-4 h-4" />
                <span>What information will be sent?</span>
              </button>
            </div>

            {showMetadataInfo && (
              <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Information Being Sent</h4>
                  <button
                    type="button"
                    onClick={() => setShowMetadataInfo(false)}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  This feedback is anonymous. The following information will be included to help us understand and improve the app:
                </p>
                <ul className="space-y-1.5">
                  {metadataItems.map((item, index) => (
                    <li key={index} className="text-xs text-gray-300 flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-3 italic">
                  Note: No personal information (name, email, IP address) is collected or stored.
                </p>
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
                onClick={() => {
                  clearDraftFeedback();
                  setSelectedType(null);
                  setSelectedRole(null);
                  setMessage('');
                  onCancel();
                }}
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

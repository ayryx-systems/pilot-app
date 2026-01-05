'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpButtonProps {
  title: string;
  content: string | React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function HelpButton({ title, content, size = 'sm' }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const getSizeClasses = () => {
    switch (size) {
      case 'lg':
        return 'w-5 h-5';
      case 'md':
        return 'w-4 h-4';
      case 'sm':
      default:
        return 'w-3.5 h-3.5';
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center justify-center rounded-full bg-blue-500/20 hover:bg-blue-500/30 
                   text-blue-400 hover:text-blue-300 transition-colors border border-blue-500/30 flex-shrink-0"
        style={{ padding: size === 'sm' ? '2px' : size === 'md' ? '3px' : '4px' }}
        aria-label="Help"
      >
        <HelpCircle className={getSizeClasses()} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <div
            className="relative bg-slate-800 border-2 border-blue-500/50 rounded-lg shadow-2xl p-4 max-w-md w-full max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-base font-semibold text-blue-300 pr-4">{title}</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-gray-300 leading-relaxed space-y-2">
              {typeof content === 'string' ? <p>{content}</p> : content}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


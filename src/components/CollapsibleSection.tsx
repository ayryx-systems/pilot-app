'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  className?: string;
  headerClassName?: string;
  badge?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  forceOpen,
  className = '',
  headerClassName = '',
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
    }
  }, [forceOpen]);

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-colors rounded-lg ${headerClassName}`}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <h4 className="text-xs font-semibold text-slate-400 uppercase">{title}</h4>
          {badge}
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;


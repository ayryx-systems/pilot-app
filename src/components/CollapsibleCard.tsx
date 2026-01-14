'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, LucideIcon } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  icon: LucideIcon;
  summary: string | React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function CollapsibleCard({
  title,
  icon: Icon,
  summary,
  children,
  defaultExpanded = false,
  className = '',
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`rounded-xl border-2 border-slate-500 bg-slate-700/80 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex flex-col p-2 rounded-lg transition-colors hover:bg-slate-600/30"
      >
        <div className="flex items-center justify-between w-full mb-1">
          <div className="flex items-center">
            <Icon className="w-5 h-5 text-white mr-2" />
            <span className="text-sm font-semibold text-white">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
        <div className="text-xs text-gray-200 leading-tight font-medium text-left">
          {summary}
        </div>
      </button>
      {isExpanded && (
        <div className="px-2 pb-2 border-t border-slate-600/50">
          {children}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { calculateProgress } from '../lib/utils';

export default function ProgressBar({ dayTasks, index, gradient }) {
  const { percentage, completed, total } = calculateProgress(dayTasks);
  const isDarkBackground = index >= 4;

  if (total === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs ${isDarkBackground ? 'text-white/70' : 'text-gray-600'}`}>
          {completed}/{total} completed
        </span>
        <span className={`text-xs font-medium ${isDarkBackground ? 'text-white/70' : 'text-gray-600'}`}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className={`w-full h-2 rounded-full ${isDarkBackground ? 'bg-white/20' : 'bg-gray-200'} overflow-hidden`}>
        <div
          className="h-full transition-all duration-500 ease-out rounded-full"
          style={{
            width: `${percentage}%`,
            background: gradient,
            backgroundSize: `${10000 / percentage}% 100%`,
            backgroundPosition: 'left',
          }}
        />
      </div>
    </div>
  );
}

import React from 'react';
import { Repeat } from 'lucide-react';

const RecurringIndicator = ({ frequency, isDarkBackground }) => {
  let label = '';
  let icon = <Repeat size={14} />;
  
  switch (frequency) {
    case 'daily':
      label = 'd';
      break;
    case 'weekly':
      label = 'w';
      break;
    case 'monthly':
      label = 'm';
      break;
    default:
      label = 'd'; // Default to daily
  }
  
  return (
    <span 
      className={`flex items-center gap-1 ${isDarkBackground ? 'text-white/60' : 'text-gray-400'}`}
      title={`Repeats ${frequency}`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </span>
  );
};

export default RecurringIndicator;
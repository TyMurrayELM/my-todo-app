import React from 'react';
import { Repeat } from 'lucide-react';

const RecurringIndicator = ({ frequency, isDarkBackground }) => {
  let label = '';
  let title = '';
  let icon = <Repeat size={14} />;
  
  switch (frequency) {
    case 'daily':
      label = 'd';
      title = 'Repeats daily';
      break;
    case 'every-other-day':
      label = '2d';
      title = 'Repeats every other day';
      break;
    case 'weekdays':
      label = 'wd';
      title = 'Repeats weekdays only';
      break;
    case 'weekly':
      label = 'w';
      title = 'Repeats weekly';
      break;
    case 'bi-weekly':
      label = '2w';
      title = 'Repeats bi-weekly';
      break;
    case 'monthly':
      label = 'm';
      title = 'Repeats monthly';
      break;
    case 'first-of-month':
      label = '1st';
      title = 'Repeats on 1st of each month';
      break;
    default:
      label = 'd'; // Default to daily
      title = 'Repeats daily';
  }
  
  return (
    <span 
      className={`flex items-center gap-1 ${isDarkBackground ? 'text-white/60' : 'text-gray-400'}`}
      title={title}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </span>
  );
};

export default RecurringIndicator;
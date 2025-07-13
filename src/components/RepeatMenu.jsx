// RepeatMenu.jsx
import React from 'react';
import { Repeat, Calendar } from 'lucide-react';
import DropdownMenu from './DropdownMenu'; // Adjust path as needed

const RepeatMenu = ({ onSelect }) => {
  const options = [
    { 
      id: 'daily', 
      label: 'Daily', 
      icon: <Repeat size={14} />, 
      subtitle: 'Every day' 
    },
    { 
      id: 'weekdays', 
      label: 'Weekdays', 
      icon: <Calendar size={14} />, 
      subtitle: 'Mon-Fri' 
    },
    { 
      id: 'weekly', 
      label: 'Weekly', 
      icon: <Calendar size={14} />, 
      subtitle: 'Same day weekly' 
    },
    { 
      id: 'bi-weekly', 
      label: 'Bi-weekly', 
      icon: <Calendar size={14} />, 
      subtitle: 'Every 2 weeks' 
    },
    { 
      id: 'monthly', 
      label: 'Monthly', 
      icon: <Calendar size={14} />, 
      subtitle: 'Same day monthly' 
    }
  ];

  return (
    <DropdownMenu
      triggerIcon={<Repeat size={16} />}
      triggerTitle="Set repeat frequency"
      options={options}
      onSelect={onSelect}
      hoverColor="green-500"
    />
  );
};

export default RepeatMenu;
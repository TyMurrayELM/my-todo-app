// MoveMenu.jsx
import React from 'react';
import { SkipForward, Calendar, CalendarDays } from 'lucide-react';
import DropdownMenu from './DropdownMenu'; // Adjust path as needed g

const MoveMenu = ({ onSelect }) => {
  const options = [
    { 
      id: 'next-day', 
      label: 'Next Day', 
      icon: <SkipForward size={14} />, 
      subtitle: 'Tomorrow' 
    },
    { 
      id: 'next-week', 
      label: 'Next Week', 
      icon: <Calendar size={14} />, 
      subtitle: '+7 days' 
    },
    { 
      id: 'next-weekday', 
      label: 'Next Weekday', 
      icon: <CalendarDays size={14} />, 
      subtitle: 'Skip weekend' 
    },
    { 
      id: 'next-weekend', 
      label: 'Next Weekend', 
      icon: <Calendar size={14} />, 
      subtitle: 'Saturday' 
    }
  ];

  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <DropdownMenu
      triggerIcon={<SkipForward size={16} />}
      triggerTitle="Move task"
      options={options}
      onSelect={onSelect}
      hoverColor="blue-500"
      buttonClass="p-2"
      onButtonClick={handleButtonClick}
    />
  );
};

export default MoveMenu;
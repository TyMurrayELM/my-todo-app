// MoveMenu.jsx
import { SkipForward, Calendar, CalendarDays, CalendarSearch } from 'lucide-react';
import DropdownMenu from './DropdownMenu'; // Adjust path as needed g
import { getLocalDateString } from '../lib/dates';

const MoveMenu = ({ onSelect, onOpenChange }) => {
  const options = [
    {
      id: 'today',
      label: 'Today',
      icon: <CalendarDays size={14} />,
      subtitle: 'Move to today',
    },
    {
      id: 'next-day',
      label: 'Next Day',
      icon: <SkipForward size={14} />,
      subtitle: 'Tomorrow',
    },
    {
      id: 'next-week',
      label: 'Next Week',
      icon: <Calendar size={14} />,
      subtitle: '+7 days',
    },
    {
      id: 'next-weekday',
      label: 'Next Weekday',
      icon: <CalendarDays size={14} />,
      subtitle: 'Skip weekend',
    },
    {
      id: 'next-weekend',
      label: 'Next Weekend',
      icon: <Calendar size={14} />,
      subtitle: 'Saturday',
    },
    {
      id: 'custom',
      label: 'Pick a Date',
      icon: <CalendarSearch size={14} />,
      subtitle: 'Choose…',
      datePicker: true,
      defaultDate: getLocalDateString(new Date()),
    },
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
      hoverClass="hover:text-blue-500"
      buttonClass="p-2"
      onButtonClick={handleButtonClick}
      onOpenChange={onOpenChange}
    />
  );
};

export default MoveMenu;

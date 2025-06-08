import React, { useState, useRef, useEffect } from 'react';
import { SkipForward, ChevronDown, Calendar, CalendarDays } from 'lucide-react';

const MoveMenu = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  const options = [
    { id: 'next-day', label: 'Next Day', icon: <SkipForward size={14} /> },
    { id: 'next-week', label: 'Next Week', icon: <Calendar size={14} /> },
    { id: 'next-weekday', label: 'Next Weekday', icon: <CalendarDays size={14} /> },
    { id: 'next-weekend', label: 'Next Weekend', icon: <Calendar size={14} /> }
  ];
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="flex items-center text-inherit hover:text-blue-500 p-2"
        title="Move task"
        type="button"
      >
        <SkipForward size={16} />
        <ChevronDown size={14} className="ml-1" />
      </button>
      
      {isOpen && (
        <div className="absolute left-1/2 transform -translate-x-1/2 mt-1 w-44 bg-white border rounded shadow-lg z-[100]">
          {options.map(option => (
            <div
              key={option.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(option.id);
                setIsOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              {option.icon}
              <span className="text-sm">{option.label}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {option.id === 'next-day' ? 'Tomorrow' : 
                 option.id === 'next-week' ? '+7 days' : 
                 option.id === 'next-weekday' ? 'Skip weekend' :
                 'Saturday'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoveMenu;
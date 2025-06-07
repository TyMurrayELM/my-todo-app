import React, { useState, useRef, useEffect } from 'react';
import { Repeat, Calendar, ChevronDown } from 'lucide-react';

const RepeatMenu = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  const options = [
    { id: 'daily', label: 'Daily', icon: <Repeat size={14} /> },
    { id: 'weekly', label: 'Weekly', icon: <Calendar size={14} /> },
    { id: 'bi-weekly', label: 'Bi-weekly', icon: <Calendar size={14} /> },
    { id: 'monthly', label: 'Monthly', icon: <Calendar size={14} /> }
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
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center text-inherit hover:text-green-500"
        title="Set repeat frequency"
      >
        <Repeat size={16} />
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
                {option.id === 'daily' ? 'Every day' : 
                 option.id === 'weekly' ? 'Same day weekly' : 
                 option.id === 'bi-weekly' ? 'Every 2 weeks' :
                 'Same day monthly'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepeatMenu;
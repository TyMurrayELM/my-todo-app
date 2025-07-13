// DropdownMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const DropdownMenu = ({ 
  triggerIcon, 
  triggerTitle, 
  options, 
  onSelect, 
  hoverColor = 'gray-500', 
  buttonClass = '', 
  onButtonClick 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

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

  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (onButtonClick) {
      onButtonClick(e);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={handleButtonClick}
        onMouseDown={(e) => {
          if (onButtonClick) onButtonClick(e); // Allow custom onMouseDown if needed
        }}
        className={`flex items-center text-inherit hover:text-${hoverColor} ${buttonClass}`}
        title={triggerTitle}
        aria-label={triggerTitle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
      >
        {triggerIcon}
        <ChevronDown size={14} className="ml-1" />
      </button>
      
      {isOpen && (
        <div className="absolute left-1/2 transform -translate-x-1/2 mt-1 w-44 bg-white border rounded shadow-lg z-[100]">
          {options.map(option => (
            <div
              key={option.id}
              role="menuitem"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(option.id);
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSelect(option.id);
                  setIsOpen(false);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              {option.icon}
              <span className="text-sm">{option.label}</span>
              <span className="text-xs text-gray-500 ml-auto">{option.subtitle}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
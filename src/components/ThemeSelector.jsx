import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const ThemeSelector = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const themes = [
    { 
      value: 'amber', 
      label: 'Amber', 
      gradient: 'bg-gradient-to-r from-amber-100 to-amber-600'
    },
    { 
      value: 'blue', 
      label: 'Blue', 
      gradient: 'bg-gradient-to-r from-blue-100 to-blue-600'
    },
    { 
      value: 'green', 
      label: 'Green', 
      gradient: 'bg-gradient-to-r from-green-100 to-green-600'
    },
    { 
      value: 'purple', 
      label: 'Purple', 
      gradient: 'bg-gradient-to-r from-purple-100 to-purple-600'
    },
    { 
      value: 'pink', 
      label: 'Pink', 
      gradient: 'bg-gradient-to-r from-pink-100 to-pink-600'
    }
  ];
  
  const handleSelect = (themeValue) => {
    onChange(themeValue);
    setIsOpen(false);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const currentTheme = themes.find(theme => theme.value === value) || themes[0];
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 border rounded-full p-1 bg-white hover:bg-gray-50"
        title={`Theme: ${currentTheme.label}`}
      >
        <span className={`inline-block w-5 h-5 rounded-full ${currentTheme.gradient}`}></span>
        <ChevronDown size={12} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-24 bg-white border rounded-lg shadow-lg z-10">
          {themes.map(theme => (
            <div
              key={theme.value}
              onClick={() => handleSelect(theme.value)}
              className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                theme.value === value ? 'bg-gray-100' : ''
              } ${theme.value === themes[0].value ? 'rounded-t-lg' : ''} ${theme.value === themes[themes.length-1].value ? 'rounded-b-lg' : ''}`}
            >
              <span className={`inline-block w-3 h-3 rounded-full ${theme.gradient}`}></span>
              <span className="text-sm">{theme.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
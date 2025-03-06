import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const ThemeSelector = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const themes = [
    { value: 'amber', label: 'Amber', color: 'bg-amber-500' },
    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
    { value: 'green', label: 'Green', color: 'bg-green-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
    { value: 'pink', label: 'Pink', color: 'bg-pink-500' }
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
        className="flex items-center gap-2 text-sm border rounded px-2 py-1 text-gray-700 bg-white hover:bg-gray-50"
      >
        <span className={`inline-block w-3 h-3 rounded-full ${currentTheme.color}`}></span>
        {currentTheme.label}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-24 bg-white border rounded shadow-lg z-10">
          {themes.map(theme => (
            <div
              key={theme.value}
              onClick={() => handleSelect(theme.value)}
              className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                theme.value === value ? 'bg-gray-100' : ''
              }`}
            >
              <span className={`inline-block w-3 h-3 rounded-full ${theme.color}`}></span>
              <span className="text-sm">{theme.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
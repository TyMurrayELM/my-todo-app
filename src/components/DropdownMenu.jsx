// DropdownMenu.jsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { isDatePickerActive } from '../lib/utils';

const DropdownMenu = ({
  triggerIcon,
  triggerTitle,
  options,
  onSelect,
  // Must be a complete class name — Tailwind can't generate classes
  // assembled at runtime from fragments.
  hoverClass = 'hover:text-gray-500',
  buttonClass = '',
  onButtonClick,
  // Lets the parent keep hover-revealed containers visible while open
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // id of the option whose renderPanel is showing instead of the option list
  const [activePanelId, setActivePanelId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (onOpenChange) onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Never close while a native date picker is up — on mobile a delayed
      // synthetic click follows the tap that opened it, and closing the
      // menu would unmount the picker's input and dismiss the picker.
      if (isDatePickerActive()) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setActivePanelId(null);
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
    setActivePanelId(null);
  };

  const activePanelOption = activePanelId && options.find((o) => o.id === activePanelId);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleButtonClick}
        onMouseDown={(e) => {
          if (onButtonClick) onButtonClick(e); // Allow custom onMouseDown if needed
        }}
        className={`flex items-center text-inherit ${hoverClass} ${buttonClass}`}
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
        <div className="absolute left-1/2 transform -translate-x-1/2 mt-1 w-56 bg-white border rounded shadow-lg z-[100]">
          {activePanelOption ? (
            // Option-supplied panel replaces the list (e.g. custom frequency form).
            activePanelOption.renderPanel({
              onSelect: (value) => {
                onSelect(value);
                setIsOpen(false);
                setActivePanelId(null);
              },
              onBack: () => setActivePanelId(null),
            })
          ) : (
          options.map((option) =>
            option.renderPanel ? (
              <div
                key={option.id}
                role="menuitem"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePanelId(option.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActivePanelId(option.id);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                {option.icon}
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-gray-500 ml-auto">{option.subtitle}</span>
              </div>
            ) : option.datePicker ? (
              // Row covered by an invisible native date input; picking a date
              // fires onSelect with `${option.id}:YYYY-MM-DD`. On touch
              // devices the tap on the input opens the picker natively (the
              // only way mobile browsers open it), so showPicker() is for
              // mouse users only — calling it on touch too would toggle the
              // freshly opened picker closed.
              <div
                key={option.id}
                role="menuitem"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.matchMedia('(pointer: coarse)').matches) return;
                  const input = e.currentTarget.querySelector('input');
                  if (input) {
                    try {
                      input.showPicker();
                    } catch {
                      input.focus();
                    }
                  }
                }}
                className="relative flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                {option.icon}
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-gray-500 ml-auto">{option.subtitle}</span>
                <input
                  type="date"
                  min={option.min}
                  tabIndex={-1}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      onSelect(`${option.id}:${e.target.value}`);
                      setIsOpen(false);
                    }
                  }}
                />
              </div>
            ) : (
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
            )
          )
          )}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;

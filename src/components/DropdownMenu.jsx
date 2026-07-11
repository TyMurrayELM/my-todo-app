// DropdownMenu.jsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

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
              // Row with a visible native date input; picking a date fires
              // onSelect with `${option.id}:YYYY-MM-DD`. The input must be
              // visible: mobile browsers don't reliably open the picker for
              // hidden inputs, via showPicker(), or via focus().
              <div
                key={option.id}
                role="menuitem"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  // Convenience for mouse users: open the calendar in one
                  // click anywhere on the row. Skipped on touch devices,
                  // where tapping the input itself opens the picker and a
                  // showPicker() call can toggle it closed again.
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
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {option.icon}
                  <span className="text-sm">{option.label}</span>
                </div>
                <input
                  type="date"
                  min={option.min}
                  className="mt-1 w-full text-sm text-gray-600 bg-white border rounded px-1.5 py-1"
                  onClick={(e) => e.stopPropagation()}
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

// BulkActionBar.jsx
import React, { useState } from 'react';
import { X, Check, Trash2, SkipForward, Repeat, Calendar, CalendarDays } from 'lucide-react';

const BulkActionBar = ({ 
  selectedCount, 
  onMove, 
  onRepeat, 
  onDelete, 
  onComplete, 
  onCancel,
  isTaskBank = false 
}) => {
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);

  const moveOptions = [
    { id: 'next-day', label: 'Next Day', icon: <SkipForward size={16} /> },
    { id: 'next-week', label: 'Next Week', icon: <Calendar size={16} /> },
    { id: 'next-weekday', label: 'Next Weekday', icon: <CalendarDays size={16} /> },
    { id: 'next-weekend', label: 'Next Weekend', icon: <Calendar size={16} /> }
  ];

  const repeatOptions = [
    { id: 'daily', label: 'Daily' },
    { id: 'every-other-day', label: 'Every Other Day' },
    { id: 'weekdays', label: 'Weekdays' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'bi-weekly', label: 'Bi-weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'first-of-month', label: '1st of Month' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex items-center justify-around gap-2">
          {/* Complete Button */}
          <button
            onClick={onComplete}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-green-50 text-green-600"
          >
            <Check size={24} />
            <span className="text-xs">Complete</span>
          </button>

          {/* Move Button - hidden for Task Bank */}
          {!isTaskBank && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowMoveOptions(!showMoveOptions);
                  setShowRepeatOptions(false);
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 text-blue-600 ${showMoveOptions ? 'bg-blue-50' : ''}`}
              >
                <SkipForward size={24} />
                <span className="text-xs">Move</span>
              </button>
              
              {showMoveOptions && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-40 bg-white border rounded-lg shadow-lg">
                  {moveOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        onMove(option.id);
                        setShowMoveOptions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm"
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Repeat Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowRepeatOptions(!showRepeatOptions);
                setShowMoveOptions(false);
              }}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-purple-50 text-purple-600 ${showRepeatOptions ? 'bg-purple-50' : ''}`}
            >
              <Repeat size={24} />
              <span className="text-xs">Repeat</span>
            </button>
            
            {showRepeatOptions && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-44 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {repeatOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => {
                      onRepeat(option.id);
                      setShowRepeatOptions(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm"
                  >
                    <Repeat size={14} />
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-red-50 text-red-600"
          >
            <Trash2 size={24} />
            <span className="text-xs">Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionBar;

// CustomFrequencyPicker.jsx
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  buildIntervalFrequency,
  buildWeekdaysFrequency,
  DAY_LETTERS,
  DAY_SHORT_NAMES,
  MAX_INTERVAL,
} from '../lib/frequency';

// Compact panel for picking a custom repeat frequency: either an interval
// (every N days/weeks) or specific weekdays. Calls onConfirm with the
// encoded frequency string ('every:3:days' / 'days:MO,WE,FR').
const CustomFrequencyPicker = ({ onConfirm, onBack }) => {
  const [mode, setMode] = useState('interval');
  const [n, setN] = useState('2');
  const [unit, setUnit] = useState('days');
  const [selectedDays, setSelectedDays] = useState([]);

  const nValue = Number(n);
  const intervalValid = Number.isInteger(nValue) && nValue >= 1 && nValue <= MAX_INTERVAL;
  const canConfirm = mode === 'interval' ? intervalValid : selectedDays.length > 0;

  const toggleDay = (dayIndex) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(
      mode === 'interval'
        ? buildIntervalFrequency(nValue, unit)
        : buildWeekdaysFrequency(selectedDays)
    );
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Header styled like a menu row, with back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-b"
      >
        <ChevronLeft size={14} className="text-gray-400" />
        <span className="text-sm">Custom Repeat</span>
      </button>

      <div className="p-3">
        <div className="flex rounded-lg bg-gray-100 p-0.5 mb-3">
          <button
            type="button"
            onClick={() => setMode('interval')}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              mode === 'interval'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Interval
          </button>
          <button
            type="button"
            onClick={() => setMode('weekdays')}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              mode === 'weekdays'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Weekdays
          </button>
        </div>

        {mode === 'interval' ? (
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className="text-gray-600">Every</span>
            <input
              type="number"
              min="1"
              max={MAX_INTERVAL}
              value={n}
              onChange={(e) => setN(e.target.value)}
              className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Repeat interval"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Interval unit"
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
            </select>
          </div>
        ) : (
          <div className="flex justify-between mb-3">
            {DAY_LETTERS.map((letter, i) => (
              <button
                key={DAY_SHORT_NAMES[i]}
                type="button"
                onClick={() => toggleDay(i)}
                title={DAY_SHORT_NAMES[i]}
                aria-label={DAY_SHORT_NAMES[i]}
                aria-pressed={selectedDays.includes(i)}
                className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                  selectedDays.includes(i)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full rounded-lg bg-green-500 text-white text-sm font-medium py-1.5 hover:bg-green-600 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
        >
          Set Repeat
        </button>
      </div>
    </div>
  );
};

export default CustomFrequencyPicker;

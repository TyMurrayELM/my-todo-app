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
    <div className="p-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Back"
          aria-label="Back"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex flex-1 rounded bg-gray-100 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('interval')}
            className={`flex-1 rounded px-2 py-1 ${
              mode === 'interval' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            Interval
          </button>
          <button
            type="button"
            onClick={() => setMode('weekdays')}
            className={`flex-1 rounded px-2 py-1 ${
              mode === 'weekdays' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            Weekdays
          </button>
        </div>
      </div>

      {mode === 'interval' ? (
        <div className="flex items-center gap-1 text-sm mb-2">
          <span className="text-gray-600">Every</span>
          <input
            type="number"
            min="1"
            max={MAX_INTERVAL}
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="w-14 border rounded px-1 py-0.5 text-sm text-center"
            aria-label="Repeat interval"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="border rounded px-1 py-0.5 text-sm flex-1"
            aria-label="Interval unit"
          >
            <option value="days">days</option>
            <option value="weeks">weeks</option>
          </select>
        </div>
      ) : (
        <div className="flex justify-between gap-0.5 mb-2">
          {DAY_LETTERS.map((letter, i) => (
            <button
              key={DAY_SHORT_NAMES[i]}
              type="button"
              onClick={() => toggleDay(i)}
              title={DAY_SHORT_NAMES[i]}
              aria-label={DAY_SHORT_NAMES[i]}
              aria-pressed={selectedDays.includes(i)}
              className={`w-6 h-6 rounded-full text-xs ${
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
        className="w-full rounded bg-green-500 text-white text-sm py-1 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400"
      >
        Set Repeat
      </button>
    </div>
  );
};

export default CustomFrequencyPicker;

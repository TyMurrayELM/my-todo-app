import { useState, useEffect } from 'react';
import { getLocalDateString } from '../lib/dates';

// App-level "move to a date" dialog. On touch devices the native date picker
// cannot be anchored to an input inside the task menus: the tap that opens it
// also scrolls/collapses the surrounding task UI, unmounting the input and
// dismissing the picker. This modal's DOM is stable for its whole lifetime,
// so the picker anchored to its input survives.
export default function MoveDateModal({ taskCount = 1, onClose, onSave }) {
  const [date, setDate] = useState('');

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        // Close when clicking the backdrop, not the dialog
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">
          {taskCount > 1 ? `Move ${taskCount} tasks to…` : 'Move task to…'}
        </h3>
        <input
          type="date"
          value={date}
          min={getLocalDateString(new Date())}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={() => date && onSave(date)}
            disabled={!date}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

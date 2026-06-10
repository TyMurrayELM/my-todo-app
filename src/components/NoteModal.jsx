import { useState } from 'react';

export default function NoteModal({ task, day, onClose, updateTaskNotes }) {
  const [localNote, setLocalNote] = useState(task?.notes || '');

  if (!task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Edit Note</h3>
        <textarea
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          placeholder="Add your notes here..."
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="6"
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={() => {
              updateTaskNotes(task.id, day, localNote);
              onClose();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

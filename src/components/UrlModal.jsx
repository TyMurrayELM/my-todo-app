import { useState } from 'react';
import { isValidUrl } from '../lib/utils';

export default function UrlModal({ task, day, onClose, updateTaskUrl }) {
  const [localUrl, setLocalUrl] = useState(task?.url || '');

  if (!task) return null;

  const handleSave = () => {
    let trimmed = localUrl.trim();
    if (trimmed && !trimmed.match(/^https?:\/\//i)) {
      trimmed = 'https://' + trimmed.replace(/^(www\.)?/, '');
    }
    if (trimmed && isValidUrl(trimmed)) {
      updateTaskUrl(task.id, day, trimmed);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{task.url ? 'Edit URL' : 'Add URL'}</h3>
        <input
          type="text"
          value={localUrl}
          onChange={(e) => setLocalUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="example.com"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {localUrl.trim() &&
          (() => {
            let test = localUrl.trim();
            if (!test.match(/^https?:\/\//i)) test = 'https://' + test;
            return !isValidUrl(test);
          })() && <p className="text-red-500 text-sm mt-2">Please enter a valid URL</p>}
        <div className="flex justify-end gap-3 mt-4">
          {task.url && (
            <button
              onClick={() => {
                updateTaskUrl(task.id, day, '');
                onClose();
              }}
              className="px-4 py-2 text-red-500 hover:text-red-700 mr-auto"
            >
              Remove
            </button>
          )}
          {task.url && isValidUrl(task.url) && (
            <button
              onClick={() => {
                window.open(task.url, '_blank', 'noopener,noreferrer');
                onClose();
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Open
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// src/components/FinancialDashboard/components/ChartComment.js

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export const ChartComment = ({ chartId }) => {
  const [comment, setComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load existing comment on mount
  useEffect(() => {
    loadComment();
  }, [chartId]);

  const loadComment = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_comments')
        .select('comment')
        .eq('chart_id', chartId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw error;
      }

      if (data) {
        setComment(data.comment || '');
      }
    } catch (err) {
      console.error('Error loading comment:', err);
      setError('Failed to load comment');
    }
  };

  const saveComment = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('chart_comments')
        .upsert(
          { 
            chart_id: chartId, 
            comment: comment 
          },
          { 
            onConflict: 'chart_id' 
          }
        );

      if (error) throw error;

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving comment:', err);
      setError('Failed to save comment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    loadComment(); // Reload original comment
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">Chart Notes</h4>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {comment ? 'Edit' : 'Add Note'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {isEditing ? (
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your notes about this chart..."
            className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            rows={4}
            style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={saveComment}
              disabled={isSaving}
              className="px-4 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors disabled:bg-gray-400"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors disabled:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600" style={{ whiteSpace: 'pre-wrap' }}>
          {comment ? (
            <div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }}>{comment}</div>
          ) : (
            <p className="text-gray-400 italic">No notes added yet</p>
          )}
        </div>
      )}
    </div>
  );
};
import { useState, useEffect, useRef, useContext } from 'react';
import {
  Check,
  X,
  Plus,
  ChevronRight,
  ChevronDown,
  Link,
  StickyNote,
  Calendar,
} from 'lucide-react';
import { isValidUrl, formatCompletionTime } from '../lib/utils';
import RecurringIndicator from './RecurringIndicator';
import RepeatMenu from './RepeatMenu';
import MoveMenu from './MoveMenu';
import { AppContext } from './AppContext';

export default function TaskItem({ task, day, index }) {
  const {
    expandedTaskId,
    setExpandedTaskId,
    isMobile,
    selectedTasks,
    bulkMode,
    editingTaskId,
    setEditingTaskId,
    editingSubItemId,
    setEditingSubItemId,
    addingSubItemTo,
    setAddingSubItemTo,
    newSubItemText,
    setNewSubItemText,
    pendingCompletions,
    primedTaskId,
    setPrimedTaskId,
    expandedSubItems,
    setCurrentNoteTask,
    setShowNoteModal,
    setCurrentUrlTask,
    setCurrentUrlDay,
    setShowUrlModal,
    toggleTaskSelection,
    toggleTask,
    toggleSubItems,
    toggleSubItem,
    updateTaskText,
    updateSubItemText,
    deleteSubItem,
    addSubItem,
    repeatTask,
    openGoogleCalendar,
    moveTask,
    deleteTask,
  } = useContext(AppContext);

  const isExpanded = expandedTaskId === task.id;
  const isDarkBackground = index >= 4;
  const [isHovered, setIsHovered] = useState(false);
  // Keeps the hover-revealed action bar open while a dropdown menu is up,
  // so moving the mouse off the task doesn't collapse an open menu.
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [completedSubExpanded, setCompletedSubExpanded] = useState(false);
  const editInputRef = useRef(null);
  const subItemInputRef = useRef(null);
  const isSelected = selectedTasks.includes(task.id);

  useEffect(() => {
    if (editingTaskId === task.id && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(0, 0);
      editInputRef.current.style.height = 'auto';
      editInputRef.current.style.height = editInputRef.current.scrollHeight + 'px';
    }
  }, [editingTaskId, task.id]);

  useEffect(() => {
    if (addingSubItemTo === task.id && subItemInputRef.current) {
      subItemInputRef.current.focus();
    }
  }, [addingSubItemTo, task.id]);

  const hasSubItems = task.subItems && task.subItems.length > 0;
  const isSubItemsExpanded = expandedSubItems[task.id];

  const visuallyCompleted = Object.prototype.hasOwnProperty.call(pendingCompletions, task.id)
    ? pendingCompletions[task.id]
    : task.completed;

  return (
    <div
      className="relative group pb-3"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
    >
      <div className={`flex items-start gap-3 relative`}>
        {bulkMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskSelection(task.id);
            }}
            className={`w-5 h-5 mt-0.5 border rounded flex-shrink-0 flex items-center justify-center transition-all duration-200
              ${
                isSelected
                  ? 'bg-blue-500 border-blue-500'
                  : isDarkBackground
                    ? 'bg-white/20 border-white/50 hover:border-blue-400'
                    : 'bg-white border-gray-400 hover:border-blue-400'
              }`}
          >
            {isSelected && <Check size={16} className="text-white" />}
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(task.id, day);
            }}
            className={`w-5 h-5 mt-0.5 border rounded flex-shrink-0 flex items-center justify-center transition-all duration-200
              ${
                visuallyCompleted
                  ? 'bg-green-500 border-green-500 scale-110'
                  : primedTaskId === task.id
                    ? 'bg-white border-green-500'
                    : isDarkBackground
                      ? 'bg-white border-white hover:border-green-500'
                      : 'bg-white border-black hover:border-green-500'
              }`}
            style={{
              transform: visuallyCompleted ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s ease-out',
            }}
          >
            {visuallyCompleted && (
              <Check
                size={16}
                className="text-white animate-check"
                style={{ animation: 'checkPop 0.3s ease-out' }}
              />
            )}
          </button>
        )}

        {editingTaskId === task.id ? (
          <textarea
            ref={editInputRef}
            defaultValue={task.text}
            rows={1}
            onFocus={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onBlur={(e) => {
              const value = e.target.value;
              requestAnimationFrame(() => updateTaskText(task.id, day, value));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                updateTaskText(task.id, day, e.target.value);
              } else if (e.key === 'Escape') {
                setEditingTaskId(null);
              }
            }}
            className={`flex-grow bg-transparent border-none focus:outline-none resize-none overflow-hidden ${
              isDarkBackground ? 'text-white' : 'text-gray-700'
            }`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer"
            onClick={() => {
              if (bulkMode) {
                toggleTaskSelection(task.id);
              } else if (isMobile) {
                setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
                setPrimedTaskId(null);
              }
            }}
          >
            {hasSubItems && !bulkMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubItems(task.id);
                }}
                className={`flex-shrink-0 ${isDarkBackground ? 'text-white/60' : 'text-gray-400'} hover:text-gray-600`}
              >
                {isSubItemsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}

            <span
              onClick={(e) => {
                if (bulkMode) {
                  e.stopPropagation();
                  toggleTaskSelection(task.id);
                  return;
                }
                e.stopPropagation();
                if (isMobile) {
                  if (editingTaskId === task.id && expandedTaskId === task.id) {
                    setExpandedTaskId(null);
                    setEditingTaskId(null);
                  } else if (expandedTaskId === task.id) {
                    setEditingTaskId(task.id);
                  } else {
                    setExpandedTaskId(task.id);
                    setPrimedTaskId(null);
                  }
                } else {
                  setEditingTaskId(task.id);
                }
              }}
              className={`${
                visuallyCompleted
                  ? 'line-through text-gray-400'
                  : isDarkBackground
                    ? 'text-white'
                    : 'text-gray-700'
              } ${isSelected ? 'font-medium' : ''} transition-all duration-200`}
              title={task.text}
            >
              {task.text}
            </span>
            {visuallyCompleted && task.completedAt && !bulkMode && (
              <span className="ml-1 text-[10px] opacity-75 flex-shrink-0">
                ({formatCompletionTime(task.completedAt)})
              </span>
            )}
            {!bulkMode && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {hasSubItems && (
                  <span
                    className={`text-xs ${isDarkBackground ? 'text-white/60' : 'text-gray-400'}`}
                  >
                    ({task.subItems.filter((s) => s.completed).length}/{task.subItems.length})
                  </span>
                )}
                {task.recurring && (
                  <RecurringIndicator
                    frequency={task.repeatFrequency || 'daily'}
                    isDarkBackground={isDarkBackground}
                  />
                )}
                {task.notes && (
                  <span className={`${isDarkBackground ? 'text-white/60' : 'text-gray-400'}`}>
                    <StickyNote size={14} fill="#10b981" />
                  </span>
                )}
                {task.url && (
                  <span className={`${isDarkBackground ? 'text-white/60' : 'text-gray-400'}`}>
                    <Link size={14} color="#10b981" />
                  </span>
                )}
              </div>
            )}

            {!bulkMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingSubItemTo(addingSubItemTo === task.id ? null : task.id);
                }}
                className={`flex-shrink-0 p-1 rounded ${isDarkBackground ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                title="Add sub-item"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {!bulkMode &&
        isSubItemsExpanded &&
        hasSubItems &&
        (() => {
          const renderSubItem = (subItem) => (
            <div key={subItem.id} className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubItem(subItem.id, day);
                }}
                className={`w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center transition-colors duration-200
                  ${
                    subItem.completed
                      ? 'bg-green-500 border-green-500'
                      : primedTaskId === subItem.id
                        ? 'bg-white border-green-500'
                        : isDarkBackground
                          ? 'bg-white border-white/50 hover:border-green-500'
                          : 'bg-white border-gray-400 hover:border-green-500'
                  }`}
              >
                {subItem.completed && <Check size={12} className="text-white" />}
              </button>
              {editingSubItemId === subItem.id ? (
                <input
                  type="text"
                  defaultValue={subItem.text}
                  autoFocus
                  onBlur={(e) => updateSubItemText(subItem.id, day, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateSubItemText(subItem.id, day, e.target.value);
                    } else if (e.key === 'Escape') {
                      setEditingSubItemId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-sm flex-grow bg-transparent border-none focus:outline-none ${
                    isDarkBackground ? 'text-white/80' : 'text-gray-600'
                  }`}
                />
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSubItemId(subItem.id);
                  }}
                  className={`text-sm flex-grow cursor-pointer ${
                    subItem.completed
                      ? 'line-through text-gray-400'
                      : isDarkBackground
                        ? 'text-white/80'
                        : 'text-gray-600'
                  }`}
                >
                  {subItem.text}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSubItem(subItem.id, day);
                }}
                className={`p-1 rounded ${isDarkBackground ? 'text-white/40 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
              >
                <X size={14} />
              </button>
            </div>
          );

          const activeSubItems = task.subItems
            .filter((s) => !s.completed)
            .sort((a, b) => a.text.localeCompare(b.text));
          const completedSubItems = task.subItems
            .filter((s) => s.completed)
            .sort((a, b) => a.text.localeCompare(b.text));

          return (
            <div className="ml-8 mt-2 space-y-2">
              {activeSubItems.map(renderSubItem)}
              {completedSubItems.length > 0 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompletedSubExpanded((prev) => !prev);
                    }}
                    className={`flex items-center gap-1.5 text-xs font-medium pt-1 ${
                      isDarkBackground
                        ? 'text-white/60 hover:text-white/90'
                        : 'text-gray-400 hover:text-gray-600'
                    } transition-colors`}
                  >
                    {completedSubExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    Completed ({completedSubItems.length})
                  </button>
                  {completedSubExpanded && completedSubItems.map(renderSubItem)}
                </>
              )}
            </div>
          );
        })()}

      {!bulkMode && (
        <div
          className={`ml-8 transition-all duration-200 ${addingSubItemTo === task.id ? 'mt-2 h-7' : 'h-0 overflow-hidden'}`}
        >
          {addingSubItemTo === task.id && (
            <input
              ref={subItemInputRef}
              type="text"
              value={newSubItemText}
              onChange={(e) => setNewSubItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubItem(task.id, day);
                } else if (e.key === 'Escape') {
                  setAddingSubItemTo(null);
                  setNewSubItemText('');
                }
              }}
              onBlur={() => {
                if (newSubItemText.trim()) {
                  addSubItem(task.id, day);
                } else {
                  setAddingSubItemTo(null);
                  setNewSubItemText('');
                }
              }}
              placeholder="Add sub-item..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className={`w-full text-sm bg-transparent border-b h-7 ${
                isDarkBackground
                  ? 'border-white/30 text-white placeholder-white/50'
                  : 'border-gray-300 text-gray-700 placeholder-gray-400'
              } focus:outline-none focus:border-green-500`}
            />
          )}
        </div>
      )}

      {!isMobile && !bulkMode && (
        <div
          className={`transition-all duration-200 ${isHovered || actionMenuOpen || addingSubItemTo === task.id ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'} overflow-visible`}
        >
          <div className={`ml-8 p-3 rounded-lg relative z-50`}>
            <div className="flex items-center justify-around gap-2">
              <div className="relative">
                <RepeatMenu
                  onSelect={(frequency) => repeatTask(task, day, frequency)}
                  onOpenChange={setActionMenuOpen}
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentNoteTask(task);
                  setShowNoteModal(true);
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title={task.notes ? 'Edit Note' : 'Add Note'}
              >
                <StickyNote
                  size={20}
                  fill={task.notes ? '#10b981' : 'none'}
                  className={task.notes ? 'text-gray-600' : ''}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.url) {
                    if (isValidUrl(task.url))
                      window.open(task.url, '_blank', 'noopener,noreferrer');
                  } else {
                    setCurrentUrlTask(task);
                    setCurrentUrlDay(day);
                    setShowUrlModal(true);
                  }
                }}
                onContextMenu={(e) => {
                  if (task.url) {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentUrlTask(task);
                    setCurrentUrlDay(day);
                    setShowUrlModal(true);
                  }
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title={task.url ? 'Open URL (right-click to edit)' : 'Add URL'}
              >
                <Link size={20} color={task.url ? '#10b981' : 'currentColor'} />
              </button>
              {day !== 'TASK_BANK' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openGoogleCalendar(task, day);
                  }}
                  className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                  title="Add to Google Calendar"
                >
                  <Calendar size={20} />
                </button>
              )}
              {day !== 'TASK_BANK' && index < 6 && (
                <div className="relative">
                  <MoveMenu
                    onSelect={(moveType) => moveTask(task.id, day, moveType)}
                    onOpenChange={setActionMenuOpen}
                  />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTask(task.id, day, task);
                }}
                className={`p-2 rounded text-red-500 hover:text-red-600 transition-colors`}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobile && isExpanded && !bulkMode && (
        <div className={`mt-2 ml-8 p-3 rounded-lg transition-all duration-200`}>
          <div className="flex items-center justify-around gap-2">
            <div className="relative">
              <RepeatMenu
                onSelect={(frequency) => {
                  if (isMobile) setPrimedTaskId(null);
                  repeatTask(task, day, frequency);
                }}
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentNoteTask(task);
                setShowNoteModal(true);
                if (isMobile) setPrimedTaskId(null);
              }}
              className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
              title={task.notes ? 'Edit Note' : 'Add Note'}
            >
              <StickyNote
                size={20}
                fill={task.notes ? '#10b981' : 'none'}
                className={task.notes ? 'text-gray-600' : ''}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isMobile) setPrimedTaskId(null);
                setCurrentUrlTask(task);
                setCurrentUrlDay(day);
                setShowUrlModal(true);
              }}
              className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
              title={task.url ? 'Edit URL' : 'Add URL'}
            >
              <Link size={20} color={task.url ? '#10b981' : 'currentColor'} />
            </button>
            {day !== 'TASK_BANK' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMobile) setPrimedTaskId(null);
                  openGoogleCalendar(task, day);
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title="Add to Google Calendar"
              >
                <Calendar size={20} />
              </button>
            )}
            {day !== 'TASK_BANK' && index < 6 && (
              <div className="relative">
                <MoveMenu
                  onSelect={(moveType) => {
                    if (isMobile) setPrimedTaskId(null);
                    moveTask(task.id, day, moveType);
                  }}
                />
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isMobile) setPrimedTaskId(null);
                deleteTask(task.id, day, task);
              }}
              className={`p-2 rounded text-red-500 hover:text-red-600 transition-colors`}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

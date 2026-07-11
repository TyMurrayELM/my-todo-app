import { useContext, useState } from 'react';
import {
  Check,
  SkipForward,
  Repeat,
  Calendar,
  CalendarDays,
  Layers,
  Trash2,
  ChevronRight,
  ChevronDown,
  CalendarSearch,
  Settings2,
} from 'lucide-react';
import { formatDate, getLocalDateString } from '../lib/dates';
import { AppContext } from './AppContext';
import TaskItem from './TaskItem';
import ProgressBar from './ProgressBar';
import CustomFrequencyPicker from './CustomFrequencyPicker';

const MOVE_OPTIONS = [
  { id: 'today', label: 'Today', icon: <CalendarDays size={16} /> },
  { id: 'next-day', label: 'Next Day', icon: <SkipForward size={16} /> },
  { id: 'next-week', label: 'Next Week', icon: <Calendar size={16} /> },
  { id: 'next-weekday', label: 'Next Weekday', icon: <Calendar size={16} /> },
  { id: 'next-weekend', label: 'Next Weekend', icon: <Calendar size={16} /> },
  { id: 'custom', label: 'Pick a Date', icon: <CalendarSearch size={16} />, datePicker: true },
];

const REPEAT_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'every-other-day', label: 'Every Other Day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'bi-weekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'first-of-month', label: '1st of Month' },
];

// One card in the week list. Weekday cards (index 0-6) show a date row and
// a bulk Move option; the Task Bank card (isTaskBank, index 7) is black,
// dateless, and can't move tasks.
export default function DaySection({ day, index, isTaskBank = false }) {
  const {
    tasks,
    selectedDay,
    selectDay,
    isMobile,
    setExpandedTaskId,
    setPrimedTaskId,
    getDateForDay,
    handleJumpToDate,
    getBackgroundColor,
    progressGradient,
    bulkMode,
    toggleBulkMode,
    selectedTasks,
    showBulkMoveOptions,
    setShowBulkMoveOptions,
    showBulkRepeatOptions,
    setShowBulkRepeatOptions,
    bulkCompleteTasks,
    bulkMoveTasks,
    bulkRepeatTasks,
    bulkDeleteTasks,
    selectAllTasks,
    deselectAllTasks,
    expandedCompletedSections,
    setExpandedCompletedSections,
    newTask,
    setNewTask,
    addTask,
  } = useContext(AppContext);

  // Bulk repeat dropdown: swap the preset list for the custom frequency form
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  const dayTasks = tasks[day];
  const isSelected = isTaskBank ? selectedDay === 'task_bank' : selectedDay === index;
  const isCompletedExpanded = expandedCompletedSections[day] || false;
  const incompleteTasks = dayTasks
    .filter((t) => !t.completed)
    .sort((a, b) => a.text.localeCompare(b.text));
  const completedTasks = dayTasks
    .filter((t) => t.completed)
    .sort((a, b) => a.text.localeCompare(b.text));

  return (
    <div
      onClick={() => {
        selectDay(isTaskBank ? 'task_bank' : index);
        if (isMobile) setPrimedTaskId(null);
      }}
      className={
        isTaskBank
          ? 'bg-black p-6 space-y-2 transition-colors duration-200 cursor-pointer hover:bg-opacity-90'
          : `${getBackgroundColor(index)} p-6 space-y-2 transition-colors duration-200 cursor-pointer overflow-visible
                  ${isSelected ? 'bg-opacity-100' : 'bg-opacity-90'}`
      }
    >
      <div className="flex items-center justify-between">
        <h2
          className={`text-2xl font-bold ${
            isTaskBank ? 'text-white' : index >= 5 ? 'text-gray-100' : 'text-gray-800'
          } flex items-center gap-2`}
        >
          {isTaskBank ? 'Task Bank' : day}
          {!isTaskBank && dayTasks.length > 0 && dayTasks.every((task) => task.completed) && (
            <Check size={24} className="text-green-500 stroke-2" />
          )}
        </h2>

        {/* Bulk action buttons and Layers icon */}
        <div className="flex items-center gap-1">
          {/* Inline bulk action buttons - shown when bulk mode active and tasks selected */}
          {bulkMode && selectedTasks.length > 0 && isSelected && (
            <>
              {/* Complete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bulkCompleteTasks(day);
                }}
                className="p-2 text-green-500 hover:text-green-600 transition-colors"
                title="Complete selected"
              >
                <Check size={20} />
              </button>

              {/* Move button with dropdown - not available in the Task Bank */}
              {!isTaskBank && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBulkMoveOptions(!showBulkMoveOptions);
                      setShowBulkRepeatOptions(false);
                    }}
                    className={`p-2 text-blue-500 hover:text-blue-600 transition-colors ${showBulkMoveOptions ? 'text-blue-600' : ''}`}
                    title="Move selected"
                  >
                    <SkipForward size={20} />
                  </button>
                  {showBulkMoveOptions && (
                    <div className="absolute top-full right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-50">
                      {MOVE_OPTIONS.map((option) =>
                        option.datePicker ? (
                          // Row backed by an invisible native date input;
                          // picking a date moves the batch to that day.
                          <button
                            key={option.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = e.currentTarget.querySelector('input');
                              if (input) {
                                try {
                                  input.showPicker();
                                } catch {
                                  input.focus();
                                }
                              }
                            }}
                            className="relative w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                          >
                            {option.icon}
                            {option.label}
                            <input
                              type="date"
                              min={getLocalDateString(new Date())}
                              tabIndex={-1}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              onChange={(e) => {
                                if (e.target.value) {
                                  bulkMoveTasks(`custom:${e.target.value}`, day);
                                  setShowBulkMoveOptions(false);
                                }
                              }}
                            />
                          </button>
                        ) : (
                          <button
                            key={option.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              bulkMoveTasks(option.id, day);
                              setShowBulkMoveOptions(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                          >
                            {option.icon}
                            {option.label}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Repeat button with dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBulkRepeatOptions(!showBulkRepeatOptions);
                    setShowBulkMoveOptions(false);
                    setShowCustomRepeat(false);
                  }}
                  className={`p-2 text-purple-500 hover:text-purple-600 transition-colors ${showBulkRepeatOptions ? 'text-purple-600' : ''}`}
                  title="Repeat selected"
                >
                  <Repeat size={20} />
                </button>
                {showBulkRepeatOptions && (
                  <div className="absolute top-full right-0 mt-1 w-44 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {showCustomRepeat ? (
                      <CustomFrequencyPicker
                        onConfirm={(frequency) => {
                          bulkRepeatTasks(frequency, day);
                          setShowCustomRepeat(false);
                          setShowBulkRepeatOptions(false);
                        }}
                        onBack={() => setShowCustomRepeat(false)}
                      />
                    ) : (
                      <>
                        {REPEAT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              bulkRepeatTasks(option.id, day);
                              setShowBulkRepeatOptions(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                          >
                            <Repeat size={14} />
                            {option.label}
                          </button>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCustomRepeat(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm text-gray-700"
                        >
                          <Settings2 size={14} />
                          Custom…
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  bulkDeleteTasks(day);
                }}
                className="p-2 text-red-500 hover:text-red-600 transition-colors"
                title="Delete selected"
              >
                <Trash2 size={20} />
              </button>

              {/* Divider */}
              <div className={`w-px h-5 ${index >= 5 ? 'bg-white/30' : 'bg-gray-300'} mx-1`}></div>
            </>
          )}

          {/* Layers (bulk mode toggle) button */}
          {isSelected && dayTasks.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleBulkMode();
              }}
              className={`p-2 rounded-lg transition-colors ${
                bulkMode
                  ? 'bg-blue-500 text-white'
                  : index >= 5
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
              title={bulkMode ? 'Exit bulk mode' : 'Bulk actions'}
            >
              <Layers size={20} />
            </button>
          )}
        </div>
      </div>
      {isSelected && (
        <>
          {!isTaskBank && (
            <p
              className={`text-sm mb-4 cursor-pointer hover:underline relative ${index >= 4 ? 'text-white' : 'text-gray-500'}`}
              onClick={(e) => {
                e.stopPropagation();
                const input = e.currentTarget.querySelector('input');
                if (input) {
                  try {
                    input.showPicker();
                  } catch {
                    input.focus();
                    input.click();
                  }
                }
              }}
            >
              {formatDate(getDateForDay(index))}
              <input
                type="date"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                value={getLocalDateString(getDateForDay(index))}
                onChange={(e) => {
                  if (e.target.value) handleJumpToDate(e.target.value);
                }}
              />
            </p>
          )}
          <ProgressBar dayTasks={dayTasks} index={index} gradient={progressGradient} />

          {/* Select All / Deselect All in bulk mode */}
          {bulkMode && dayTasks.length > 0 && (
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectAllTasks(day);
                }}
                className={`text-xs px-2 py-1 rounded ${
                  index >= 5
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Select All
              </button>
              {selectedTasks.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deselectAllTasks();
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    index >= 5
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Deselect All ({selectedTasks.length})
                </button>
              )}
            </div>
          )}

          <div
            className={isTaskBank ? 'space-y-3' : 'space-y-3 overflow-visible'}
            onClick={(e) => {
              // Close expanded task when clicking empty space on mobile
              if (isMobile && e.target === e.currentTarget) {
                setExpandedTaskId(null);
                setPrimedTaskId(null);
              }
            }}
          >
            {incompleteTasks.map((task) => (
              <TaskItem key={task.id} task={task} day={day} index={index} />
            ))}
            {completedTasks.length > 0 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCompletedSections((prev) => ({
                      ...prev,
                      [day]: !prev[day],
                    }));
                  }}
                  className={`flex items-center gap-1.5 text-xs font-medium pt-2 ${
                    index >= 5
                      ? 'text-white/70 hover:text-white/90'
                      : 'text-gray-500 hover:text-gray-700'
                  } transition-colors`}
                >
                  {isCompletedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  COMPLETED ({completedTasks.length})
                </button>
                {isCompletedExpanded &&
                  completedTasks.map((task) => (
                    <TaskItem key={task.id} task={task} day={day} index={index} />
                  ))}
              </>
            )}
            {!bulkMode && (
              <form
                onSubmit={(e) => addTask(e, day)}
                className="pt-6"
                onClick={(e) => {
                  e.stopPropagation();
                  // Close expanded task when clicking the add task input on mobile
                  if (isMobile) {
                    setExpandedTaskId(null);
                    setPrimedTaskId(null);
                  }
                }}
              >
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTask(e, day);
                    }
                  }}
                  placeholder="Add a new task..."
                  className={
                    isTaskBank
                      ? 'w-full bg-transparent text-sm placeholder-white focus:outline-none text-white'
                      : `w-full bg-transparent text-sm placeholder-gray-400 focus:outline-none
                              ${index >= 4 ? 'text-white placeholder-white' : 'text-gray-500'}`
                  }
                />
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

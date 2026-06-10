import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from './lib/supabase';
import { DAY_NAMES, getLocalDateString } from './lib/dates';
import ThemeSelector from './components/ThemeSelector';
import DaySection from './components/DaySection';
import { useTodos } from './hooks/useTodos';
import { AppProvider } from './components/AppContext';
import NoteModal from './components/NoteModal';
import UrlModal from './components/UrlModal';
import { log, logError } from './lib/log';
import { createGoogleCalendarUrl } from './lib/calendar';
import { MAX_TASK_LENGTH, BG_THEMES, PROGRESS_GRADIENTS } from './lib/constants';

function App() {
  const [session, setSession] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNavigating, setIsNavigating] = useState(false);
  const [colorTheme, setColorTheme] = useState(() => {
    return localStorage.getItem('todoTheme') || 'amber';
  });
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [primedTaskId, setPrimedTaskId] = useState(null);

  // Bulk action state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showBulkMoveOptions, setShowBulkMoveOptions] = useState(false);
  const [showBulkRepeatOptions, setShowBulkRepeatOptions] = useState(false);

  // State for managing which tasks have their sub-items expanded
  const [expandedSubItems, setExpandedSubItems] = useState({});
  // State for adding new sub-items
  const [addingSubItemTo, setAddingSubItemTo] = useState(null);
  const [newSubItemText, setNewSubItemText] = useState('');
  // State for editing sub-items
  const [editingSubItemId, setEditingSubItemId] = useState(null);
  // Track which days have their completed section expanded (collapsed by default)
  const [expandedCompletedSections, setExpandedCompletedSections] = useState({});

  const getCurrentDayIndex = () => {
    const today = currentDate.getDay();
    return today;
  };

  const [days, setDays] = useState(() => {
    const currentIndex = getCurrentDayIndex();
    return [...DAY_NAMES.slice(currentIndex), ...DAY_NAMES.slice(0, currentIndex)];
  });

  const [newTask, setNewTask] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);

  // Notes modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNoteTask, setCurrentNoteTask] = useState(null);

  // URL modal state
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [currentUrlTask, setCurrentUrlTask] = useState(null);
  const [currentUrlDay, setCurrentUrlDay] = useState(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-reset primed task after 3 seconds
  useEffect(() => {
    if (primedTaskId) {
      const timer = setTimeout(() => {
        setPrimedTaskId(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [primedTaskId]);

  // Select a day and clear any bulk-mode state from the previous day
  const selectDay = (value) => {
    if (value !== selectedDay) {
      setBulkMode(false);
      setSelectedTasks([]);
      setShowBulkMoveOptions(false);
      setShowBulkRepeatOptions(false);
    }
    setSelectedDay(value);
  };

  // Close bulk action dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowBulkMoveOptions(false);
      setShowBulkRepeatOptions(false);
    };

    if (showBulkMoveOptions || showBulkRepeatOptions) {
      // Add a small delay to prevent immediate closing when opening
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showBulkMoveOptions, showBulkRepeatOptions]);

  const getBackgroundColor = (index) => BG_THEMES[colorTheme][index];

  const getDateForDay = useCallback(
    (dayIndex) => {
      const date = new Date(currentDate);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + dayIndex);
      return date;
    },
    [currentDate]
  );

  // Clear bulk-mode UI state; passed to useTodos so bulk actions reset the
  // selection at the same point the optimistic update lands.
  const clearBulkSelection = () => {
    setBulkMode(false);
    setSelectedTasks([]);
  };

  const {
    tasks,
    isLoading,
    fetchError,
    setFetchError,
    fetchTodos,
    pendingCompletions,
    saveError,
    dismissSaveError,
    addTask: saveTask,
    toggleTask: toggleTaskCompletion,
    deleteTask,
    moveTask,
    repeatTask,
    updateTaskText: saveTaskText,
    updateTaskUrl,
    updateTaskNotes,
    addSubItem: saveSubItem,
    toggleSubItem,
    deleteSubItem,
    updateSubItemText: saveSubItemText,
    bulkCompleteTasks: bulkComplete,
    bulkMoveTasks: bulkMove,
    bulkRepeatTasks: bulkRepeat,
    bulkDeleteTasks: bulkDelete,
  } = useTodos({ session, days, currentDate, isNavigating, getDateForDay, clearBulkSelection });
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Resolve the task's date, then build the Google Calendar URL
  const openGoogleCalendar = (task, day) => {
    const dayIndex = days.indexOf(day);
    const taskDate = dayIndex >= 0 ? getDateForDay(dayIndex) : new Date();

    // For recurring instances, use the instance date
    if (task.instanceDate) {
      const [year, month, dayNum] = task.instanceDate.split('-');
      taskDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(dayNum));
    }

    const url = createGoogleCalendarUrl(task, taskDate);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const handleNavigation = async (direction) => {
    setIsNavigating(true);
    setBulkMode(false);
    setSelectedTasks([]);
    setShowBulkMoveOptions(false);
    setShowBulkRepeatOptions(false);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);

    const newIndex = newDate.getDay();
    const newDays = [...DAY_NAMES.slice(newIndex), ...DAY_NAMES.slice(0, newIndex)];

    setCurrentDate(newDate);
    setDays(newDays);
    setSelectedDay(0);
    setExpandedTaskId(null);
    setPrimedTaskId(null);

    setTimeout(() => {
      setIsNavigating(false);
    }, 50);
  };

  const handleJumpToDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    const newDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    newDate.setHours(0, 0, 0, 0);

    setIsNavigating(true);
    setBulkMode(false);
    setSelectedTasks([]);
    setShowBulkMoveOptions(false);
    setShowBulkRepeatOptions(false);

    const newIndex = newDate.getDay();
    const newDays = [...DAY_NAMES.slice(newIndex), ...DAY_NAMES.slice(0, newIndex)];

    setCurrentDate(newDate);
    setDays(newDays);
    setSelectedDay(0);
    setExpandedTaskId(null);
    setPrimedTaskId(null);

    setTimeout(() => {
      setIsNavigating(false);
    }, 50);
  };

  // If the tab sits open past midnight, jump to the new "today" when the
  // user comes back — but only if they were viewing the old today, so we
  // never yank them away from a week they navigated to deliberately.
  const lastKnownDateRef = useRef(getLocalDateString(new Date()));
  useEffect(() => {
    const checkDateRollover = () => {
      if (document.hidden) return;
      const realToday = getLocalDateString(new Date());
      if (realToday !== lastKnownDateRef.current) {
        const wasViewingToday = getLocalDateString(currentDate) === lastKnownDateRef.current;
        lastKnownDateRef.current = realToday;
        if (wasViewingToday) handleJumpToDate(realToday);
      }
    };

    document.addEventListener('visibilitychange', checkDateRollover);
    window.addEventListener('focus', checkDateRollover);
    return () => {
      document.removeEventListener('visibilitychange', checkDateRollover);
      window.removeEventListener('focus', checkDateRollover);
    };
  });

  // Toggle bulk mode
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedTasks([]);
  };

  // Toggle task selection in bulk mode
  const toggleTaskSelection = (taskId) => {
    setSelectedTasks((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  // Select all tasks in current day
  const selectAllTasks = (day) => {
    const dayTasks = tasks[day]
      .filter((task) => !task.completed || expandedCompletedSections[day])
      .map((task) => task.id);
    setSelectedTasks(dayTasks);
  };

  // Deselect all tasks
  const deselectAllTasks = () => {
    setSelectedTasks([]);
  };

  // Thin wrappers: pass the current selection / input state into the hook
  // and reset the related UI state at the same points the old inline
  // implementations did.
  const bulkMoveTasks = (moveType, day) => bulkMove(selectedTasks, moveType, day);
  const bulkRepeatTasks = (frequency, day) => bulkRepeat(selectedTasks, frequency, day);
  const bulkDeleteTasks = (day) => bulkDelete(selectedTasks, day);
  const bulkCompleteTasks = (day) => bulkComplete(selectedTasks, day);

  const addTask = async (e, day) => {
    e.preventDefault();
    if (await saveTask(newTask, day)) {
      setNewTask('');
    }
  };

  const addSubItem = (parentTaskId, day) => {
    if (!newSubItemText.trim() || newSubItemText.trim().length > MAX_TASK_LENGTH) return;
    const parentTask = tasks[day].find(
      (t) => t.id === parentTaskId || t.originalId === parentTaskId
    );
    if (!parentTask) return;

    saveSubItem(parentTaskId, day, newSubItemText);
    setNewSubItemText('');
    setAddingSubItemTo(null);
  };

  // Toggle sub-items expansion
  const toggleSubItems = (taskId) => {
    setExpandedSubItems((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleTask = (taskId, day) => {
    // Mobile double-click logic
    if (isMobile) {
      if (primedTaskId === taskId) {
        // Second click - complete the task
        setPrimedTaskId(null);
      } else {
        // First click - prime the task
        setPrimedTaskId(taskId);
        return; // Don't complete yet
      }
    }
    toggleTaskCompletion(taskId, day);
  };

  const updateTaskText = (taskId, day, newText) => {
    if (!newText.trim() || newText.trim().length > MAX_TASK_LENGTH) return;
    saveTaskText(taskId, day, newText);
    setEditingTaskId(null);
  };

  const updateSubItemText = (subItemId, day, newText) => {
    if (!newText.trim() || newText.trim().length > MAX_TASK_LENGTH) return;
    saveSubItemText(subItemId, day, newText);
    setEditingSubItemId(null);
  };
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          prompt: 'select_account',
        },
        redirectTo: window.location.origin,
      },
    });
    if (error) logError('Error logging in:', error);
  };

  const handleLogout = async () => {
    log('Logout button clicked');
    try {
      // signOut clears its own session storage; don't wipe all of
      // localStorage — that would lose the theme preference too.
      await supabase.auth.signOut();
      log('Logout completed');
    } catch (error) {
      logError('Error logging out:', error);
    } finally {
      window.location.replace('/');
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div
          className={`w-80 p-8 mb-8 rounded-2xl ${getBackgroundColor(2)} bg-opacity-10 border-2 border-gray-200 shadow-lg`}
        >
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Welcome to tabs.day</h1>
          <p className="text-center text-gray-600 mb-8">Your to-do organizer</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3" />
            <span className="text-gray-600 font-medium">Continue with Google</span>
          </button>
        </div>
      </div>
    );
  }

  const appCtx = {
    // task data
    tasks,
    // day selection / navigation
    selectedDay,
    selectDay,
    getDateForDay,
    handleJumpToDate,
    // theming
    getBackgroundColor,
    progressGradient: PROGRESS_GRADIENTS[colorTheme],
    // task item UI state
    expandedTaskId,
    setExpandedTaskId,
    isMobile,
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
    expandedCompletedSections,
    setExpandedCompletedSections,
    // modals
    setCurrentNoteTask,
    setShowNoteModal,
    setCurrentUrlTask,
    setCurrentUrlDay,
    setShowUrlModal,
    // bulk mode
    bulkMode,
    toggleBulkMode,
    selectedTasks,
    toggleTaskSelection,
    selectAllTasks,
    deselectAllTasks,
    showBulkMoveOptions,
    setShowBulkMoveOptions,
    showBulkRepeatOptions,
    setShowBulkRepeatOptions,
    bulkCompleteTasks,
    bulkMoveTasks,
    bulkRepeatTasks,
    bulkDeleteTasks,
    // task mutations
    newTask,
    setNewTask,
    addTask,
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
  };

  return (
    <AppProvider value={appCtx}>
      <div className="min-h-screen bg-gray-50">
        <div className="fixed top-0 left-0 right-0 h-16 bg-gray-50 shadow-sm z-50">
          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-gray-200">
              <div
                className="h-full w-1/4 animate-loading-bar"
                style={{ background: PROGRESS_GRADIENTS[colorTheme] }}
              />
            </div>
          )}
          <div className="max-w-md mx-auto relative h-full flex items-center justify-between px-4">
            <div className="flex items-center">
              <button
                onClick={() => handleNavigation(-1)}
                disabled={isNavigating}
                className="text-gray-500 hover:text-gray-700 mr-2"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={() => handleNavigation(1)}
                disabled={isNavigating}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-5">
              <ThemeSelector
                value={colorTheme}
                onChange={(value) => {
                  setColorTheme(value);
                  localStorage.setItem('todoTheme', value);
                }}
              />
            </div>

            <div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLogout();
                }}
                className="text-gray-500 hover:text-gray-700 px-2 py-1 z-50 relative"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                  WebkitTouchCallout: 'none',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="pt-16 px-4">
          <div className="max-w-md mx-auto rounded-3xl shadow-lg">
            <div className="divide-y divide-gray-200 overflow-visible">
              {days.map((day, index) => (
                <DaySection key={day} day={day} index={index} />
              ))}
              <DaySection day="TASK_BANK" index={7} isTaskBank />
            </div>
          </div>
        </div>
        {saveError && !fetchError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
            <span className="text-sm text-red-800">{saveError}</span>
            <button
              onClick={dismissSaveError}
              className="text-xs text-red-500 hover:text-red-700 px-1 rounded hover:bg-red-100"
            >
              Dismiss
            </button>
          </div>
        )}
        {fetchError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] bg-red-50 border border-red-200 rounded-lg shadow-lg p-3 flex items-start gap-3">
            <div className="flex-grow text-sm text-red-800">
              <div className="font-medium">Couldn&apos;t sync your tasks</div>
              <div className="text-red-600 text-xs mt-0.5 break-words">{fetchError}</div>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                onClick={() => fetchTodos()}
                className="text-xs font-medium text-red-700 hover:text-red-900 px-2 py-1 rounded hover:bg-red-100"
              >
                Retry
              </button>
              <button
                onClick={() => setFetchError(null)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {showNoteModal && (
          <NoteModal
            task={currentNoteTask}
            day={selectedDay === 'task_bank' ? 'TASK_BANK' : days[selectedDay]}
            updateTaskNotes={updateTaskNotes}
            onClose={() => {
              setShowNoteModal(false);
              setCurrentNoteTask(null);
            }}
          />
        )}
        {showUrlModal && (
          <UrlModal
            task={currentUrlTask}
            day={currentUrlDay}
            updateTaskUrl={updateTaskUrl}
            onClose={() => {
              setShowUrlModal(false);
              setCurrentUrlTask(null);
              setCurrentUrlDay(null);
            }}
          />
        )}
      </div>
    </AppProvider>
  );
}

export default App;

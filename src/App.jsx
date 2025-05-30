import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, ArrowLeft, ArrowRight, SkipForward, Repeat, Link, StickyNote } from 'lucide-react';
import { supabase } from './lib/supabase';
import ThemeSelector from './components/ThemeSelector';
import RepeatMenu from './components/RepeatMenu';
import RecurringIndicator from './components/RecurringIndicator';
import ToggleSwitch from './components/ToggleSwitch';

function App() {
  const [session, setSession] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNavigating, setIsNavigating] = useState(false);
  const [colorTheme, setColorTheme] = useState(() => {
    return localStorage.getItem('todoTheme') || 'amber';
  });
  const [isRepeating, setIsRepeating] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const getCurrentDayIndex = () => {
    const today = currentDate.getDay();
    return today;
  };
  
  const [days, setDays] = useState(() => {
    const baseArray = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentIndex = getCurrentDayIndex();
    return [...baseArray.slice(currentIndex), ...baseArray.slice(0, currentIndex)];
  });

  const [tasks, setTasks] = useState(() => {
    return {
      ...days.reduce((acc, day) => ({...acc, [day]: []}), {}),
      TASK_BANK: []
    };
  });
  
  const [newTask, setNewTask] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingUrlTaskId, setEditingUrlTaskId] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [hideCompleted, setHideCompleted] = useState(() => {
    return localStorage.getItem('hideCompleted') === 'true';
  });
  
  // New state for notes feature
  const [editingNoteTaskId, setEditingNoteTaskId] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNoteTask, setCurrentNoteTask] = useState(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getBackgroundColor = (index) => {
    const themes = {
      amber: ['bg-amber-100', 'bg-amber-200', 'bg-amber-300', 'bg-amber-400', 'bg-amber-500', 'bg-amber-600', 'bg-amber-700'],
      blue: ['bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700'],
      green: ['bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500', 'bg-green-600', 'bg-green-700'],
      purple: ['bg-purple-100', 'bg-purple-200', 'bg-purple-300', 'bg-purple-400', 'bg-purple-500', 'bg-purple-600', 'bg-purple-700'],
      pink: ['bg-pink-100', 'bg-pink-200', 'bg-pink-300', 'bg-pink-400', 'bg-pink-500', 'bg-pink-600', 'bg-pink-700']
    };
    return themes[colorTheme][index];
  };

  const fetchTodos = useCallback(async () => {
    if (!session || isNavigating) return;
    
    setIsLoading(true);
    
    const start = getDateForDay(0);
    const end = getDateForDay(6);
    end.setHours(23, 59, 59, 999);
  
    const startStr = start.toISOString();
    const endStr = end.toISOString();
  
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .or(`day.eq.TASK_BANK,and(actual_date.gte.${startStr},actual_date.lte.${endStr})`)
      .order('created_at');
  
    if (error) {
      console.error('Error fetching todos:', error);
      setIsLoading(false);
      return;
    }
  
    const todosByDay = {
      SUNDAY: [],
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      TASK_BANK: []
    };
  
    data.forEach(todo => {
      if (todo.day === 'TASK_BANK') {
        todosByDay.TASK_BANK.push({
          id: todo.id,
          text: todo.text.trim(),
          completed: todo.completed,
          recurring: todo.recurring,
          repeatFrequency: todo.repeat_frequency || 'daily',
          url: todo.url,
          notes: todo.notes,
          completedAt: todo.completed_at
        });
      } else {
        const todoDate = new Date(todo.actual_date);
        const dayIndex = days.findIndex(day => {
          const thisDate = getDateForDay(days.indexOf(day));
          return thisDate.toISOString().split('T')[0] === todoDate.toISOString().split('T')[0];
        });
        
        if (dayIndex !== -1) {
          todosByDay[days[dayIndex]].push({
            id: todo.id,
            text: todo.text.trim(),
            completed: todo.completed,
            recurring: todo.recurring,
            repeatFrequency: todo.repeat_frequency || 'daily',
            url: todo.url,
            notes: todo.notes,
            completedAt: todo.completed_at
          });
        }
      }
    });
  
    setTasks(todosByDay);
    console.log('Tasks for current day after fetch:', todosByDay[days[selectedDay]]);
    setIsLoading(false);
  }, [session, currentDate, isNavigating, days, selectedDay]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchTodos();
    }
  }, [session, currentDate, fetchTodos]);

  const getDateForDay = (dayIndex) => {
    const date = new Date(currentDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayIndex);
    return date;
  };

  const formatDate = (date) => {
    return `${date.toLocaleString('default', { month: 'long' })}, ${date.getDate()} ${date.getFullYear()}`;
  };

  const handleNavigation = async (direction) => {
    setIsNavigating(true);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);

    const baseArray = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const newIndex = newDate.getDay();
    const newDays = [...baseArray.slice(newIndex), ...baseArray.slice(0, newIndex)];

    setCurrentDate(newDate);
    setDays(newDays);
    setSelectedDay(0);
    setExpandedTaskId(null);
    
    setTimeout(() => {
      setIsNavigating(false);
    }, 50);
  };

  const moveTask = async (taskId, fromDay, toDay) => {
    const fromDayIndex = days.indexOf(fromDay);
    const nextDate = getDateForDay(fromDayIndex + 1).toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('todos')
      .update({ 
        day: toDay,
        actual_date: nextDate 
      })
      .eq('id', taskId);
  
    if (error) {
      console.error('Error moving todo:', error);
      return;
    }
  
    setTasks(prev => {
      const task = prev[fromDay].find(t => t.id === taskId);
      return {
        ...prev,
        [fromDay]: prev[fromDay].filter(t => t.id !== taskId),
        [toDay]: [...prev[toDay], { ...task, actual_date: nextDate }]
      };
    });
  };

  const addTask = async (e, day) => {
    e.preventDefault();
    if (newTask.trim()) {
      const taskDate = getDateForDay(days.indexOf(day));
      const actualDate = taskDate.toISOString();
      
      const { data, error } = await supabase
        .from('todos')
        .insert([
          {
            user_id: session.user.id,
            text: newTask.trim(),
            day: day,
            actual_date: actualDate,
            completed: false
          }
        ])
        .select()
        .single();
  
      if (error) {
        console.error('Error adding todo:', error);
        return;
      }
  
      setTasks(prev => ({
        ...prev,
        [day]: [...prev[day], { id: data.id, text: data.text, completed: false }]
      }));
      setNewTask('');
    }
  };

  const toggleTask = async (taskId, day) => {
    const updatedTasks = { ...tasks };
    const taskIndex = updatedTasks[day].findIndex(task => task.id === taskId);
    const newCompleted = !updatedTasks[day][taskIndex].completed;
    const completedAt = newCompleted ? new Date().toISOString() : null;
  
    const { error } = await supabase
      .from('todos')
      .update({ 
        completed: newCompleted,
        completed_at: completedAt
      })
      .eq('id', taskId);
  
    if (error) {
      console.error('Error updating todo:', error);
      return;
    }
  
    updatedTasks[day][taskIndex].completed = newCompleted;
    updatedTasks[day][taskIndex].completedAt = completedAt;
    setTasks(updatedTasks);
  };

  const formatCompletionTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatCompletionDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const deleteTask = async (taskId, day, task) => {
    if (task.recurring) {
      await deleteRecurringTasks(task.text, day);
    } else {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', taskId);
  
      if (error) {
        console.error('Error deleting todo:', error);
        return;
      }
    }
  
    fetchTodos();
  };

  const deleteRecurringTasks = async (text, currentDay) => {
    const currentDayIndex = days.indexOf(currentDay);
    const startDate = getDateForDay(currentDayIndex).toISOString();
  
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('text', text.trim())
      .eq('recurring', true)
      .gte('actual_date', startDate);
  
    if (error) {
      console.error('Error deleting recurring todos:', error);
      return;
    }
  };

  const repeatTask = useCallback(async (task, day, frequency = 'daily') => {
    if (isRepeating) return;
    setIsRepeating(true);
  
    setTasks(prev => ({
      ...prev,
      [day]: prev[day].map(t => 
        t.id === task.id ? { ...t, recurring: true, repeatFrequency: frequency } : t
      )
    }));
  
    try {
      const clickedTaskDate = new Date(getDateForDay(days.indexOf(day)));
      clickedTaskDate.setHours(0, 0, 0, 0);
      const clickedDayFormatted = clickedTaskDate.toISOString().split('T')[0];
  
      const operations = [];
  
      operations.push(
        supabase
          .from('todos')
          .delete()
          .eq('text', task.text.trim())
          .eq('day', day)
          .eq('actual_date', clickedDayFormatted)
          .neq('id', task.id)
      );
  
      operations.push(
        supabase
          .from('todos')
          .update({ 
            recurring: true,
            repeat_frequency: frequency 
          })
          .eq('id', task.id)
      );
  
      const futureTasks = [];
      
      for (let i = 1; i <= 60; i++) {
        const targetDate = new Date(clickedTaskDate);
        
        if (frequency === 'daily') {
          targetDate.setDate(clickedTaskDate.getDate() + i);
        } 
        else if (frequency === 'weekly') {
          targetDate.setDate(clickedTaskDate.getDate() + (i * 7));
        }
        else if (frequency === 'monthly') {
          targetDate.setMonth(clickedTaskDate.getMonth() + i);
          
          const originalDay = clickedTaskDate.getDate();
          const maxDaysInMonth = new Date(
            targetDate.getFullYear(), 
            targetDate.getMonth() + 1, 
            0
          ).getDate();
          
          if (originalDay > maxDaysInMonth) {
            targetDate.setDate(maxDaysInMonth);
          }
        }
        
        futureTasks.push({
          user_id: session.user.id,
          text: task.text.trim(),
          day: days[targetDate.getDay()],
          actual_date: targetDate.toISOString(),
          completed: false,
          recurring: true,
          repeat_frequency: frequency
        });
      }
  
      const chunkSize = 10;
      for (let i = 0; i < futureTasks.length; i += chunkSize) {
        const chunk = futureTasks.slice(i, i + chunkSize);
        operations.push(
          supabase
            .from('todos')
            .insert(chunk)
        );
      }
  
      await Promise.all(operations);
      await fetchTodos();
  
    } catch (error) {
      console.error('RepeatTask failed:', error);
      setTasks(prev => ({
        ...prev,
        [day]: prev[day].map(t =>
          t.id === task.id ? { ...t, recurring: false, repeatFrequency: null } : t
        )
      }));
    } finally {
      setIsRepeating(false);
    }
  }, [session, days, fetchTodos, isRepeating]);

  const updateTaskText = async (taskId, day, newText) => {
    if (!newText.trim()) return;
  
    const { error } = await supabase
      .from('todos')
      .update({ text: newText.trim() })
      .eq('id', taskId);
  
    if (error) {
      console.error('Error updating todo:', error);
      return;
    }
  
    setTasks(prev => ({
      ...prev,
      [day]: prev[day].map(task => 
        task.id === taskId 
          ? { ...task, text: newText.trim() }
          : task
      )
    }));
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  const updateTaskUrl = async (taskId, day, url) => {
    const { error } = await supabase
      .from('todos')
      .update({ url: url })
      .eq('id', taskId);
  
    if (error) {
      console.error('Error updating todo URL:', error);
      return;
    }
  
    setTasks(prev => ({
      ...prev,
      [day]: prev[day].map(task =>
        task.id === taskId 
          ? { ...task, url }
          : task
      )
    }));
    setEditingUrlTaskId(null);
    setUrlInput('');
  };

  // New function for updating notes
  const updateTaskNotes = async (taskId, day, notes) => {
    const { error } = await supabase
      .from('todos')
      .update({ notes: notes })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating todo notes:', error);
      return;
    }

    setTasks(prev => ({
      ...prev,
      [day]: prev[day].map(task =>
        task.id === taskId 
          ? { ...task, notes }
          : task
      )
    }));
    setShowNoteModal(false);
    setCurrentNoteTask(null);
    setNoteInput('');
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          prompt: 'select_account',
        },
        redirectTo: 'https://www.tabs.day'
      }
    });
    if (error) console.error('Error logging in:', error);
  };
  
  const handleLogout = async () => {
    console.log('Logout button clicked');
    try {
      localStorage.clear();
      await supabase.auth.signOut();
      console.log('Logout completed');
      setTimeout(() => {
        window.location.replace('/');
      }, 100);
    } catch (error) {
      console.error('Error logging out:', error);
      window.location.href = '/';
    }
  };

  const handleToggleHideCompleted = () => {
    const newValue = !hideCompleted;
    setHideCompleted(newValue);
    localStorage.setItem('hideCompleted', newValue);
  };

  const handleTaskClick = (taskId) => {
    if (isMobile) {
      setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
    }
  };

  // Note Modal Component
  const NoteModal = ({ task, day, onClose }) => {
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
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
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
  };

  // Task Component with expandable actions for mobile
  const TaskItem = ({ task, day, index }) => {
    const isExpanded = expandedTaskId === task.id;
    const isDarkBackground = index >= 4;
    
    return (
      <div className="relative group">
        <div className={`flex items-start gap-3 relative`}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(task.id, day);
            }}
            className={`w-5 h-5 mt-0.5 border rounded flex-shrink-0 flex items-center justify-center transition-colors duration-200
              ${task.completed ? 'bg-green-500 border-green-500' : isDarkBackground ? 'border-white hover:border-green-500' : 'border-black hover:border-green-500'}`}
          >
            {task.completed && <Check size={16} className="text-white" />}
          </button>
          
          {editingTaskId === task.id ? (
            <input
              type="text"
              value={editingTaskText}
              onChange={(e) => setEditingTaskText(e.target.value)}
              onBlur={() => updateTaskText(task.id, day, editingTaskText)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateTaskText(task.id, day, editingTaskText);
                } else if (e.key === 'Escape') {
                  setEditingTaskId(null);
                  setEditingTaskText('');
                }
              }}
              className={`flex-grow bg-transparent border-none focus:outline-none ${
                isDarkBackground ? 'text-white' : 'text-gray-700'
              }`}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <div 
              className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer"
              onClick={() => {
                if (isMobile) {
                  // Toggle expand/collapse
                  setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
                }
              }}
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  // If already editing and expanded, collapse it
                  if (isMobile && editingTaskId === task.id && expandedTaskId === task.id) {
                    setExpandedTaskId(null);
                    setEditingTaskId(null);
                    setEditingTaskText('');
                  } else {
                    // Otherwise, start editing and expand on mobile
                    setEditingTaskId(task.id);
                    setEditingTaskText(task.text);
                    if (isMobile) {
                      setExpandedTaskId(task.id);
                    }
                  }
                }}
                className={`${
                  task.completed ? 'line-through text-gray-400' : 
                  isDarkBackground ? 'text-white' : 'text-gray-700'
                } transition-all duration-200`}
                title={task.text}
              >
                {task.text}
              </span>
              {task.completed && task.completedAt && (
                <span className="ml-1 text-[10px] opacity-75 flex-shrink-0">
                  ({formatCompletionTime(task.completedAt)})
                </span>
              )}
              {/* Status indicators - always visible */}
              <div className="flex items-center gap-1 flex-shrink-0">
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
            </div>
          )}
        </div>
        
        {/* Desktop hover actions - now shown below */}
        <div className={`${!isMobile ? 'max-h-0 overflow-hidden transition-[max-height] duration-200 ease-in-out group-hover:max-h-24' : 'hidden'}`}>
          <div className={`mt-2 ml-8 p-3 rounded-lg`}>
            <div className="flex items-center justify-around gap-2">
              <div className="relative">
                <RepeatMenu onSelect={(frequency) => repeatTask(task, day, frequency)} />
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentNoteTask(task);
                  setShowNoteModal(true);
                  setNoteInput(task.notes || '');
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title={task.notes ? "Edit Note" : "Add Note"}
              >
                <StickyNote 
                  size={20} 
                  fill={task.notes ? "#10b981" : "none"} 
                  className={task.notes ? "text-gray-600" : ""}
                />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.url) {
                    window.open(task.url, '_blank');
                  } else {
                    const url = prompt('Enter URL:');
                    if (url) {
                      updateTaskUrl(task.id, day, url);
                    }
                  }
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title={task.url ? "Open URL" : "Add URL"}
              >
                <Link size={20} color={task.url ? "#10b981" : "currentColor"} />
              </button>
              {day !== 'TASK_BANK' && index < 6 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextDayIndex = (days.indexOf(day) + 1) % 7;
                    moveTask(task.id, day, days[nextDayIndex]);
                  }}
                  className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                  title="Move to next day"
                >
                  <SkipForward size={20} />
                </button>
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
        </div>
        
        {/* Mobile expanded actions */}
        {isMobile && isExpanded && (
          <div className={`mt-2 ml-8 p-3 rounded-lg transition-all duration-200`}>
            <div className="flex items-center justify-around gap-2">
              <div className="relative">
                <RepeatMenu onSelect={(frequency) => repeatTask(task, day, frequency)} />
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentNoteTask(task);
                  setShowNoteModal(true);
                  setNoteInput(task.notes || '');
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title={task.notes ? "Edit Note" : "Add Note"}
              >
                <StickyNote 
                  size={20} 
                  fill={task.notes ? "#10b981" : "none"} 
                  className={task.notes ? "text-gray-600" : ""}
                />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.url) {
                    window.open(task.url, '_blank');
                  } else {
                    const url = prompt('Enter URL:');
                    if (url) {
                      updateTaskUrl(task.id, day, url);
                    }
                  }
                }}
                className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                title={task.url ? "Open URL" : "Add URL"}
              >
                <Link size={20} color={task.url ? "#10b981" : "currentColor"} />
              </button>
              {day !== 'TASK_BANK' && index < 6 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextDayIndex = (days.indexOf(day) + 1) % 7;
                    moveTask(task.id, day, days[nextDayIndex]);
                  }}
                  className={`p-2 rounded ${isDarkBackground ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                  title="Move to next day"
                >
                  <SkipForward size={20} />
                </button>
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
        )}
      </div>
    );
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className={`w-80 p-8 mb-8 rounded-2xl ${getBackgroundColor(2)} bg-opacity-10 border-2 border-gray-200 shadow-lg`}>
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Welcome to tabs.day</h1>
          <p className="text-center text-gray-600 mb-8">Your to-do organizer</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <img 
              src="https://www.google.com/favicon.ico" 
              alt="Google" 
              className="w-5 h-5 mr-3"
            />
            <span className="text-gray-600 font-medium">Continue with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 h-16 bg-gray-50 shadow-sm z-50">
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
            <ToggleSwitch 
              isOn={hideCompleted} 
              handleToggle={handleToggleHideCompleted}
            />
            
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
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="pt-16 px-4">
        <div className="max-w-md mx-auto rounded-3xl shadow-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {days.map((day, index) => (
              <div 
                key={day}
                onClick={() => setSelectedDay(index)}
                className={`${getBackgroundColor(index)} p-6 space-y-2 transition-colors duration-200 cursor-pointer
                  ${index === selectedDay ? 'bg-opacity-100' : 'bg-opacity-90'}`}
              >
                <h2 className={`text-2xl font-bold ${index >= 5 ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                  {day}
                  {tasks[day].length > 0 && tasks[day].every(task => task.completed) && (
                    <Check size={24} className="text-green-500 stroke-2" />
                  )}
                </h2>
                {index === selectedDay && (
                  <>
                    <p className={`text-sm mb-4 ${index >= 4 ? 'text-white' : 'text-gray-500'}`}>
                      {formatDate(getDateForDay(index))}
                    </p>
                    <div className="space-y-3" onClick={(e) => {
                      // Close expanded task when clicking empty space on mobile
                      if (isMobile && e.target === e.currentTarget) {
                        setExpandedTaskId(null);
                      }
                    }}>
                      {tasks[day]
                        .filter(task => !hideCompleted || !task.completed)
                        .sort((a, b) => {
                          if (a.completed !== b.completed) {
                            return b.completed - a.completed;
                          }
                          return a.text.localeCompare(b.text);
                        })
                        .map(task => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            day={day} 
                            index={index}
                          />
                        ))}
                      <form onSubmit={(e) => addTask(e, day)} className="pt-2" onClick={e => {
                        e.stopPropagation();
                        // Close expanded task when clicking the add task input on mobile
                        if (isMobile) {
                          setExpandedTaskId(null);
                        }
                      }}>
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
                          className={`w-full bg-transparent text-sm placeholder-gray-400 focus:outline-none
                            ${index >= 4 ? 'text-white placeholder-white' : 'text-gray-500'}`}
                        />
                      </form>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div 
              onClick={() => setSelectedDay('task_bank')}
              className="bg-black p-6 space-y-2 transition-colors duration-200 cursor-pointer hover:bg-opacity-90"
            >
              <h2 className="text-2xl font-bold text-white">Task Bank</h2>
              {selectedDay === 'task_bank' && (
                <>
                  <div className="space-y-3" onClick={(e) => {
                    // Close expanded task when clicking empty space on mobile
                    if (isMobile && e.target === e.currentTarget) {
                      setExpandedTaskId(null);
                    }
                  }}>
                    {tasks.TASK_BANK
                      .filter(task => !hideCompleted || !task.completed)
                      .sort((a, b) => {
                        if (a.completed !== b.completed) {
                          return b.completed - a.completed;
                        }
                        return a.text.localeCompare(b.text);
                      })
                      .map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          day="TASK_BANK" 
                          index={7}
                        />
                      ))}
                    <form onSubmit={(e) => addTask(e, 'TASK_BANK')} className="pt-2" onClick={e => {
                      e.stopPropagation();
                      // Close expanded task when clicking the add task input on mobile
                      if (isMobile) {
                        setExpandedTaskId(null);
                      }
                    }}>
                      <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTask(e, 'TASK_BANK');
                          }
                        }}
                        placeholder="Add a new task..."
                        className="w-full bg-transparent text-sm placeholder-white focus:outline-none text-white"
                      />
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showNoteModal && (
        <NoteModal 
          task={currentNoteTask} 
          day={selectedDay === 'task_bank' ? 'TASK_BANK' : days[selectedDay]} 
          onClose={() => {
            setShowNoteModal(false);
            setCurrentNoteTask(null);
            setNoteInput('');
          }}
        />
      )}
    </div>
  );
}

export default App;
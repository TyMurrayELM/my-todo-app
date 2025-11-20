import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowLeft, ArrowRight, SkipForward, Repeat, Link, StickyNote, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from './lib/supabase';
import ThemeSelector from './components/ThemeSelector';
import RepeatMenu from './components/RepeatMenu';
import MoveMenu from './components/MoveMenu';
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
  const [primedTaskId, setPrimedTaskId] = useState(null);
  
  // State for managing which tasks have their sub-items expanded
  const [expandedSubItems, setExpandedSubItems] = useState({});
  // State for adding new sub-items
  const [addingSubItemTo, setAddingSubItemTo] = useState(null);
  const [newSubItemText, setNewSubItemText] = useState('');
  
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

  // Auto-reset primed task after 3 seconds
  useEffect(() => {
    if (primedTaskId) {
      const timer = setTimeout(() => {
        setPrimedTaskId(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [primedTaskId]);

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

  const getProgressBarGradient = () => {
    // Create a full gradient from light to dark
    const themes = {
      amber: 'linear-gradient(to right, #fcd34d 0%, #fbbf24 20%, #f59e0b 40%, #d97706 60%, #b45309 80%, #92400e 100%)',
      blue: 'linear-gradient(to right, #93c5fd 0%, #60a5fa 20%, #3b82f6 40%, #2563eb 60%, #1d4ed8 80%, #1e3a8a 100%)',
      green: 'linear-gradient(to right, #86efac 0%, #4ade80 20%, #22c55e 40%, #16a34a 60%, #15803d 80%, #14532d 100%)',
      purple: 'linear-gradient(to right, #d8b4fe 0%, #c084fc 20%, #a855f7 40%, #9333ea 60%, #7e22ce 80%, #3b0764 100%)',
      pink: 'linear-gradient(to right, #fbcfe8 0%, #f9a8d4 20%, #ec4899 40%, #db2777 60%, #be185d 80%, #500724 100%)'
    };
    
    return themes[colorTheme];
  };

  const calculateProgress = (dayTasks) => {
    if (!dayTasks || dayTasks.length === 0) return { percentage: 0, completed: 0, total: 0 };
    const visibleTasks = hideCompleted ? dayTasks.filter(task => !task.completed) : dayTasks;
    const completed = dayTasks.filter(task => task.completed).length;
    const total = dayTasks.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    return { percentage, completed, total };
  };

  // Helper function to check if a date matches a recurring rule
  const shouldShowOnDate = (task, targetDate) => {
    if (!task.recurring || !task.repeat_frequency) return false;

    const taskStartDate = parseUTCDateAsLocal(task.actual_date);
    taskStartDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(targetDate);
    checkDate.setHours(0, 0, 0, 0);

    // Don't show before the start date
    if (checkDate < taskStartDate) return false;

    const daysDiff = Math.floor((checkDate - taskStartDate) / (1000 * 60 * 60 * 24));
    const targetDayOfWeek = checkDate.getDay();

    switch (task.repeat_frequency) {
      case 'daily':
        return true;
      
      case 'weekdays':
        return targetDayOfWeek !== 0 && targetDayOfWeek !== 6; // Mon-Fri
      
      case 'weekly':
        return daysDiff % 7 === 0;
      
      case 'bi-weekly':
        return daysDiff % 14 === 0;
      
      case 'monthly':
        const taskDay = taskStartDate.getDate();
        const targetDay = checkDate.getDate();
        const monthsDiff = (checkDate.getFullYear() - taskStartDate.getFullYear()) * 12 + 
                          (checkDate.getMonth() - taskStartDate.getMonth());
        
        // Handle end-of-month edge cases
        const daysInTargetMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0).getDate();
        const adjustedTaskDay = Math.min(taskDay, daysInTargetMonth);
        
        return monthsDiff >= 0 && targetDay === adjustedTaskDay;
      
      default:
        return false;
    }
  };

  const fetchTodos = useCallback(async () => {
    if (!session || isNavigating) return;
    
    setIsLoading(true);
    
    const start = getDateForDay(0);
    const end = getDateForDay(6);
    end.setHours(23, 59, 59, 999);
  
    const startStr = getLocalDateString(start);
    const endStr = getLocalDateString(end);
  
    console.log('Fetching todos between:', startStr, 'and', endStr);
  
    // First, fetch parent tasks (tasks without parent_task_id)
    // For recurring tasks, we need their start date to be <= endStr (they could have started before our week)
    // For non-recurring tasks, we need them to be within our date range
    const { data: parentTodos, error: parentError } = await supabase
      .from('todos')
      .select('*')
      .is('parent_task_id', null)
      .or(`day.eq.TASK_BANK,and(recurring.eq.true,actual_date.lte.${endStr}T23:59:59.999Z),and(recurring.eq.false,actual_date.gte.${startStr}T00:00:00.000Z,actual_date.lte.${endStr}T23:59:59.999Z)`)
      .order('created_at');
  
    if (parentError) {
      console.error('Error fetching parent todos:', parentError);
      setIsLoading(false);
      return;
    }

    // Now fetch all sub-items for these parent tasks
    const parentIds = parentTodos.map(t => t.id);
    let subItemTodos = [];
    
    if (parentIds.length > 0) {
      const { data: subItems, error: subItemsError } = await supabase
        .from('todos')
        .select('*')
        .in('parent_task_id', parentIds);
      
      if (!subItemsError && subItems) {
        subItemTodos = subItems;
      }
    }

    // Combine parent tasks and sub-items
    const allTodos = [...parentTodos, ...subItemTodos];
    console.log('Fetched todos:', allTodos);

    // Fetch completion records for recurring tasks
    const recurringTodoIds = allTodos.filter(t => t.recurring).map(t => t.id);
    let completionRecords = [];
    
    if (recurringTodoIds.length > 0) {
      const { data: completions, error: completionsError } = await supabase
        .from('recurring_completions')
        .select('*')
        .in('todo_id', recurringTodoIds)
        .gte('completion_date', startStr)
        .lte('completion_date', endStr);
      
      if (!completionsError && completions) {
        completionRecords = completions;
      }
    }

    // Fetch sub-item completion records for recurring tasks
    const subItemIds = allTodos.filter(t => t.parent_task_id && allTodos.find(p => p.id === t.parent_task_id && p.recurring)).map(t => t.id);
    let subItemCompletionRecords = [];
    
    if (subItemIds.length > 0) {
      const { data: subCompletions, error: subCompletionsError } = await supabase
        .from('recurring_subitem_completions')
        .select('*')
        .in('subitem_id', subItemIds)
        .gte('completion_date', startStr)
        .lte('completion_date', endStr);
      
      if (!subCompletionsError && subCompletions) {
        subItemCompletionRecords = subCompletions;
      }
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
  
    // Separate parent tasks and sub-items
    const parentTasks = allTodos.filter(todo => !todo.parent_task_id);
    const subItems = allTodos.filter(todo => todo.parent_task_id);

    // Create a map of parent task IDs to their sub-items
    const subItemsMap = {};
    subItems.forEach(subItem => {
      if (!subItemsMap[subItem.parent_task_id]) {
        subItemsMap[subItem.parent_task_id] = [];
      }
      
      // For regular (non-recurring) tasks, use actual completion status
      const parentTask = parentTasks.find(p => p.id === subItem.parent_task_id);
      
      subItemsMap[subItem.parent_task_id].push({
        id: subItem.id,
        text: subItem.text.trim(),
        completed: subItem.completed, // Default for non-recurring
        completedAt: subItem.completed_at,
        parentTaskId: subItem.parent_task_id,
        isRecurringSubItem: parentTask?.recurring || false
      });
    });

    // Process parent tasks
    parentTasks.forEach(todo => {
      if (todo.day === 'TASK_BANK') {
        // Task Bank items don't recur
        todosByDay.TASK_BANK.push({
          id: todo.id,
          text: todo.text.trim(),
          completed: todo.completed,
          recurring: todo.recurring,
          repeatFrequency: todo.repeat_frequency || 'daily',
          url: todo.url,
          notes: todo.notes,
          completedAt: todo.completed_at,
          subItems: subItemsMap[todo.id] || [],
          isRecurringInstance: false
        });
      } else if (todo.recurring) {
        // Generate instances for each day in the week
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const targetDate = getDateForDay(dayIndex);
          
          if (shouldShowOnDate(todo, targetDate)) {
            const dateStr = getLocalDateString(targetDate);
            const completion = completionRecords.find(
              c => c.todo_id === todo.id && c.completion_date === dateStr
            );
            
            // Get sub-items for this instance with their completion status for this date
            const instanceSubItems = (subItemsMap[todo.id] || []).map(subItem => {
              const subCompletion = subItemCompletionRecords.find(
                sc => sc.subitem_id === subItem.id && sc.completion_date === dateStr
              );
              
              return {
                ...subItem,
                completed: !!subCompletion,
                completedAt: subCompletion?.completed_at || null
              };
            });
            
            todosByDay[days[dayIndex]].push({
              id: `${todo.id}_${dateStr}`, // Unique ID for this instance
              originalId: todo.id, // Keep reference to template
              text: todo.text.trim(),
              completed: !!completion,
              recurring: true,
              repeatFrequency: todo.repeat_frequency || 'daily',
              url: todo.url,
              notes: todo.notes,
              completedAt: completion?.completed_at || null,
              subItems: instanceSubItems,
              isRecurringInstance: true,
              instanceDate: dateStr
            });
          }
        }
      } else {
        // Regular one-time task - FIX IS HERE
        const todoDate = parseUTCDateAsLocal(todo.actual_date);
        const todoDateStr = getLocalDateString(todoDate);
        
        console.log('Processing regular task:', todo.text, 'with date:', todoDateStr);
        
        // Find which day index this date belongs to in our current week view
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const thisDate = getDateForDay(dayIndex);
          const thisDateStr = getLocalDateString(thisDate);
          
          if (thisDateStr === todoDateStr) {
            console.log('Matched to day:', days[dayIndex], 'at index', dayIndex);
            
            todosByDay[days[dayIndex]].push({
              id: todo.id,
              text: todo.text.trim(),
              completed: todo.completed,
              recurring: false,
              repeatFrequency: null,
              url: todo.url,
              notes: todo.notes,
              completedAt: todo.completed_at,
              subItems: subItemsMap[todo.id] || [],
              isRecurringInstance: false
            });
            break;
          }
        }
      }
    });
  
    console.log('Final tasks by day:', todosByDay);
    setTasks(todosByDay);
    setIsLoading(false);
  }, [session, currentDate, isNavigating, days]);

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

  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseUTCDateAsLocal = (dateString) => {
    // Parse a YYYY-MM-DD string as if it's in local time, not UTC
    const [year, month, day] = dateString.split('T')[0].split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  const getISOStringForLocalDate = (date) => {
    // Create an ISO string but for the local date at noon to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T12:00:00.000Z`;
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
    setPrimedTaskId(null);
    
    setTimeout(() => {
      setIsNavigating(false);
    }, 50);
  };

  const moveTask = async (taskId, fromDay, moveType = 'next-day') => {
    const task = tasks[fromDay].find(t => t.id === taskId);
    if (!task) return;

    // Calculate the target date based on move type
    const fromDayIndex = days.indexOf(fromDay);
    const currentTaskDate = getDateForDay(fromDayIndex);
    let targetDate = new Date(currentTaskDate);
    
    if (moveType === 'next-day') {
      targetDate.setDate(currentTaskDate.getDate() + 1);
    } else if (moveType === 'next-week') {
      targetDate.setDate(currentTaskDate.getDate() + 7);
    } else if (moveType === 'next-weekday') {
      // Move to next weekday
      targetDate.setDate(currentTaskDate.getDate() + 1);
      while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    } else if (moveType === 'next-weekend') {
      // Move to next Saturday
      const daysUntilSaturday = (6 - currentTaskDate.getDay() + 7) % 7;
      const daysToAdd = daysUntilSaturday === 0 ? 7 : daysUntilSaturday;
      targetDate.setDate(currentTaskDate.getDate() + daysToAdd);
    }
    
    // Figure out which day this lands on
    const targetDayOfWeek = targetDate.getDay();
    const targetDayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][targetDayOfWeek];
    
    if (task.isRecurringInstance) {
      // For recurring instances: create a one-time task on target date
      // and mark today as skipped
      
      // 1. Create one-time task on target date
      const { error: createError } = await supabase
        .from('todos')
        .insert([{
          user_id: session.user.id,
          text: task.text,
          day: targetDayName,
          actual_date: getISOStringForLocalDate(targetDate),
          completed: false,
          recurring: false,
          url: task.url,
          notes: task.notes
        }]);
      
      if (createError) {
        console.error('Error creating moved task:', createError);
        return;
      }

      // 2. Mark today's instance as completed (to hide it)
      const { error: skipError } = await supabase
        .from('recurring_completions')
        .insert([{
          user_id: session.user.id,
          todo_id: task.originalId,
          completion_date: task.instanceDate,
          completed_at: new Date().toISOString()
        }]);
      
      if (skipError) {
        console.error('Error skipping today:', skipError);
        return;
      }

      // 3. Copy sub-items to the new task if any exist
      if (task.subItems && task.subItems.length > 0) {
        // First get the newly created task ID
        const { data: newTask } = await supabase
          .from('todos')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('text', task.text)
          .eq('day', targetDayName)
          .eq('actual_date', getISOStringForLocalDate(targetDate))
          .eq('recurring', false)
          .single();

        if (newTask) {
          const subItemsToCreate = task.subItems.map(sub => ({
            user_id: session.user.id,
            text: sub.text,
            day: targetDayName,
            actual_date: getISOStringForLocalDate(targetDate),
            completed: false,
            parent_task_id: newTask.id
          }));

          await supabase
            .from('todos')
            .insert(subItemsToCreate);
        }
      }
    } else {
      // For regular tasks: just move them normally
      const { error } = await supabase
        .from('todos')
        .update({ 
          day: targetDayName,
          actual_date: getISOStringForLocalDate(targetDate)
        })
        .eq('id', taskId);
    
      if (error) {
        console.error('Error moving todo:', error);
        return;
      }
    }
  
    // Refresh todos to show the change
    await fetchTodos();
  };

  const addTask = async (e, day) => {
    e.preventDefault();
    if (newTask.trim()) {
      const taskDate = getDateForDay(days.indexOf(day));
      const actualDate = getISOStringForLocalDate(taskDate);
      
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
        [day]: [...prev[day], { id: data.id, text: data.text, completed: false, subItems: [] }]
      }));
      setNewTask('');
    }
  };

  // Function to add a sub-item
  const addSubItem = async (parentTaskId, day) => {
    if (!newSubItemText.trim()) return;

    const parentTask = tasks[day].find(t => t.id === parentTaskId || t.originalId === parentTaskId);
    if (!parentTask) return;

    // Use originalId for recurring tasks, regular id for one-time tasks
    const actualParentId = parentTask.originalId || parentTask.id;

    const { data, error } = await supabase
      .from('todos')
      .insert([
        {
          user_id: session.user.id,
          text: newSubItemText.trim(),
          day: day,
          actual_date: new Date().toISOString(),
          completed: false,
          parent_task_id: actualParentId
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding sub-item:', error);
      return;
    }

    // Refresh to get updated sub-items
    await fetchTodos();
    setNewSubItemText('');
    setAddingSubItemTo(null);
  };

  // Function to toggle sub-item completion
  const toggleSubItem = async (subItemId, day) => {
    const parentTask = tasks[day].find(task => 
      task.subItems && task.subItems.some(sub => sub.id === subItemId)
    );
    
    if (!parentTask) return;

    const subItem = parentTask.subItems.find(sub => sub.id === subItemId);
    const newCompleted = !subItem.completed;

    if (subItem.isRecurringSubItem && parentTask.isRecurringInstance) {
      // Handle recurring sub-item - use completion tracking table
      if (newCompleted) {
        // Add completion record
        const { error } = await supabase
          .from('recurring_subitem_completions')
          .insert([{
            user_id: session.user.id,
            subitem_id: subItemId,
            parent_todo_id: parentTask.originalId,
            completion_date: parentTask.instanceDate,
            completed_at: new Date().toISOString()
          }]);
        
        if (error) {
          console.error('Error marking recurring sub-item complete:', error);
          return;
        }
      } else {
        // Remove completion record
        const { error } = await supabase
          .from('recurring_subitem_completions')
          .delete()
          .eq('subitem_id', subItemId)
          .eq('completion_date', parentTask.instanceDate);
        
        if (error) {
          console.error('Error unmarking recurring sub-item:', error);
          return;
        }
      }
    } else {
      // Handle regular sub-item - update the todo directly
      const completedAt = newCompleted ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('todos')
        .update({ 
          completed: newCompleted,
          completed_at: completedAt
        })
        .eq('id', subItemId);

      if (error) {
        console.error('Error updating sub-item:', error);
        return;
      }
    }

    // Refresh tasks
    await fetchTodos();
  };

  // Function to delete a sub-item
  const deleteSubItem = async (subItemId, day) => {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', subItemId);

    if (error) {
      console.error('Error deleting sub-item:', error);
      return;
    }

    await fetchTodos();
  };

  // Toggle sub-items expansion
  const toggleSubItems = (taskId) => {
    setExpandedSubItems(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const toggleTask = async (taskId, day) => {
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
    
    const task = tasks[day].find(t => t.id === taskId);
    if (!task) return;

    if (task.isRecurringInstance) {
      // Handle recurring instance
      const newCompleted = !task.completed;
      
      if (newCompleted) {
        // Add completion record
        const { error } = await supabase
          .from('recurring_completions')
          .insert([{
            user_id: session.user.id,
            todo_id: task.originalId,
            completion_date: task.instanceDate,
            completed_at: new Date().toISOString()
          }]);
        
        if (error) {
          console.error('Error marking recurring task complete:', error);
          return;
        }
      } else {
        // Remove completion record
        const { error } = await supabase
          .from('recurring_completions')
          .delete()
          .eq('todo_id', task.originalId)
          .eq('completion_date', task.instanceDate);
        
        if (error) {
          console.error('Error unmarking recurring task:', error);
          return;
        }
      }
    } else {
      // Handle regular task
      const newCompleted = !task.completed;
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
    }
  
    await fetchTodos();
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
    // Get the actual task ID (template ID for recurring instances)
    const actualId = task.isRecurringInstance ? task.originalId : taskId;
    
    // Confirm deletion for recurring tasks
    if (task.recurring) {
      const confirmDelete = window.confirm(
        'This is a recurring task. Deleting it will remove it from all future dates. Are you sure?'
      );
      if (!confirmDelete) return;
    }
    
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', actualId);

    if (error) {
      console.error('Error deleting todo:', error);
      return;
    }
  
    fetchTodos();
  };

  const repeatTask = useCallback(async (task, day, frequency = 'daily') => {
    if (isRepeating) return;
    setIsRepeating(true);
  
    try {
      const taskId = task.originalId || task.id;
      const clickedTaskDate = new Date(getDateForDay(days.indexOf(day)));
      clickedTaskDate.setHours(0, 0, 0, 0);
      
      // Update the task to be recurring
      const { error: updateError } = await supabase
        .from('todos')
        .update({ 
          recurring: true,
          repeat_frequency: frequency,
          actual_date: getISOStringForLocalDate(clickedTaskDate)
        })
        .eq('id', taskId);
      
      if (updateError) {
        console.error('Error updating task:', updateError);
        throw updateError;
      }
  
      await fetchTodos();
  
    } catch (error) {
      console.error('RepeatTask failed:', error);
    } finally {
      setIsRepeating(false);
    }
  }, [session, days, fetchTodos, isRepeating]);

  const updateTaskText = async (taskId, day, newText) => {
    if (!newText.trim()) return;
    
    const task = tasks[day].find(t => t.id === taskId);
    if (!task) return;

    const actualId = task.originalId || task.id;
    
    // Update the task (or template for recurring)
    const { error } = await supabase
      .from('todos')
      .update({ text: newText.trim() })
      .eq('id', actualId);
  
    if (error) {
      console.error('Error updating todo:', error);
      return;
    }
    
    // Refresh all tasks to show the updates
    await fetchTodos();
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  const updateTaskUrl = async (taskId, day, url) => {
    const task = tasks[day].find(t => t.id === taskId);
    if (!task) return;

    const actualId = task.originalId || task.id;

    const { error } = await supabase
      .from('todos')
      .update({ url: url })
      .eq('id', actualId);
  
    if (error) {
      console.error('Error updating todo URL:', error);
      return;
    }
  
    await fetchTodos();
    setEditingUrlTaskId(null);
    setUrlInput('');
  };

  // New function for updating notes
  const updateTaskNotes = async (taskId, day, notes) => {
    const task = tasks[day].find(t => t.id === taskId);
    if (!task) return;

    const actualId = task.originalId || task.id;

    const { error } = await supabase
      .from('todos')
      .update({ notes: notes })
      .eq('id', actualId);

    if (error) {
      console.error('Error updating todo notes:', error);
      return;
    }

    await fetchTodos();
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
        redirectTo: window.location.origin
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

  // Progress Bar Component
  const ProgressBar = ({ day, index }) => {
    const { percentage, completed, total } = calculateProgress(tasks[day]);
    const isDarkBackground = index >= 4;
    
    if (total === 0) return null;
    
    return (
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className={`text-xs ${isDarkBackground ? 'text-white/70' : 'text-gray-600'}`}>
            {completed}/{total} completed
          </span>
          <span className={`text-xs font-medium ${isDarkBackground ? 'text-white/70' : 'text-gray-600'}`}>
            {Math.round(percentage)}%
          </span>
        </div>
        <div className={`w-full h-2 rounded-full ${isDarkBackground ? 'bg-white/20' : 'bg-gray-200'} overflow-hidden`}>
          <div 
            className="h-full transition-all duration-500 ease-out rounded-full"
            style={{ 
              width: `${percentage}%`,
              background: getProgressBarGradient(),
              backgroundSize: `${10000/percentage}% 100%`,
              backgroundPosition: 'left'
            }}
          />
        </div>
      </div>
    );
  };

  // Task Component with expandable actions for mobile
  const TaskItem = ({ task, day, index }) => {
    const isExpanded = expandedTaskId === task.id;
    const isDarkBackground = index >= 4;
    const [isHovered, setIsHovered] = useState(false);
    const editInputRef = useRef(null);
    const subItemInputRef = useRef(null);
    
    // Focus when editing starts
    useEffect(() => {
      if (editingTaskId === task.id && editInputRef.current) {
        editInputRef.current.focus();
      }
    }, [editingTaskId, task.id]);

    // Focus when adding sub-item
    useEffect(() => {
      if (addingSubItemTo === task.id && subItemInputRef.current) {
        subItemInputRef.current.focus();
      }
    }, [addingSubItemTo, task.id]);
    
    const hasSubItems = task.subItems && task.subItems.length > 0;
    const isSubItemsExpanded = expandedSubItems[task.id];
    
    return (
      <div 
        className="relative group pb-3"
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
      >
        <div className={`flex items-start gap-3 relative`}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(task.id, day);
            }}
            className={`w-5 h-5 mt-0.5 border rounded flex-shrink-0 flex items-center justify-center transition-colors duration-200
              ${task.completed ? 'bg-green-500 border-green-500' : 
                primedTaskId === task.id ? 'bg-white border-green-500' :
                isDarkBackground ? 'bg-white border-white hover:border-green-500' : 'bg-white border-black hover:border-green-500'}`}
          >
            {task.completed && <Check size={16} className="text-white" />}
          </button>
          
          {editingTaskId === task.id ? (
            <input
              ref={editInputRef}
              type="text"
              defaultValue={task.text}
              onBlur={(e) => updateTaskText(task.id, day, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateTaskText(task.id, day, e.target.value);
                } else if (e.key === 'Escape') {
                  setEditingTaskId(null);
                  setEditingTaskText('');
                }
              }}
              className={`flex-grow bg-transparent border-none focus:outline-none ${
                isDarkBackground ? 'text-white' : 'text-gray-700'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div 
              className="flex-grow flex items-center gap-2 min-w-0 cursor-pointer"
              onClick={() => {
                if (isMobile) {
                  // Toggle expand/collapse
                  setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
                  setPrimedTaskId(null); // Clear primed state
                }
              }}
            >
              {/* Chevron for expanding/collapsing sub-items */}
              {hasSubItems && (
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
                  e.stopPropagation();
                  // If already editing and expanded, collapse it
                  if (isMobile && editingTaskId === task.id && expandedTaskId === task.id) {
                    setExpandedTaskId(null);
                    setEditingTaskId(null);
                  } else {
                    // Otherwise, start editing and expand on mobile
                    setEditingTaskId(task.id);
                    if (isMobile) {
                      setExpandedTaskId(task.id);
                      setPrimedTaskId(null); // Clear primed state when editing
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
                {/* Show sub-item count */}
                {hasSubItems && (
                  <span className={`text-xs ${isDarkBackground ? 'text-white/60' : 'text-gray-400'}`}>
                    ({task.subItems.filter(s => s.completed).length}/{task.subItems.length})
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
              
              {/* Plus button to add sub-item */}
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
            </div>
          )}
        </div>

        {/* Sub-items display */}
        {isSubItemsExpanded && hasSubItems && (
          <div className="ml-8 mt-2 space-y-2">
            {task.subItems.map(subItem => (
              <div key={subItem.id} className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSubItem(subItem.id, day);
                  }}
                  className={`w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center transition-colors duration-200
                    ${subItem.completed ? 'bg-green-500 border-green-500' : 
                      isDarkBackground ? 'bg-white border-white/50 hover:border-green-500' : 'bg-white border-gray-400 hover:border-green-500'}`}
                >
                  {subItem.completed && <Check size={12} className="text-white" />}
                </button>
                <span className={`text-sm flex-grow ${
                  subItem.completed ? 'line-through text-gray-400' : 
                  isDarkBackground ? 'text-white/80' : 'text-gray-600'
                }`}>
                  {subItem.text}
                </span>
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
            ))}
          </div>
        )}

        {/* Add sub-item input - always reserve space */}
        <div className={`ml-8 transition-all duration-200 ${addingSubItemTo === task.id ? 'mt-2 h-7' : 'h-0 overflow-hidden'}`}>
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
                isDarkBackground ? 'border-white/30 text-white placeholder-white/50' : 'border-gray-300 text-gray-700 placeholder-gray-400'
              } focus:outline-none focus:border-green-500`}
            />
          )}
        </div>
        
{/* Desktop hover actions - now shown below */}
{!isMobile && (
  <div className={`transition-all duration-200 ${(isHovered || addingSubItemTo === task.id) ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'} overflow-visible`}>
    <div className={`ml-8 p-3 rounded-lg relative z-50`}>
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
                <div className="relative">
                  <MoveMenu onSelect={(moveType) => moveTask(task.id, day, moveType)} />
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
        
        {/* Mobile expanded actions */}
        {isMobile && isExpanded && (
          <div className={`mt-2 ml-8 p-3 rounded-lg transition-all duration-200`}>
            <div className="flex items-center justify-around gap-2">
              <div className="relative">
                <RepeatMenu onSelect={(frequency) => {
                  if (isMobile) setPrimedTaskId(null);
                  repeatTask(task, day, frequency);
                }} />
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentNoteTask(task);
                  setShowNoteModal(true);
                  setNoteInput(task.notes || '');
                  if (isMobile) setPrimedTaskId(null);
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
                  if (isMobile) setPrimedTaskId(null);
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
                <div className="relative">
                  <MoveMenu onSelect={(moveType) => {
                    if (isMobile) setPrimedTaskId(null);
                    moveTask(task.id, day, moveType);
                  }} />
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
        <div className="max-w-md mx-auto rounded-3xl shadow-lg">
          <div className="divide-y divide-gray-200 overflow-visible">
            {days.map((day, index) => (
              <div 
                key={day}
                onClick={() => {
                  setSelectedDay(index);
                  if (isMobile) setPrimedTaskId(null);
                }}
                className={`${getBackgroundColor(index)} p-6 space-y-2 transition-colors duration-200 cursor-pointer overflow-visible
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
                    <ProgressBar day={day} index={index} />
                    <div className="space-y-3 overflow-visible" onClick={(e) => {
                      // Close expanded task when clicking empty space on mobile
                      if (isMobile && e.target === e.currentTarget) {
                        setExpandedTaskId(null);
                        setPrimedTaskId(null);
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
                      <form onSubmit={(e) => addTask(e, day)} className="pt-6" onClick={e => {
                        e.stopPropagation();
                        // Close expanded task when clicking the add task input on mobile
                        if (isMobile) {
                          setExpandedTaskId(null);
                          setPrimedTaskId(null);
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
              onClick={() => {
                setSelectedDay('task_bank');
                if (isMobile) setPrimedTaskId(null);
              }}
              className="bg-black p-6 space-y-2 transition-colors duration-200 cursor-pointer hover:bg-opacity-90"
            >
              <h2 className="text-2xl font-bold text-white">Task Bank</h2>
              {selectedDay === 'task_bank' && (
                <>
                  <ProgressBar day="TASK_BANK" index={7} />
                  <div className="space-y-3" onClick={(e) => {
                    // Close expanded task when clicking empty space on mobile
                    if (isMobile && e.target === e.currentTarget) {
                      setExpandedTaskId(null);
                      setPrimedTaskId(null);
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
                    <form onSubmit={(e) => addTask(e, 'TASK_BANK')} className="pt-6" onClick={e => {
                      e.stopPropagation();
                      // Close expanded task when clicking the add task input on mobile
                      if (isMobile) {
                        setExpandedTaskId(null);
                        setPrimedTaskId(null);
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
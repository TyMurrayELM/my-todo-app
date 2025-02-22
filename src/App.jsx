import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, ArrowLeft, ArrowRight, SkipForward, Repeat, Link } from 'lucide-react';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNavigating, setIsNavigating] = useState(false);
  const [colorTheme, setColorTheme] = useState(() => {
    return localStorage.getItem('todoTheme') || 'amber';
  });
  
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

  const getBackgroundColor = (index) => {
    const themes = {
      amber: [
        'bg-amber-100',
        'bg-amber-200',
        'bg-amber-300',
        'bg-amber-400',
        'bg-amber-500',
        'bg-amber-600',
        'bg-amber-700'
      ],
      blue: [
        'bg-blue-100',
        'bg-blue-200',
        'bg-blue-300',
        'bg-blue-400',
        'bg-blue-500',
        'bg-blue-600',
        'bg-blue-700'
      ],
      green: [
        'bg-green-100',
        'bg-green-200',
        'bg-green-300',
        'bg-green-400',
        'bg-green-500',
        'bg-green-600',
        'bg-green-700'
      ],
      purple: [
        'bg-purple-100',
        'bg-purple-200',
        'bg-purple-300',
        'bg-purple-400',
        'bg-purple-500',
        'bg-purple-600',
        'bg-purple-700'
      ],
      pink: [
        'bg-pink-100',
        'bg-pink-200',
        'bg-pink-300',
        'bg-pink-400',
        'bg-pink-500',
        'bg-pink-600',
        'bg-pink-700'
      ]
    };
    return themes[colorTheme][index];
  };

  const fetchTodos = useCallback(async () => {
    if (!session || isNavigating) return;
    
    setIsLoading(true);
    
    // Get precise date range for the week
    const start = getDateForDay(0);
    const end = getDateForDay(6);
    end.setHours(23, 59, 59, 999); // Set to end of day
  
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
      if (todosByDay[todo.day]) {
        todosByDay[todo.day].push({
          id: todo.id,
          text: todo.text,
          completed: todo.completed,
          recurring: todo.recurring,
          url: todo.url,
          completedAt: todo.completed_at  // Add this line
        });
      }
    })
  
    setTasks(todosByDay);
    setIsLoading(false);
  }, [session, currentDate, isNavigating]);

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
    date.setHours(0, 0, 0, 0); // Set to start of day
    date.setDate(currentDate.getDate() + dayIndex);
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
    
    setTimeout(() => {
      setIsNavigating(false);
    }, 50);
  };

  const moveTask = async (taskId, fromDay, toDay) => {
    // Get the next day's date
    const fromDayIndex = days.indexOf(fromDay);
    const nextDate = getDateForDay(fromDayIndex + 1).toISOString().split('T')[0];
    
    // Update the task in Supabase
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
  
    // Update local state
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
    const completedAt = newCompleted ? new Date().toISOString() : null;  // Add this line
  
    const { error } = await supabase
      .from('todos')
      .update({ 
        completed: newCompleted,
        completed_at: completedAt  // Add this line
      })
      .eq('id', taskId);
  
    if (error) {
      console.error('Error updating todo:', error);
      return;
    }
  
    updatedTasks[day][taskIndex].completed = newCompleted;
    updatedTasks[day][taskIndex].completedAt = completedAt;  // Add this line
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
      // Delete this and all future recurring instances
      await deleteRecurringTasks(task.text, day);
    } else {
      // Delete just this task
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', taskId);
  
      if (error) {
        console.error('Error deleting todo:', error);
        return;
      }
    }
  
    // Refresh the tasks
    fetchTodos();
  };

  const deleteRecurringTasks = async (text, currentDay) => {
    // Get current day index
    const currentDayIndex = days.indexOf(currentDay);
    
    // Get date range for future days
    const startDate = getDateForDay(currentDayIndex).toISOString();
  
    // Delete all future tasks with the same text that are marked as recurring
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('text', text)
      .eq('recurring', true)
      .gte('actual_date', startDate);
  
    if (error) {
      console.error('Error deleting recurring todos:', error);
      return;
    }
  };


// Add this outside your component (e.g., at the top of the file)
let isRepeating = false;

const repeatTask = async (task, day) => {
  if (isRepeating) {
    console.log('Repeat already in progress, skipping');
    return;
  }

  isRepeating = true;
  console.log('Starting repeatTask for task:', task.id, 'on day:', day);

  try {
    // First update the current task to mark it as recurring
    const { error: updateError } = await supabase
      .from('todos')
      .update({ recurring: true })
      .eq('id', task.id);

    if (updateError) {
      console.error('Error updating current todo:', updateError);
      return;
    }
    
    // Get current task's date for comparison
    const currentTaskDate = new Date(getDateForDay(days.indexOf(day)));
    currentTaskDate.setHours(0, 0, 0, 0);
    console.log('Current task date:', currentTaskDate.toISOString());
    const currentDayFormatted = currentTaskDate.toISOString().split('T')[0];
    
    // Create instances for the next 30 days starting from tomorrow
    for (let i = 1; i <= 30; i++) {
      const targetDate = new Date(currentTaskDate);
      targetDate.setDate(targetDate.getDate() + i);
      
      const formattedDate = targetDate.toISOString().split('T')[0];
      if (formattedDate === currentDayFormatted) {
        console.log('Skipping today:', formattedDate);
        continue;
      }
      const targetDayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][targetDate.getDay()];
      console.log(`Checking day ${targetDayName} for date ${formattedDate}, i=${i}`);
      
      // Check if task already exists for this date, excluding the current task
      const { data: existing } = await supabase
        .from('todos')
        .select('*')
        .eq('text', task.text)
        .eq('day', targetDayName)
        .eq('recurring', true)
        .gte('actual_date', `${formattedDate}T00:00:00`)
        .lt('actual_date', `${formattedDate}T23:59:59`)
        .neq('id', task.id);

      console.log(`Existing tasks for ${formattedDate}:`, existing);

      if (!existing || existing.length === 0) {
        console.log(`Inserting new task for ${formattedDate}`);
        const { data, error } = await supabase
          .from('todos')
          .insert([{
            user_id: session.user.id,
            text: task.text,
            day: targetDayName,
            actual_date: targetDate.toISOString(),
            completed: false,
            recurring: true
          }])
          .select()
          .single();

        if (error) {
          console.error(`Error inserting task for ${formattedDate}:`, error);
        } else {
          console.log(`Inserted task ID: ${data.id} for ${formattedDate}`);
        }
      } else {
        console.log(`Task already exists for ${formattedDate}, skipping`);
      }
    }

    console.log('Fetching todos after repeat');
    await fetchTodos();
  } finally {
    isRepeating = false; // Reset the lock even if there's an error
  }
};

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
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className={`w-full max-w-md p-8 mb-8 rounded-2xl ${getBackgroundColor(2)} bg-opacity-10 border-2 border-gray-200 shadow-lg`}>
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
      {/* Fixed navigation header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-gray-50 shadow-sm z-50">
        <div className="max-w-md mx-auto relative h-full flex items-center justify-between px-4">
          {/* Left side - arrows */}
          <div className="flex space-x-2">
            <button 
              onClick={() => handleNavigation(-1)}
              disabled={isNavigating}
              className="text-gray-500 hover:text-gray-700"
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

          {/* Center - theme selector */}
          <select 
            value={colorTheme}
            onChange={(e) => {
              setColorTheme(e.target.value);
              localStorage.setItem('todoTheme', e.target.value);
            }}
            className="text-sm border rounded px-2 py-1 text-gray-700 bg-white"
          >
            <option value="amber">Amber</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="purple">Purple</option>
            <option value="pink">Pink</option>
          </select>

          {/* Right side - sign out */}
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
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
                    <div className="space-y-3">
                    {tasks[day]
                      .sort((a, b) => {
                        // First sort by completion status
                            if (a.completed !== b.completed) {
                               return b.completed - a.completed;
                            }
                            // Then sort alphabetically if both are completed or both are uncompleted
                        return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                        })
                .map(task => (
  <div key={task.id} className="group flex items-start gap-3">
    <button 
      onClick={(e) => {
        e.stopPropagation();
        toggleTask(task.id, day);
      }}
      className={`w-5 h-5 mt-0.5 border rounded flex items-center justify-center transition-colors duration-200
        ${task.completed ? 'bg-green-500 border-green-500' : index >= 4 ? 'border-white hover:border-green-500' : 'border-black hover:border-green-500'}`}
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
      index >= 4 ? 'text-white' : 'text-gray-700'
    }`}
    onClick={(e) => e.stopPropagation()}
    autoFocus
  />
) : (
<div className="flex-grow flex items-center gap-2">
  <span
    onClick={(e) => {
      e.stopPropagation();
      setEditingTaskId(task.id);
      setEditingTaskText(task.text);
    }}
    className={`${
      task.completed ? 'line-through text-gray-400' : 
      index >= 4 ? 'text-white' : 'text-gray-700'
    }`}
  >
    {task.text}
  </span>
  {task.completed && task.completedAt && (
    <span className="ml-1 text-[10px] opacity-75">
      ({formatCompletionTime(task.completedAt)})
    </span>
  )}
{task.recurring && (
  <span 
    className={`flex items-center gap-1 ${index >= 4 ? 'text-white/60' : 'text-gray-400'}`}
    title="Repeats daily"
  >
    <Repeat size={14} />
    <span className="text-xs">d</span>
  </span>
)}
  {task.url && (
    <a 
      href={task.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`${index >= 4 ? 'text-white/60' : 'text-gray-400'} hover:text-blue-500`}
      title="Open URL"
    >
      <Link size={14} />
    </a>
  )}
</div>
)}

<div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
  <button 
    onClick={(e) => {
      e.stopPropagation();
      repeatTask(task, day);
    }}
    className={`${index >= 4 ? 'text-white' : 'text-gray-400'} hover:text-green-500`}
    title="Repeat for future days"
  >
    <Repeat size={16} />
  </button>
  <button 
  onClick={(e) => {
    e.stopPropagation();
    const url = prompt('Enter URL:');
    if (url) {
      updateTaskUrl(task.id, day, url);
    }
  }}
  className={`${index >= 4 ? 'text-white' : 'text-gray-400'} hover:text-blue-500`}
  title="Add URL"
>
  <Link size={16} />
</button>
  {index < 6 && (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        const nextDayIndex = (days.indexOf(day) + 1) % 7;
        moveTask(task.id, day, days[nextDayIndex]);
      }}
      className={`${index >= 4 ? 'text-white' : 'text-gray-400'} hover:text-yellow-500`}
      title="Move to next day"
    >
      <SkipForward size={16} />
    </button>
  )}
  <button 
    onClick={(e) => {
      e.stopPropagation();
      deleteTask(task.id, day, task);
    }}
    className="text-gray-400 hover:text-red-500"
  >
    <X size={16} />
  </button>
</div>
  </div>
))}
                      <form onSubmit={(e) => addTask(e, day)} className="pt-2" onClick={e => e.stopPropagation()}>
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

{/* Task Bank section */}
<div 
  onClick={() => setSelectedDay('task_bank')}
  className="bg-black p-6 space-y-2 transition-colors duration-200 cursor-pointer hover:bg-opacity-90"
>
  <h2 className="text-2xl font-bold text-white">Task Bank</h2>
  {selectedDay === 'task_bank' && (
    <>
      <div className="space-y-3">
         {tasks.TASK_BANK
            .sort((a, b) => {
               // First sort by completion status
               if (a.completed !== b.completed) {
                  return b.completed - a.completed;
           }
             // Then sort alphabetically if both are completed or both are uncompleted
           return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
         })
        .map(task => (
          <div key={task.id} className="group flex items-start gap-3">
           <button 
  onClick={(e) => {
    e.stopPropagation();
    toggleTask(task.id, 'TASK_BANK');
  }}
  className={`w-5 h-5 mt-0.5 border rounded flex items-center justify-center transition-colors duration-200
    ${task.completed ? 'bg-green-500 border-green-500' : 'border-white hover:border-green-500'}`}
>
  {task.completed && <Check size={16} className="text-white" />}
</button>

            {editingTaskId === task.id ? (
              <input
                type="text"
                value={editingTaskText}
                onChange={(e) => setEditingTaskText(e.target.value)}
                onBlur={() => updateTaskText(task.id, 'TASK_BANK', editingTaskText)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateTaskText(task.id, 'TASK_BANK', editingTaskText);
                  } else if (e.key === 'Escape') {
                    setEditingTaskId(null);
                    setEditingTaskText('');
                  }
                }}
                className="flex-grow bg-transparent border-none focus:outline-none text-white"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <div className="flex-grow flex items-center gap-2 text-white">
<span
  onClick={(e) => {
    e.stopPropagation();
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
  }}
>
  {task.text}
  {task.completed && task.completedAt && (
    <span className="ml-2 text-sm opacity-60">
      ({formatCompletionDate(task.completedAt)})
    </span>
  )}
</span>
{task.recurring && (
  <span 
    className="flex items-center gap-1 text-white"
    title="Repeats daily"
  >
    <Repeat size={14} />
    <span className="text-xs">d</span>
  </span>
)}
                {task.url && (
                  <a 
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-white hover:text-blue-500"
                    title="Open URL"
                  >
                    <Link size={14} />
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const url = prompt('Enter URL:');
                  if (url) {
                    updateTaskUrl(task.id, 'TASK_BANK', url);
                  }
                }}
                className="text-white hover:text-blue-500"
                title="Add URL"
              >
                <Link size={16} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTask(task.id, 'TASK_BANK', task);
                }}
                className="text-white hover:text-red-500"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
        <form onSubmit={(e) => addTask(e, 'TASK_BANK')} className="pt-2" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}

export default App;
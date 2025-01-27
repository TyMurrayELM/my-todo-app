import React, { useState, useEffect } from 'react';
import { Check, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from './lib/supabase';

function App() {
 const [session, setSession] = useState(null);
 const [selectedDay, setSelectedDay] = useState(0);
 const [currentDate, setCurrentDate] = useState(new Date());
 
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
   return days.reduce((acc, day) => ({...acc, [day]: []}), {});
 });
 
 const [newTask, setNewTask] = useState('');
 
 useEffect(() => {
   supabase.auth.getSession().then(({ data: { session } }) => {
     setSession(session);
     if (session) fetchTodos();
   });

   const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
     setSession(session);
     if (session) fetchTodos();
   });

   return () => subscription.unsubscribe();
 }, []);

 async function fetchTodos() {
   const startOfWeek = getDateForDay(0).toISOString().split('T')[0];
   const endOfWeek = getDateForDay(6).toISOString().split('T')[0];

   const { data, error } = await supabase
     .from('todos')
     .select('*')
     .gte('actual_date', startOfWeek)
     .lte('actual_date', endOfWeek)
     .order('created_at');

   if (error) {
     console.error('Error fetching todos:', error);
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
   };

   data.forEach(todo => {
     if (todosByDay[todo.day]) {
       todosByDay[todo.day].push({
         id: todo.id,
         text: todo.text,
         completed: todo.completed,
         actual_date: todo.actual_date
       });
     }
   });

   setTasks(todosByDay);
 }

 const getDateForDay = (dayIndex) => {
   const date = new Date(currentDate);
   date.setDate(currentDate.getDate() + dayIndex);
   return date;
 };

 const formatDate = (date) => {
   return `${date.toLocaleString('default', { month: 'long' })}, ${date.getDate()} ${date.getFullYear()}`;
 };

 const getBackgroundColor = (index) => {
   const colors = [
     'bg-amber-100',
     'bg-amber-200',
     'bg-amber-300',
     'bg-amber-400',
     'bg-amber-500',
     'bg-amber-600',
     'bg-amber-700'
   ];
   return colors[index];
 };

 const addTask = async (e, day) => {
   e.preventDefault();
   if (newTask.trim()) {
     const actualDate = getDateForDay(days.indexOf(day)).toISOString().split('T')[0];
     
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

   const { error } = await supabase
     .from('todos')
     .update({ completed: newCompleted })
     .eq('id', taskId);

   if (error) {
     console.error('Error updating todo:', error);
     return;
   }

   updatedTasks[day][taskIndex].completed = newCompleted;
   setTasks(updatedTasks);
 };

 const deleteTask = async (taskId, day) => {
   const { error } = await supabase
     .from('todos')
     .delete()
     .eq('id', taskId);

   if (error) {
     console.error('Error deleting todo:', error);
     return;
   }

   setTasks(prev => ({
     ...prev,
     [day]: prev[day].filter(task => task.id !== taskId)
   }));
 };

 const handleLogin = async () => {
   const { error } = await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       queryParams: {
         prompt: 'select_account',
       },
       redirectTo: 'https://my-todo-app-tau-eight.vercel.app'
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
     <div className="min-h-screen flex items-center justify-center bg-gray-50">
       <button
         onClick={handleLogin}
         className="flex items-center px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
       >
         <img 
           src="https://www.google.com/favicon.ico" 
           alt="Google" 
           className="w-5 h-5 mr-3"
         />
         <span className="text-gray-600">Sign in with Google</span>
       </button>
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-gray-50 p-4">
     <div className="max-w-md mx-auto rounded-3xl shadow-lg overflow-hidden">
       <button
         onClick={handleLogout}
         className="fixed top-4 right-4 text-sm text-gray-500 hover:text-gray-700 p-4 z-50"
       >
         Sign Out
       </button>
       <button 
  onClick={async () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
    setDays(() => {
      const baseArray = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const newIndex = newDate.getDay();
      return [...baseArray.slice(newIndex), ...baseArray.slice(0, newIndex)];
    });
    setSelectedDay(0);
    await fetchTodos(); // Wait for fetch to complete
  }}
  className="absolute left-4 top-4 text-gray-500 hover:text-gray-700 z-50"
>
  <ArrowLeft size={20} />
</button>
<button 
  onClick={async () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
    setDays(() => {
      const baseArray = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const newIndex = newDate.getDay();
      return [...baseArray.slice(newIndex), ...baseArray.slice(0, newIndex)];
    });
    setSelectedDay(0);
    await fetchTodos(); // Wait for fetch to complete
  }}
  className="absolute left-12 top-4 text-gray-500 hover:text-gray-700 z-50"
>
  <ArrowRight size={20} />
</button>
       <div className="divide-y divide-gray-200">
         {days.map((day, index) => (
           <div 
             key={day}
             onClick={() => setSelectedDay(index)}
             className={`${getBackgroundColor(index)} p-6 space-y-2 transition-colors duration-200 cursor-pointer
               ${index === selectedDay ? 'bg-opacity-100' : 'bg-opacity-90'}`}
           >
             <h2 className={`text-2xl font-bold ${index >= 5 ? 'text-gray-100' : 'text-gray-800'}`}>
               {day}
             </h2>
             {index === selectedDay && (
               <>
                 <p className={`text-sm mb-4 ${index >= 4 ? 'text-white' : 'text-gray-500'}`}>
                   {formatDate(getDateForDay(index))}
                 </p>
                 <div className="space-y-3">
                   {tasks[day].map(task => (
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
                       <span className={`flex-grow ${task.completed ? 'line-through text-gray-400' : 
                         index >= 4 ? 'text-white' : 'text-gray-700'}`}>
                         {task.text}
                       </span>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           deleteTask(task.id, day);
                         }}
                         className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-gray-200"
                       >
                         <X size={16} />
                       </button>
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
       </div>
     </div>
   </div>
 );
}

export default App;
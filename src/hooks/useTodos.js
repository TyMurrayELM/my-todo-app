import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { isValidUrl } from '../lib/utils';
import {
  DAY_NAMES,
  computeMoveTargetDate,
  getLocalDateString,
  parseUTCDateAsLocal,
  getISOStringForLocalDate,
  shouldShowOnDate,
} from '../lib/dates';
import { log, logError } from '../lib/log';
import { MAX_TASK_LENGTH, MAX_NOTES_LENGTH, MAX_URL_LENGTH } from '../lib/constants';

// Owns the week's task data and every Supabase read/write. UI-only state
// (day selection, bulk-mode selection, editing/input state, modals) stays
// in App; bulk actions receive explicit task-id lists and report UI resets
// through clearBulkSelection so behavior matches the pre-hook code exactly.
export function useTodos({
  session,
  days,
  currentDate,
  isNavigating,
  getDateForDay,
  clearBulkSelection,
}) {
  const [tasks, setTasks] = useState(() => {
    return {
      ...DAY_NAMES.reduce((acc, day) => ({ ...acc, [day]: [] }), {}),
      TASK_BANK: [],
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isRepeating, setIsRepeating] = useState(false);
  // Track tasks that are visually complete but not yet sorted (for animation delay)
  const [pendingCompletions, setPendingCompletions] = useState({});
  // Toast message shown when a background save fails and the optimistic
  // update is rolled back; auto-dismisses.
  const [saveError, setSaveError] = useState(null);
  const saveErrorTimeoutRef = useRef(null);

  const reportSaveError = (message) => {
    setSaveError(message);
    if (saveErrorTimeoutRef.current) clearTimeout(saveErrorTimeoutRef.current);
    saveErrorTimeoutRef.current = setTimeout(() => {
      saveErrorTimeoutRef.current = null;
      setSaveError(null);
    }, 5000);
  };

  const dismissSaveError = () => {
    if (saveErrorTimeoutRef.current) {
      clearTimeout(saveErrorTimeoutRef.current);
      saveErrorTimeoutRef.current = null;
    }
    setSaveError(null);
  };

  // Monotonic id so a slow response from an older fetch can't
  // overwrite the result of a newer one (e.g. rapid week navigation).
  const fetchSeqRef = useRef(0);
  const intendedCompletionsRef = useRef({});
  const completionTimeoutsRef = useRef({});

  const fetchTodos = useCallback(async () => {
    if (!session || isNavigating) return;

    const fetchSeq = ++fetchSeqRef.current;
    const isCurrent = () => fetchSeq === fetchSeqRef.current;
    const failFetch = (label, error) => {
      logError(label, error);
      if (isCurrent()) {
        setFetchError(error.message || 'Could not load your tasks');
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    setFetchError(null);

    const start = getDateForDay(0);
    const end = getDateForDay(6);
    end.setHours(23, 59, 59, 999);

    const startStr = getLocalDateString(start);
    const endStr = getLocalDateString(end);

    log('Fetching todos between:', startStr, 'and', endStr);

    // First, fetch parent tasks (tasks without parent_task_id)
    // For recurring tasks, we need their start date to be <= endStr (they could have started before our week)
    // For non-recurring tasks, we need them to be within our date range
    const { data: parentTodos, error: parentError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', session.user.id)
      .is('parent_task_id', null)
      .or(
        `day.eq.TASK_BANK,and(recurring.eq.true,actual_date.lte.${endStr}T23:59:59.999Z),and(recurring.eq.false,actual_date.gte.${startStr}T00:00:00.000Z,actual_date.lte.${endStr}T23:59:59.999Z)`
      )
      .order('created_at');

    if (parentError) {
      failFetch('Error fetching parent todos:', parentError);
      return;
    }

    // Now fetch all sub-items for these parent tasks
    const parentIds = parentTodos.map((t) => t.id);
    let subItemTodos = [];

    if (parentIds.length > 0) {
      const { data: subItems, error: subItemsError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', session.user.id)
        .in('parent_task_id', parentIds);

      if (subItemsError) {
        failFetch('Error fetching sub-items:', subItemsError);
        return;
      }
      subItemTodos = subItems || [];
    }

    // Combine parent tasks and sub-items
    const allTodos = [...parentTodos, ...subItemTodos];
    log('Fetched todos:', allTodos);

    // Fetch completion records for recurring tasks
    const recurringTodoIds = allTodos.filter((t) => t.recurring).map((t) => t.id);
    let completionRecords = [];

    if (recurringTodoIds.length > 0) {
      const { data: completions, error: completionsError } = await supabase
        .from('recurring_completions')
        .select('*')
        .eq('user_id', session.user.id)
        .in('todo_id', recurringTodoIds)
        .gte('completion_date', startStr)
        .lte('completion_date', endStr);

      // A failed completions fetch must NOT fall through to rendering —
      // every recurring task would show incomplete and invite re-completes.
      if (completionsError) {
        failFetch('Error fetching completions:', completionsError);
        return;
      }
      completionRecords = completions || [];
    }

    // Fetch sub-item completion records for recurring tasks
    const subItemIds = allTodos
      .filter(
        (t) => t.parent_task_id && allTodos.find((p) => p.id === t.parent_task_id && p.recurring)
      )
      .map((t) => t.id);
    let subItemCompletionRecords = [];

    if (subItemIds.length > 0) {
      const { data: subCompletions, error: subCompletionsError } = await supabase
        .from('recurring_subitem_completions')
        .select('*')
        .eq('user_id', session.user.id)
        .in('subitem_id', subItemIds)
        .gte('completion_date', startStr)
        .lte('completion_date', endStr);

      if (subCompletionsError) {
        failFetch('Error fetching sub-item completions:', subCompletionsError);
        return;
      }
      subItemCompletionRecords = subCompletions || [];
    }

    const todosByDay = {
      SUNDAY: [],
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      TASK_BANK: [],
    };

    // Separate parent tasks and sub-items
    const parentTasks = allTodos.filter((todo) => !todo.parent_task_id);
    const subItems = allTodos.filter((todo) => todo.parent_task_id);

    // Create a map of parent task IDs to their sub-items
    const subItemsMap = {};
    subItems.forEach((subItem) => {
      if (!subItemsMap[subItem.parent_task_id]) {
        subItemsMap[subItem.parent_task_id] = [];
      }

      // For regular (non-recurring) tasks, use actual completion status
      const parentTask = parentTasks.find((p) => p.id === subItem.parent_task_id);

      subItemsMap[subItem.parent_task_id].push({
        id: subItem.id,
        text: subItem.text.trim(),
        completed: subItem.completed, // Default for non-recurring
        completedAt: subItem.completed_at,
        parentTaskId: subItem.parent_task_id,
        isRecurringSubItem: parentTask?.recurring || false,
      });
    });

    // Process parent tasks
    parentTasks.forEach((todo) => {
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
          isRecurringInstance: false,
        });
      } else if (todo.recurring) {
        // Generate instances for each day in the week
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const targetDate = getDateForDay(dayIndex);

          if (shouldShowOnDate(todo, targetDate)) {
            const dateStr = getLocalDateString(targetDate);
            const completion = completionRecords.find(
              (c) => c.todo_id === todo.id && c.completion_date === dateStr
            );

            // Instance was moved to another date — hide it here entirely
            // rather than showing it as completed.
            if (completion?.skipped) continue;

            // Get sub-items for this instance with their completion status for this date
            const instanceSubItems = (subItemsMap[todo.id] || []).map((subItem) => {
              const subCompletion = subItemCompletionRecords.find(
                (sc) => sc.subitem_id === subItem.id && sc.completion_date === dateStr
              );

              return {
                ...subItem,
                completed: !!subCompletion,
                completedAt: subCompletion?.completed_at || null,
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
              instanceDate: dateStr,
            });
          }
        }
      } else {
        // Regular one-time task
        const todoDate = parseUTCDateAsLocal(todo.actual_date);
        const todoDateStr = getLocalDateString(todoDate);

        log('Processing regular task:', todo.text, 'with date:', todoDateStr);

        // Find which day index this date belongs to in our current week view
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const thisDate = getDateForDay(dayIndex);
          const thisDateStr = getLocalDateString(thisDate);

          if (thisDateStr === todoDateStr) {
            log('Matched to day:', days[dayIndex], 'at index', dayIndex);

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
              isRecurringInstance: false,
            });
            break;
          }
        }
      }
    });

    log('Final tasks by day:', todosByDay);
    if (!isCurrent()) return; // superseded by a newer fetch
    setTasks(todosByDay);
    setIsLoading(false);
  }, [session, isNavigating, days, getDateForDay]);

  const fetchTodosRef = useRef(fetchTodos);
  useEffect(() => {
    fetchTodosRef.current = fetchTodos;
  });

  useEffect(() => {
    if (session && !isNavigating) {
      fetchTodosRef.current();
    }
  }, [session, currentDate, isNavigating]);

  // Bulk move tasks
  const bulkMoveTasks = async (taskIds, moveType, day) => {
    // Snapshot tasks before removing from UI
    const tasksToMove = taskIds.map((id) => tasks[day].find((t) => t.id === id)).filter(Boolean);

    if (tasksToMove.length === 0) return;

    // Optimistic: remove all selected tasks from UI at once
    const taskIdSet = new Set(taskIds);
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].filter((t) => !taskIdSet.has(t.id)),
    }));
    clearBulkSelection();

    // Calculate target date (same for all tasks in the batch)
    const fromDayIndex = days.indexOf(day);
    const targetDate = computeMoveTargetDate(moveType, getDateForDay(fromDayIndex));
    const targetDayName = DAY_NAMES[targetDate.getDay()];
    const targetActualDate = getISOStringForLocalDate(targetDate);

    // Fire all DB operations in parallel
    await Promise.all(
      tasksToMove.map(async (task) => {
        try {
          if (task.isRecurringInstance) {
            const { data: newTask } = await supabase
              .from('todos')
              .insert([
                {
                  user_id: session.user.id,
                  text: task.text,
                  day: targetDayName,
                  actual_date: targetActualDate,
                  completed: false,
                  recurring: false,
                  url: task.url,
                  notes: task.notes,
                },
              ])
              .select('id')
              .single();
            await supabase.from('recurring_completions').upsert(
              [
                {
                  user_id: session.user.id,
                  todo_id: task.originalId,
                  completion_date: task.instanceDate,
                  completed_at: new Date().toISOString(),
                  skipped: true,
                },
              ],
              { onConflict: 'todo_id,completion_date' }
            );
            if (newTask && task.subItems && task.subItems.length > 0) {
              await supabase.from('todos').insert(
                task.subItems.map((sub) => ({
                  user_id: session.user.id,
                  text: sub.text,
                  day: targetDayName,
                  actual_date: targetActualDate,
                  completed: false,
                  parent_task_id: newTask.id,
                }))
              );
            }
          } else {
            await supabase
              .from('todos')
              .update({
                day: targetDayName,
                actual_date: targetActualDate,
              })
              .eq('id', task.id)
              .eq('user_id', session.user.id);
          }
        } catch (error) {
          logError('Error in bulk move:', error);
          reportSaveError("Couldn't move some tasks");
        }
      })
    );

    // Single refresh to sync everything
    await fetchTodos();
  };

  // Bulk repeat tasks
  const bulkRepeatTasks = async (taskIds, frequency, day) => {
    // Snapshot non-recurring tasks to repeat
    const tasksToRepeat = taskIds
      .map((id) => tasks[day].find((t) => t.id === id))
      .filter((t) => t && !t.recurring);

    if (tasksToRepeat.length === 0) {
      clearBulkSelection();
      return;
    }

    const taskIdSet = new Set(tasksToRepeat.map((t) => t.id));
    const clickedTaskDate = new Date(getDateForDay(days.indexOf(day)));
    clickedTaskDate.setHours(0, 0, 0, 0);
    const actualDate = getISOStringForLocalDate(clickedTaskDate);

    // Optimistic: mark all selected tasks as recurring at once
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].map((t) =>
        taskIdSet.has(t.id) ? { ...t, recurring: true, repeatFrequency: frequency } : t
      ),
    }));
    clearBulkSelection();

    // Fire all DB updates in parallel
    await Promise.all(
      tasksToRepeat.map(async (task) => {
        try {
          const taskId = task.originalId || task.id;
          await supabase
            .from('todos')
            .update({
              recurring: true,
              repeat_frequency: frequency,
              actual_date: actualDate,
            })
            .eq('id', taskId)
            .eq('user_id', session.user.id);
        } catch (error) {
          logError('Error in bulk repeat:', error);
          reportSaveError("Couldn't set repeat on some tasks");
        }
      })
    );

    await fetchTodos();
  };

  // Bulk delete tasks
  const bulkDeleteTasks = async (taskIds, day) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${taskIds.length} task(s)?`
    );
    if (!confirmDelete) return;

    // Snapshot tasks before removing from UI
    const tasksToDelete = taskIds.map((id) => tasks[day].find((t) => t.id === id)).filter(Boolean);

    if (tasksToDelete.length === 0) return;

    // Optimistic: remove all selected tasks from UI at once
    const taskIdSet = new Set(taskIds);
    const recurringOriginalIds = new Set(
      tasksToDelete.filter((t) => t.recurring).map((t) => t.originalId || t.id)
    );

    setTasks((prev) => {
      const updated = { ...prev };
      if (recurringOriginalIds.size > 0) {
        // Recurring tasks appear across all days
        Object.keys(updated).forEach((dayKey) => {
          updated[dayKey] = updated[dayKey].filter(
            (t) => !taskIdSet.has(t.id) && !recurringOriginalIds.has(t.originalId)
          );
        });
      } else {
        updated[day] = prev[day].filter((t) => !taskIdSet.has(t.id));
      }
      return updated;
    });
    clearBulkSelection();

    // Fire all DB deletes in parallel
    await Promise.all(
      tasksToDelete.map(async (task) => {
        try {
          const actualId = task.isRecurringInstance ? task.originalId : task.id;
          await supabase.from('todos').delete().eq('id', actualId).eq('user_id', session.user.id);
        } catch (error) {
          logError('Error in bulk delete:', error);
          reportSaveError("Couldn't delete some tasks");
        }
      })
    );

    await fetchTodos();
  };

  // Bulk complete tasks
  const bulkCompleteTasks = async (taskIds, day) => {
    // Snapshot incomplete tasks to complete
    const tasksToComplete = taskIds
      .map((id) => tasks[day].find((t) => t.id === id))
      .filter((t) => t && !t.completed);

    if (tasksToComplete.length === 0) {
      clearBulkSelection();
      return;
    }

    const completedAt = new Date().toISOString();
    const taskIdSet = new Set(tasksToComplete.map((t) => t.id));

    // Optimistic: mark all selected tasks as completed at once
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].map((t) =>
        taskIdSet.has(t.id) ? { ...t, completed: true, completedAt } : t
      ),
    }));
    clearBulkSelection();

    // Fire all DB updates in parallel
    await Promise.all(
      tasksToComplete.map(async (task) => {
        try {
          if (task.isRecurringInstance) {
            await supabase.from('recurring_completions').upsert(
              [
                {
                  user_id: session.user.id,
                  todo_id: task.originalId,
                  completion_date: task.instanceDate,
                  completed_at: completedAt,
                  skipped: false,
                },
              ],
              { onConflict: 'todo_id,completion_date' }
            );
          } else {
            await supabase
              .from('todos')
              .update({
                completed: true,
                completed_at: completedAt,
              })
              .eq('id', task.id)
              .eq('user_id', session.user.id);
          }
        } catch (error) {
          logError('Error in bulk complete:', error);
          reportSaveError("Couldn't complete some tasks");
        }
      })
    );
  };

  const moveTask = async (taskId, fromDay, moveType = 'next-day') => {
    const task = tasks[fromDay].find((t) => t.id === taskId);
    if (!task) return;

    // Calculate the target date based on move type
    const fromDayIndex = days.indexOf(fromDay);
    const targetDate = computeMoveTargetDate(moveType, getDateForDay(fromDayIndex));
    const targetDayName = DAY_NAMES[targetDate.getDay()];

    if (task.isRecurringInstance) {
      // For recurring instances: create a one-time task on target date
      // and mark today as skipped

      // 1. Create one-time task on target date
      const { data: newTask, error: createError } = await supabase
        .from('todos')
        .insert([
          {
            user_id: session.user.id,
            text: task.text,
            day: targetDayName,
            actual_date: getISOStringForLocalDate(targetDate),
            completed: false,
            recurring: false,
            url: task.url,
            notes: task.notes,
          },
        ])
        .select('id')
        .single();

      if (createError) {
        logError('Error creating moved task:', createError);
        reportSaveError("Couldn't move task");
        return;
      }

      // 2. Mark today's instance as skipped (hidden, not completed)
      const { error: skipError } = await supabase.from('recurring_completions').upsert(
        [
          {
            user_id: session.user.id,
            todo_id: task.originalId,
            completion_date: task.instanceDate,
            completed_at: new Date().toISOString(),
            skipped: true,
          },
        ],
        { onConflict: 'todo_id,completion_date' }
      );

      if (skipError) {
        logError('Error skipping today:', skipError);
        reportSaveError("Couldn't move task");
        return;
      }

      // 3. Copy sub-items to the new task if any exist
      if (task.subItems && task.subItems.length > 0) {
        if (newTask) {
          const subItemsToCreate = task.subItems.map((sub) => ({
            user_id: session.user.id,
            text: sub.text,
            day: targetDayName,
            actual_date: getISOStringForLocalDate(targetDate),
            completed: false,
            parent_task_id: newTask.id,
          }));

          await supabase.from('todos').insert(subItemsToCreate);
        }
      }
    } else {
      // For regular tasks: just move them normally
      const { error } = await supabase
        .from('todos')
        .update({
          day: targetDayName,
          actual_date: getISOStringForLocalDate(targetDate),
        })
        .eq('id', taskId)
        .eq('user_id', session.user.id);

      if (error) {
        logError('Error moving todo:', error);
        reportSaveError("Couldn't move task");
        return;
      }
    }

    // Refresh todos to show the change
    await fetchTodos();
  };

  // Add a task; returns true when it was saved (caller clears its input)
  const addTask = async (text, day) => {
    if (!text.trim()) return false;
    if (typeof text !== 'string' || text.trim().length > MAX_TASK_LENGTH) return false;
    const taskDate = getDateForDay(days.indexOf(day));
    const actualDate = getISOStringForLocalDate(taskDate);

    const { data, error } = await supabase
      .from('todos')
      .insert([
        {
          user_id: session.user.id,
          text: text.trim(),
          day: day,
          actual_date: actualDate,
          completed: false,
        },
      ])
      .select()
      .single();

    if (error) {
      logError('Error adding todo:', error);
      reportSaveError("Couldn't add task");
      return false;
    }

    setTasks((prev) => ({
      ...prev,
      [day]: [...prev[day], { id: data.id, text: data.text, completed: false, subItems: [] }],
    }));
    return true;
  };

  // Add a sub-item under a parent task
  const addSubItem = async (parentTaskId, day, text) => {
    if (!text.trim()) return;
    if (typeof text !== 'string' || text.trim().length > MAX_TASK_LENGTH) return;

    const parentTask = tasks[day].find(
      (t) => t.id === parentTaskId || t.originalId === parentTaskId
    );
    if (!parentTask) return;

    // Use originalId for recurring tasks, regular id for one-time tasks
    const actualParentId = parentTask.originalId || parentTask.id;

    // Create temporary ID for optimistic update
    const tempId = `temp_${Date.now()}`;
    const savedText = text.trim();
    const newSubItem = {
      id: tempId,
      text: savedText,
      completed: false,
      completedAt: null,
      parentTaskId: actualParentId,
      isRecurringSubItem: parentTask.recurring || false,
    };

    // Optimistic update - add to UI immediately
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].map((task) =>
        task.id === parentTaskId || task.originalId === parentTaskId
          ? { ...task, subItems: [...(task.subItems || []), newSubItem] }
          : task
      ),
    }));

    // Sync to database
    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([
          {
            user_id: session.user.id,
            text: savedText,
            day: day,
            actual_date: new Date().toISOString(),
            completed: false,
            parent_task_id: actualParentId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Replace temp ID with real ID
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((task) =>
          task.id === parentTaskId || task.originalId === parentTaskId
            ? {
                ...task,
                subItems: task.subItems.map((sub) =>
                  sub.id === tempId ? { ...sub, id: data.id } : sub
                ),
              }
            : task
        ),
      }));
    } catch (error) {
      logError('Error adding sub-item:', error);
      reportSaveError("Couldn't add sub-item");
      // Revert optimistic update on failure
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((task) =>
          task.id === parentTaskId || task.originalId === parentTaskId
            ? { ...task, subItems: task.subItems.filter((sub) => sub.id !== tempId) }
            : task
        ),
      }));
    }
  };

  // Toggle sub-item completion
  const toggleSubItem = async (subItemId, day) => {
    const parentTask = tasks[day].find(
      (task) => task.subItems && task.subItems.some((sub) => sub.id === subItemId)
    );

    if (!parentTask) return;

    const subItem = parentTask.subItems.find((sub) => sub.id === subItemId);
    const newCompleted = !subItem.completed;
    const completedAt = newCompleted ? new Date().toISOString() : null;

    // Optimistic update - update UI immediately
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].map((task) =>
        task.id === parentTask.id
          ? {
              ...task,
              subItems: task.subItems.map((sub) =>
                sub.id === subItemId
                  ? { ...sub, completed: newCompleted, completedAt: completedAt }
                  : sub
              ),
            }
          : task
      ),
    }));

    // Then sync to database in background
    try {
      if (subItem.isRecurringSubItem && parentTask.isRecurringInstance) {
        // Handle recurring sub-item - use completion tracking table
        if (newCompleted) {
          const { error } = await supabase.from('recurring_subitem_completions').upsert(
            [
              {
                user_id: session.user.id,
                subitem_id: subItemId,
                parent_todo_id: parentTask.originalId,
                completion_date: parentTask.instanceDate,
                completed_at: completedAt,
              },
            ],
            { onConflict: 'subitem_id,completion_date' }
          );

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recurring_subitem_completions')
            .delete()
            .eq('subitem_id', subItemId)
            .eq('completion_date', parentTask.instanceDate)
            .eq('user_id', session.user.id);

          if (error) throw error;
        }
      } else {
        // Handle regular sub-item - update the todo directly
        const { error } = await supabase
          .from('todos')
          .update({
            completed: newCompleted,
            completed_at: completedAt,
          })
          .eq('id', subItemId)
          .eq('user_id', session.user.id);

        if (error) throw error;
      }
    } catch (error) {
      logError('Error updating sub-item:', error);
      reportSaveError("Couldn't update sub-item");
      // Revert optimistic update on failure
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((task) =>
          task.id === parentTask.id
            ? {
                ...task,
                subItems: task.subItems.map((sub) =>
                  sub.id === subItemId
                    ? { ...sub, completed: !newCompleted, completedAt: subItem.completedAt }
                    : sub
                ),
              }
            : task
        ),
      }));
    }
  };

  // Delete a sub-item
  const deleteSubItem = async (subItemId, day) => {
    // Find the parent task and sub-item for potential revert
    const parentTask = tasks[day].find(
      (task) => task.subItems && task.subItems.some((sub) => sub.id === subItemId)
    );
    const deletedSubItem = parentTask?.subItems.find((sub) => sub.id === subItemId);

    // Optimistic update - remove from UI immediately
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].map((task) =>
        task.subItems && task.subItems.some((sub) => sub.id === subItemId)
          ? { ...task, subItems: task.subItems.filter((sub) => sub.id !== subItemId) }
          : task
      ),
    }));

    // Sync to database
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', subItemId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      logError('Error deleting sub-item:', error);
      reportSaveError("Couldn't delete sub-item");
      // Revert optimistic update on failure
      if (parentTask && deletedSubItem) {
        setTasks((prev) => ({
          ...prev,
          [day]: prev[day].map((task) =>
            task.id === parentTask.id
              ? { ...task, subItems: [...task.subItems, deletedSubItem] }
              : task
          ),
        }));
      }
    }
  };

  // Update sub-item text
  const updateSubItemText = async (subItemId, day, newText) => {
    if (!newText.trim()) return;
    if (typeof newText !== 'string' || newText.trim().length > MAX_TASK_LENGTH) return;

    const parentTask = tasks[day].find(
      (task) => task.subItems && task.subItems.some((sub) => sub.id === subItemId)
    );
    if (!parentTask) return;

    const oldSubItem = parentTask.subItems.find((sub) => sub.id === subItemId);
    const oldText = oldSubItem?.text;

    // Optimistic update
    setTasks((prev) => ({
      ...prev,
      [day]: prev[day].map((task) =>
        task.id === parentTask.id
          ? {
              ...task,
              subItems: task.subItems.map((sub) =>
                sub.id === subItemId ? { ...sub, text: newText.trim() } : sub
              ),
            }
          : task
      ),
    }));

    // Sync to database
    try {
      const { error } = await supabase
        .from('todos')
        .update({ text: newText.trim() })
        .eq('id', subItemId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      logError('Error updating sub-item text:', error);
      reportSaveError("Couldn't save sub-item");
      // Revert on failure
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((task) =>
          task.id === parentTask.id
            ? {
                ...task,
                subItems: task.subItems.map((sub) =>
                  sub.id === subItemId ? { ...sub, text: oldText } : sub
                ),
              }
            : task
        ),
      }));
    }
  };

  // Toggle a task's completion (mobile double-tap priming stays in App)
  const toggleTask = async (taskId, day) => {
    const task = tasks[day].find((t) => t.id === taskId);
    if (!task) return;

    // Read the latest intended state — during the 400ms commit window, a fresh
    // click should toggle from the in-flight value, not the not-yet-committed
    // task.completed value.
    const currentlyCompleted = Object.prototype.hasOwnProperty.call(
      intendedCompletionsRef.current,
      taskId
    )
      ? intendedCompletionsRef.current[taskId]
      : task.completed;

    const newCompleted = !currentlyCompleted;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    intendedCompletionsRef.current[taskId] = newCompleted;

    // Cancel any pending commit for this task — we're updating the intent
    if (completionTimeoutsRef.current[taskId]) {
      clearTimeout(completionTimeoutsRef.current[taskId]);
      delete completionTimeoutsRef.current[taskId];
    }

    if (newCompleted) {
      // COMPLETING: Show visual feedback immediately, delay the reorder
      // (skip the delay for users who prefer reduced motion)
      setPendingCompletions((prev) => ({
        ...prev,
        [taskId]: true,
      }));

      const reorderDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400;

      // After delay, actually update the task state (this triggers reorder)
      completionTimeoutsRef.current[taskId] = setTimeout(() => {
        delete completionTimeoutsRef.current[taskId];
        delete intendedCompletionsRef.current[taskId];

        setPendingCompletions((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });

        setTasks((prev) => ({
          ...prev,
          [day]: prev[day].map((t) =>
            t.id === taskId ? { ...t, completed: true, completedAt: completedAt } : t
          ),
        }));
      }, reorderDelay);
    } else {
      // UNCOMPLETING: Update immediately, no delay needed
      delete intendedCompletionsRef.current[taskId];
      setPendingCompletions((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) =>
          t.id === taskId ? { ...t, completed: false, completedAt: null } : t
        ),
      }));
    }

    // Sync to database in background
    try {
      if (task.isRecurringInstance) {
        // Handle recurring instance
        if (newCompleted) {
          const { error } = await supabase.from('recurring_completions').upsert(
            [
              {
                user_id: session.user.id,
                todo_id: task.originalId,
                completion_date: task.instanceDate,
                completed_at: completedAt,
                skipped: false,
              },
            ],
            { onConflict: 'todo_id,completion_date' }
          );

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recurring_completions')
            .delete()
            .eq('todo_id', task.originalId)
            .eq('completion_date', task.instanceDate)
            .eq('user_id', session.user.id);

          if (error) throw error;
        }
      } else {
        // Handle regular task
        const { error } = await supabase
          .from('todos')
          .update({
            completed: newCompleted,
            completed_at: completedAt,
          })
          .eq('id', taskId)
          .eq('user_id', session.user.id);

        if (error) throw error;
      }
    } catch (error) {
      logError('Error updating todo:', error);
      reportSaveError("Couldn't update task");
      // Clear in-flight state and don't update committed state on failure
      delete intendedCompletionsRef.current[taskId];
      if (completionTimeoutsRef.current[taskId]) {
        clearTimeout(completionTimeoutsRef.current[taskId]);
        delete completionTimeoutsRef.current[taskId];
      }
      setPendingCompletions((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
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

    // Optimistic update - remove from UI immediately
    // For recurring tasks, remove all instances across all days
    if (task.recurring) {
      setTasks((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((dayKey) => {
          updated[dayKey] = updated[dayKey].filter(
            (t) => t.id !== taskId && t.originalId !== actualId
          );
        });
        return updated;
      });
    } else {
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].filter((t) => t.id !== taskId),
      }));
    }

    // Sync to database
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', actualId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      logError('Error deleting todo:', error);
      reportSaveError("Couldn't delete task");
      // Recurring deletes touch every day, so a local revert can't
      // reconstruct the optimistic removal — refetch instead.
      await fetchTodos();
    }
  };

  const repeatTask = useCallback(
    async (task, day, frequency = 'daily') => {
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
            actual_date: getISOStringForLocalDate(clickedTaskDate),
          })
          .eq('id', taskId)
          .eq('user_id', session.user.id);

        if (updateError) {
          logError('Error updating task:', updateError);
          throw updateError;
        }

        await fetchTodosRef.current();
      } catch (error) {
        logError('RepeatTask failed:', error);
        reportSaveError("Couldn't set repeat");
      } finally {
        setIsRepeating(false);
      }
    },
    [session, days, isRepeating, getDateForDay]
  );

  // Update task text (editing-state UI reset stays in App)
  const updateTaskText = async (taskId, day, newText) => {
    if (!newText.trim()) return;
    if (typeof newText !== 'string' || newText.trim().length > MAX_TASK_LENGTH) return;

    const task = tasks[day].find((t) => t.id === taskId);
    if (!task) return;

    const actualId = task.originalId || task.id;
    const oldText = task.text;

    // Optimistic update - update UI immediately
    // For recurring tasks, update all instances
    if (task.recurring || task.isRecurringInstance) {
      setTasks((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((dayKey) => {
          updated[dayKey] = updated[dayKey].map((t) =>
            t.id === taskId || t.originalId === actualId ? { ...t, text: newText.trim() } : t
          );
        });
        return updated;
      });
    } else {
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) => (t.id === taskId ? { ...t, text: newText.trim() } : t)),
      }));
    }

    // Sync to database
    try {
      const { error } = await supabase
        .from('todos')
        .update({ text: newText.trim() })
        .eq('id', actualId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      logError('Error updating todo:', error);
      reportSaveError("Couldn't save task");
      // Revert optimistic update on failure
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) => (t.id === taskId ? { ...t, text: oldText } : t)),
      }));
    }
  };

  const updateTaskUrl = async (taskId, day, url) => {
    if (url && (typeof url !== 'string' || url.length > MAX_URL_LENGTH || !isValidUrl(url))) return;
    const task = tasks[day].find((t) => t.id === taskId);
    if (!task) return;

    const actualId = task.originalId || task.id;
    const oldUrl = task.url;

    // Optimistic update - update UI immediately
    if (task.recurring || task.isRecurringInstance) {
      setTasks((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((dayKey) => {
          updated[dayKey] = updated[dayKey].map((t) =>
            t.id === taskId || t.originalId === actualId ? { ...t, url: url } : t
          );
        });
        return updated;
      });
    } else {
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) => (t.id === taskId ? { ...t, url: url } : t)),
      }));
    }

    // Sync to database
    try {
      const { error } = await supabase
        .from('todos')
        .update({ url: url })
        .eq('id', actualId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      logError('Error updating todo URL:', error);
      reportSaveError("Couldn't save URL");
      // Revert optimistic update on failure
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) => (t.id === taskId ? { ...t, url: oldUrl } : t)),
      }));
    }
  };

  const updateTaskNotes = async (taskId, day, notes) => {
    if (notes && (typeof notes !== 'string' || notes.length > MAX_NOTES_LENGTH)) return;
    const task = tasks[day].find((t) => t.id === taskId);
    if (!task) return;

    const actualId = task.originalId || task.id;
    const oldNotes = task.notes;

    // Optimistic update - update UI immediately
    if (task.recurring || task.isRecurringInstance) {
      setTasks((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((dayKey) => {
          updated[dayKey] = updated[dayKey].map((t) =>
            t.id === taskId || t.originalId === actualId ? { ...t, notes: notes } : t
          );
        });
        return updated;
      });
    } else {
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) => (t.id === taskId ? { ...t, notes: notes } : t)),
      }));
    }

    // Sync to database
    try {
      const { error } = await supabase
        .from('todos')
        .update({ notes: notes })
        .eq('id', actualId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    } catch (error) {
      logError('Error updating todo notes:', error);
      reportSaveError("Couldn't save note");
      // Revert optimistic update on failure
      setTasks((prev) => ({
        ...prev,
        [day]: prev[day].map((t) => (t.id === taskId ? { ...t, notes: oldNotes } : t)),
      }));
    }
  };

  return {
    tasks,
    isLoading,
    fetchError,
    setFetchError,
    fetchTodos,
    pendingCompletions,
    saveError,
    dismissSaveError,
    addTask,
    toggleTask,
    deleteTask,
    moveTask,
    repeatTask,
    updateTaskText,
    updateTaskUrl,
    updateTaskNotes,
    addSubItem,
    toggleSubItem,
    deleteSubItem,
    updateSubItemText,
    bulkCompleteTasks,
    bulkMoveTasks,
    bulkRepeatTasks,
    bulkDeleteTasks,
  };
}

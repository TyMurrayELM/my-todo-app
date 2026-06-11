import { getLocalDateString, parseUTCDateAsLocal, shouldShowOnDate } from './dates';
import { log } from './log';

// Pure core of fetchTodos: takes raw DB rows and the week being viewed,
// returns the tasks grouped by day card. Recurring tasks become per-date
// instances; completion rows determine instance state; skipped rows hide
// an instance (it was moved elsewhere).
//
// todos: rows from the todos table (parents and sub-items together)
// completions: rows from recurring_completions for the week
// subItemCompletions: rows from recurring_subitem_completions for the week
// days: day names in display order, days[i] matching getDateForDay(i)
// getDateForDay: index (0-6) -> Date of that day card
export function groupTodosByDay({ todos, completions, subItemCompletions, days, getDateForDay }) {
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
  const parentTasks = todos.filter((todo) => !todo.parent_task_id);
  const subItems = todos.filter((todo) => todo.parent_task_id);

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
          const completion = completions.find(
            (c) => c.todo_id === todo.id && c.completion_date === dateStr
          );

          // Instance was moved to another date — hide it here entirely
          // rather than showing it as completed.
          if (completion?.skipped) continue;

          // Get sub-items for this instance with their completion status for this date
          const instanceSubItems = (subItemsMap[todo.id] || []).map((subItem) => {
            const subCompletion = subItemCompletions.find(
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

  return todosByDay;
}

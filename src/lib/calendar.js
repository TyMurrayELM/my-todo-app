// Build a Google Calendar "create event" URL for a task on a given date.
export const createGoogleCalendarUrl = (task, taskDate) => {
  // Format date for Google Calendar (YYYYMMDD)
  const formatGoogleDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const startDate = formatGoogleDate(taskDate);
  // For all-day event, end date is the next day
  const endDate = new Date(taskDate);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = formatGoogleDate(endDate);

  // Build the description
  let description = '';
  if (task.notes) {
    description += task.notes;
  }
  if (task.url) {
    if (description) description += '\n\n';
    description += `Link: ${task.url}`;
  }
  if (task.subItems && task.subItems.length > 0) {
    if (description) description += '\n\n';
    description += 'Sub-tasks:\n';
    task.subItems.forEach((sub) => {
      description += `${sub.completed ? '✓' : '○'} ${sub.text}\n`;
    });
  }

  // Build recurrence rule (RRULE) for recurring tasks
  // Format: RRULE:FREQ=DAILY;UNTIL=20251231
  const getRecurrenceRule = () => {
    if (!task.recurring || !task.repeatFrequency) return null;

    // Set end date to 1 year from now for recurring events
    const untilDate = new Date(taskDate);
    untilDate.setFullYear(untilDate.getFullYear() + 1);
    const untilStr = formatGoogleDate(untilDate);

    switch (task.repeatFrequency) {
      case 'daily':
        return `RRULE:FREQ=DAILY;UNTIL=${untilStr}`;
      case 'every-other-day':
        return `RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=${untilStr}`;
      case 'weekdays':
        // Monday through Friday
        return `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${untilStr}`;
      case 'weekly':
        return `RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`;
      case 'bi-weekly':
        return `RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=${untilStr}`;
      case 'monthly':
        return `RRULE:FREQ=MONTHLY;UNTIL=${untilStr}`;
      case 'first-of-month':
        return `RRULE:FREQ=MONTHLY;BYMONTHDAY=1;UNTIL=${untilStr}`;
      default:
        return null;
    }
  };

  // Build Google Calendar URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.text,
    dates: `${startDate}/${endDateStr}`,
    details: description,
  });

  // Add recurrence rule if task is recurring
  const recurrence = getRecurrenceRule();
  if (recurrence) {
    params.append('recur', recurrence);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

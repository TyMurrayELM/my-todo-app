import { parseCustomFrequency } from './frequency';

export const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

// Compute the date a task lands on for a given move action.
// `today` is injectable for testing.
// moveType 'custom:YYYY-MM-DD' targets that exact date.
export const computeMoveTargetDate = (moveType, fromDate, today = new Date()) => {
  if (typeof moveType === 'string' && moveType.startsWith('custom:')) {
    return parseUTCDateAsLocal(moveType.slice('custom:'.length));
  }

  if (moveType === 'today') {
    const targetDate = new Date(today);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate;
  }

  const targetDate = new Date(fromDate);
  if (moveType === 'next-day') {
    targetDate.setDate(fromDate.getDate() + 1);
  } else if (moveType === 'next-week') {
    targetDate.setDate(fromDate.getDate() + 7);
  } else if (moveType === 'next-weekday') {
    targetDate.setDate(fromDate.getDate() + 1);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
  } else if (moveType === 'next-weekend') {
    // Next Saturday; a full week out if fromDate is already Saturday
    const daysUntilSaturday = (6 - fromDate.getDay() + 7) % 7;
    targetDate.setDate(fromDate.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
  }
  return targetDate;
};

export const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseUTCDateAsLocal = (dateString) => {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

export const getISOStringForLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T12:00:00.000Z`;
};

export const formatDate = (date) =>
  `${date.toLocaleString('default', { month: 'long' })}, ${date.getDate()} ${date.getFullYear()}`;

export const shouldShowOnDate = (task, targetDate) => {
  if (!task.recurring || !task.repeat_frequency) return false;

  const taskStartDate = parseUTCDateAsLocal(task.actual_date);
  taskStartDate.setHours(0, 0, 0, 0);
  const checkDate = new Date(targetDate);
  checkDate.setHours(0, 0, 0, 0);

  if (checkDate < taskStartDate) return false;

  // Round, don't floor: both dates are local midnights, so across a DST
  // transition the raw difference is ±1 hour off a whole number of days.
  const daysDiff = Math.round((checkDate - taskStartDate) / (1000 * 60 * 60 * 24));
  const targetDayOfWeek = checkDate.getDay();

  switch (task.repeat_frequency) {
    case 'daily':
      return true;
    case 'every-other-day':
      return daysDiff % 2 === 0;
    case 'weekdays':
      return targetDayOfWeek !== 0 && targetDayOfWeek !== 6;
    case 'weekly':
      return daysDiff % 7 === 0;
    case 'bi-weekly':
      return daysDiff % 14 === 0;
    case 'monthly': {
      const taskDay = taskStartDate.getDate();
      const targetDay = checkDate.getDate();
      const monthsDiff =
        (checkDate.getFullYear() - taskStartDate.getFullYear()) * 12 +
        (checkDate.getMonth() - taskStartDate.getMonth());
      const daysInTargetMonth = new Date(
        checkDate.getFullYear(),
        checkDate.getMonth() + 1,
        0
      ).getDate();
      const adjustedTaskDay = Math.min(taskDay, daysInTargetMonth);
      return monthsDiff >= 0 && targetDay === adjustedTaskDay;
    }
    case 'first-of-month':
      return checkDate.getDate() === 1;
    default: {
      const custom = parseCustomFrequency(task.repeat_frequency);
      if (!custom) return false;
      if (custom.kind === 'interval') {
        const intervalDays = custom.unit === 'weeks' ? custom.n * 7 : custom.n;
        return daysDiff % intervalDays === 0;
      }
      return custom.days.includes(targetDayOfWeek);
    }
  }
};

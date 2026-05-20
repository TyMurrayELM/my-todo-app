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

  const daysDiff = Math.floor((checkDate - taskStartDate) / (1000 * 60 * 60 * 24));
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
    default:
      return false;
  }
};

export const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const formatCompletionTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// True while a native date-picker input holds focus. Outside-click and
// collapse handlers must not tear down UI around that input: on mobile the
// tap that opens the picker is followed by a delayed synthetic click, and
// unmounting the input dismisses the picker the user is looking at.
export const isDatePickerActive = () =>
  document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'date';

export const calculateProgress = (dayTasks) => {
  if (!dayTasks || dayTasks.length === 0) return { percentage: 0, completed: 0, total: 0 };
  const completed = dayTasks.filter((task) => task.completed).length;
  const total = dayTasks.length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  return { percentage, completed, total };
};

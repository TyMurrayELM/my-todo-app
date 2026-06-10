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

export const calculateProgress = (dayTasks) => {
  if (!dayTasks || dayTasks.length === 0) return { percentage: 0, completed: 0, total: 0 };
  const completed = dayTasks.filter((task) => task.completed).length;
  const total = dayTasks.length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  return { percentage, completed, total };
};

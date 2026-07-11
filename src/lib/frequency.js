// Custom repeat frequencies, encoded in the repeat_frequency string alongside
// the preset ids (same pattern as 'custom:YYYY-MM-DD' in move types):
//   'every:N:days' | 'every:N:weeks'  - interval anchored to the task's start date
//   'days:MO,WE,FR'                   - specific weekdays (RRULE day codes)

export const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MAX_INTERVAL = 365;

// Parse a custom frequency string. Returns
//   { kind: 'interval', n, unit: 'days' | 'weeks' }
//   { kind: 'weekdays', days: [0-6 ascending] }
// or null for presets / malformed strings.
export const parseCustomFrequency = (frequency) => {
  if (typeof frequency !== 'string') return null;

  if (frequency.startsWith('every:')) {
    const [, nStr, unit] = frequency.split(':');
    const n = Number(nStr);
    if (!Number.isInteger(n) || n < 1 || n > MAX_INTERVAL) return null;
    if (unit !== 'days' && unit !== 'weeks') return null;
    return { kind: 'interval', n, unit };
  }

  if (frequency.startsWith('days:')) {
    const indices = frequency
      .slice('days:'.length)
      .split(',')
      .map((code) => DAY_CODES.indexOf(code));
    if (indices.length === 0 || indices.some((i) => i === -1)) return null;
    return { kind: 'weekdays', days: [...new Set(indices)].sort((a, b) => a - b) };
  }

  return null;
};

export const buildIntervalFrequency = (n, unit) => `every:${n}:${unit}`;

export const buildWeekdaysFrequency = (dayIndices) =>
  `days:${[...new Set(dayIndices)]
    .sort((a, b) => a - b)
    .map((i) => DAY_CODES[i])
    .join(',')}`;

// Human-readable description ("Every 3 days", "Repeats on Mon, Wed, Fri"),
// or null if the string isn't a valid custom frequency.
export const describeCustomFrequency = (frequency) => {
  const custom = parseCustomFrequency(frequency);
  if (!custom) return null;
  if (custom.kind === 'interval') {
    const unitLabel = custom.n === 1 ? custom.unit.slice(0, -1) : custom.unit;
    return `Repeats every ${custom.n === 1 ? '' : `${custom.n} `}${unitLabel}`;
  }
  return `Repeats on ${custom.days.map((i) => DAY_SHORT_NAMES[i]).join(', ')}`;
};

// Compact badge text for RecurringIndicator ("3d", "6w", "MWF"),
// or null if not a valid custom frequency.
export const customFrequencyBadge = (frequency) => {
  const custom = parseCustomFrequency(frequency);
  if (!custom) return null;
  if (custom.kind === 'interval') {
    return `${custom.n}${custom.unit === 'weeks' ? 'w' : 'd'}`;
  }
  return custom.days.map((i) => DAY_LETTERS[i]).join('');
};

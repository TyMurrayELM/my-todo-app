// Pure helpers for the People screen (no Supabase, no React).
import { DAY_NAMES, getLocalDateString, parseUTCDateAsLocal, shouldShowOnDate } from './dates';

export const MAX_PERSON_NAME = 120;
export const MAX_PERSON_FIELD = 200;
export const MAX_PERSON_LONG_FIELD = 500;
export const MAX_PERSON_NOTES = 5000;
export const MAX_UPDATE_LENGTH = 2000;

export const BIRTHDAY_TAG = 'birthday';
export const BIRTHDAY_FREQUENCY = 'every:1:years';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Repeat choices offered when setting a reminder on a person
export const REMINDER_REPEATS = [
  { value: '', label: 'Once' },
  { value: 'every:1:months', label: 'Every month' },
  { value: 'every:3:months', label: 'Every 3 months' },
  { value: 'every:6:months', label: 'Every 6 months' },
  { value: 'every:1:years', label: 'Every year' },
];

export const TOUCH_CHOICES = [
  { value: '', label: 'No reminder' },
  { value: '1', label: 'Every month' },
  { value: '2', label: 'Every 2 months' },
  { value: '3', label: 'Every 3 months' },
  { value: '6', label: 'Every 6 months' },
  { value: '12', label: 'Every year' },
];

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const midnight = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Days in a month for the birthday picker (February offers the 29th)
export const daysInBirthdayMonth = (month) => (month ? new Date(2024, month, 0).getDate() : 31);

// The date the yearly birthday task starts from: this year's birthday if it
// is today or later, else next year's. A Feb 29 birthday starts from the most
// recent real Feb 29, because the yearly repeat only falls back to Feb 28 in
// short years when its start date is itself a Feb 29.
export const birthdayAnchor = (month, day, today = new Date()) => {
  const now = midnight(today);
  if (month === 2 && day === 29) {
    let y = now.getFullYear();
    while (!isLeap(y) || new Date(y, 1, 29) > now) y--;
    return new Date(y, 1, 29);
  }
  const thisYear = new Date(now.getFullYear(), month - 1, day);
  return thisYear >= now ? thisYear : new Date(now.getFullYear() + 1, month - 1, day);
};

export const birthdayTaskText = (name) => `🎂 ${name}'s birthday`;

// "March 4" or "March 4, 1985"
export const formatBirthday = (person) => {
  if (!person?.birthday_month || !person?.birthday_day) return '';
  const base = `${MONTH_NAMES[person.birthday_month - 1]} ${person.birthday_day}`;
  return person.birthday_year ? `${base}, ${person.birthday_year}` : base;
};

export const nextBirthday = (person, today = new Date()) => {
  if (!person?.birthday_month || !person?.birthday_day) return null;
  const now = midnight(today);
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
    const last = new Date(y, person.birthday_month, 0).getDate();
    const d = new Date(y, person.birthday_month - 1, Math.min(person.birthday_day, last));
    if (d >= now) return d;
  }
  return null;
};

// Age they turn on their next birthday, when the year is known
export const turningAge = (person, today = new Date()) => {
  if (!person?.birthday_year) return null;
  const next = nextBirthday(person, today);
  return next ? next.getFullYear() - person.birthday_year : null;
};

// Age today, when the birth year is known
export const currentAge = (person, today = new Date()) => {
  if (!person?.birthday_year || !person.birthday_month || !person.birthday_day) return null;
  const now = midnight(today);
  let age = now.getFullYear() - person.birthday_year;
  const had =
    now.getMonth() + 1 > person.birthday_month ||
    (now.getMonth() + 1 === person.birthday_month && now.getDate() >= person.birthday_day);
  if (!had) age--;
  return age >= 0 ? age : null;
};

// The day card and stored date a task on this date needs
export const reminderDateFields = (date) => {
  const d = midnight(date);
  return {
    day: DAY_NAMES[d.getDay()],
    actual_date: `${getLocalDateString(d)}T12:00:00.000Z`,
  };
};

// Next date (YYYY-MM-DD, today included) a reminder task is due and not yet
// done, or null. `row` is a todos row; `doneDates` the dates of its repeat
// that are completed or were moved away. Looks two years ahead at most.
export const nextDue = (row, doneDates = new Set(), today = new Date()) => {
  if (!row.recurring) {
    if (row.completed) return null;
    return getLocalDateString(parseUTCDateAsLocal(row.actual_date));
  }
  const d = midnight(today);
  for (let i = 0; i < 732; i++) {
    if (shouldShowOnDate(row, d)) {
      const s = getLocalDateString(d);
      if (!doneDates.has(s)) return s;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
};

// An update shows on the profile it was written on and on any family
// profiles it was also linked to
export const updateIsOn = (update, personId) =>
  update.person_id === personId || (update.also_person_ids || []).includes(personId);

// Most recent sign of contact with a person (YYYY-MM-DD) or null: their
// latest dated update, or the latest reminder about them that was checked off.
export const lastContact = (personId, { updates, reminders, completions }) => {
  let best = null;
  const take = (s) => {
    if (s && (!best || s > best)) best = s;
  };
  updates.forEach((u) => updateIsOn(u, personId) && take(u.happened_on));
  const mine = reminders.filter((r) => r.person_id === personId);
  mine.forEach((r) => {
    if (!r.recurring && r.completed && r.completed_at) {
      take(getLocalDateString(new Date(r.completed_at)));
    }
  });
  const ids = new Set(mine.filter((r) => r.recurring).map((r) => r.id));
  completions.forEach((c) => {
    if (ids.has(c.todo_id) && !c.skipped) take(c.completion_date);
  });
  return best;
};

// Whole calendar months from a YYYY-MM-DD to today
export const monthsSince = (dateStr, today = new Date()) => {
  const from = parseUTCDateAsLocal(dateStr);
  const now = midnight(today);
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months--;
  return Math.max(0, months);
};

// Due to reach out: a keep-in-touch pace is set and that many months have
// passed since the last contact (or since they were added, if never).
export const isOverdue = (person, last, today = new Date()) => {
  if (!person.touch_months) return false;
  const since =
    last || (person.created_at ? getLocalDateString(new Date(person.created_at)) : null);
  if (!since) return false;
  return monthsSince(since, today) >= person.touch_months;
};

// "today", "12 days ago", "2 months ago", "1 year ago"; "never" for none
export const formatAgo = (dateStr, today = new Date()) => {
  if (!dateStr) return 'never';
  const days = Math.round((midnight(today) - parseUTCDateAsLocal(dateStr)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.max(1, monthsSince(dateStr, today));
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

// "Sat, Nov 28" (with the year when it is not this year)
export const formatDay = (dateStr, today = new Date()) => {
  const d = parseUTCDateAsLocal(dateStr);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
};

// Reminders (birthdays included) due from today through `days` ahead, plus
// one-time reminders whose day has passed and are still not done. Soonest
// first: [{ row, due }], `due` a YYYY-MM-DD.
export const comingUp = (reminders, completions, today = new Date(), days = 30) => {
  const start = midnight(today);
  const out = [];
  reminders.forEach((row) => {
    if (!row.recurring) {
      const due = nextDue(row);
      if (due) out.push({ row, due });
      return;
    }
    const done = new Set(
      completions.filter((c) => c.todo_id === row.id).map((c) => c.completion_date)
    );
    const d = new Date(start);
    for (let i = 0; i <= days; i++) {
      const s = getLocalDateString(d);
      if (shouldShowOnDate(row, d) && !done.has(s)) {
        out.push({ row, due: s });
        return;
      }
      d.setDate(d.getDate() + 1);
    }
  });
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  const last = getLocalDateString(end);
  return out
    .filter((x) => x.due <= last)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
};

// "today", "tomorrow", "in 9 days"; "overdue" for a day that has passed
export const formatUntil = (dateStr, today = new Date()) => {
  const days = Math.round((parseUTCDateAsLocal(dateStr) - midnight(today)) / 86400000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
};

// The part of `text` around the first place `query` appears (any case), with
// "…" where it was cut; null when it does not appear.
export const snippetAround = (text, query, pad = 28) => {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  const at = q
    ? String(text || '')
        .toLowerCase()
        .indexOf(q)
    : -1;
  if (at < 0) return null;
  const from = Math.max(0, at - pad);
  const to = Math.min(text.length, at + q.length + pad);
  return (
    (from > 0 ? '…' : '') +
    text.slice(from, to).replace(/\s+/g, ' ').trim() +
    (to < text.length ? '…' : '')
  );
};

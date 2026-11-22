import { describe, it, expect } from 'vitest';
import {
  birthdayAnchor,
  nextBirthday,
  turningAge,
  currentAge,
  formatBirthday,
  nextDue,
  lastContact,
  monthsSince,
  isOverdue,
  formatAgo,
  reminderDateFields,
  daysInBirthdayMonth,
} from './people';
import { getLocalDateString, shouldShowOnDate } from './dates';

const day = (y, m, d) => new Date(y, m - 1, d);
const str = (d) => getLocalDateString(d);

describe('birthdayAnchor', () => {
  it('uses this year when the birthday is still ahead', () => {
    expect(str(birthdayAnchor(12, 5, day(2026, 11, 22)))).toBe('2026-12-05');
  });
  it('uses today when the birthday is today', () => {
    expect(str(birthdayAnchor(11, 22, day(2026, 11, 22)))).toBe('2026-11-22');
  });
  it('uses next year once it has passed', () => {
    expect(str(birthdayAnchor(3, 4, day(2026, 11, 22)))).toBe('2027-03-04');
  });
  it('starts a Feb 29 birthday from the last real Feb 29', () => {
    expect(str(birthdayAnchor(2, 29, day(2026, 11, 22)))).toBe('2024-02-29');
    expect(str(birthdayAnchor(2, 29, day(2028, 2, 29)))).toBe('2028-02-29');
  });
  it('makes a yearly task that lands on the birthday each year', () => {
    const row = (a) => ({
      recurring: true,
      repeat_frequency: 'every:1:years',
      actual_date: `${str(a)}T12:00:00.000Z`,
    });
    const normal = row(birthdayAnchor(3, 4, day(2026, 11, 22)));
    expect(shouldShowOnDate(normal, day(2027, 3, 4))).toBe(true);
    expect(shouldShowOnDate(normal, day(2028, 3, 4))).toBe(true);
    expect(shouldShowOnDate(normal, day(2027, 3, 5))).toBe(false);
    const leap = row(birthdayAnchor(2, 29, day(2026, 11, 22)));
    expect(shouldShowOnDate(leap, day(2027, 2, 28))).toBe(true);
    expect(shouldShowOnDate(leap, day(2028, 2, 29))).toBe(true);
    expect(shouldShowOnDate(leap, day(2028, 2, 28))).toBe(false);
  });
});

describe('birthday display', () => {
  const p = { birthday_month: 3, birthday_day: 4, birthday_year: 1985 };
  it('formats with and without a year', () => {
    expect(formatBirthday(p)).toBe('March 4, 1985');
    expect(formatBirthday({ ...p, birthday_year: null })).toBe('March 4');
    expect(formatBirthday({})).toBe('');
  });
  it('finds the next birthday and the age they turn', () => {
    expect(str(nextBirthday(p, day(2026, 11, 22)))).toBe('2027-03-04');
    expect(turningAge(p, day(2026, 11, 22))).toBe(42);
    expect(turningAge({ ...p, birthday_year: null }, day(2026, 11, 22))).toBe(null);
  });
  it('gives the age today', () => {
    expect(currentAge(p, day(2026, 11, 22))).toBe(41);
    expect(currentAge(p, day(2027, 3, 4))).toBe(42);
    expect(currentAge(p, day(2027, 3, 3))).toBe(41);
    expect(currentAge({ ...p, birthday_year: null }, day(2026, 11, 22))).toBe(null);
  });
  it('offers 29 days in February', () => {
    expect(daysInBirthdayMonth(2)).toBe(29);
    expect(daysInBirthdayMonth(4)).toBe(30);
    expect(daysInBirthdayMonth(null)).toBe(31);
  });
});

describe('reminderDateFields', () => {
  it('gives the day card and a noon-UTC date', () => {
    expect(reminderDateFields(day(2026, 11, 28))).toEqual({
      day: 'SATURDAY',
      actual_date: '2026-11-28T12:00:00.000Z',
    });
  });
});

describe('nextDue', () => {
  const today = day(2026, 11, 22);
  it('returns the date of an open one-time reminder', () => {
    const row = { recurring: false, completed: false, actual_date: '2026-12-01T12:00:00.000Z' };
    expect(nextDue(row, new Set(), today)).toBe('2026-12-01');
    expect(nextDue({ ...row, completed: true }, new Set(), today)).toBe(null);
  });
  it('walks a repeat forward past completed dates', () => {
    const row = {
      recurring: true,
      repeat_frequency: 'every:3:months',
      actual_date: '2026-10-15T12:00:00.000Z',
    };
    expect(nextDue(row, new Set(), today)).toBe('2027-01-15');
    expect(nextDue(row, new Set(['2027-01-15']), today)).toBe('2027-04-15');
  });
});

describe('lastContact', () => {
  const data = {
    updates: [
      { person_id: 'a', happened_on: '2026-08-01' },
      { person_id: 'b', happened_on: '2026-11-01' },
      { person_id: 'b', happened_on: '2026-11-20', also_person_ids: ['d'] },
    ],
    reminders: [
      {
        id: 1,
        person_id: 'a',
        recurring: false,
        completed: true,
        completed_at: '2026-09-10T18:00:00.000Z',
      },
      { id: 2, person_id: 'a', recurring: true },
      { id: 3, person_id: 'a', recurring: false, completed: false },
    ],
    completions: [
      { todo_id: 2, completion_date: '2026-10-05', skipped: false },
      { todo_id: 2, completion_date: '2026-11-15', skipped: true },
    ],
  };
  it('takes the latest of updates and checked-off reminders', () => {
    expect(lastContact('a', data)).toBe('2026-10-05');
    expect(lastContact('b', data)).toBe('2026-11-20');
    expect(lastContact('d', data)).toBe('2026-11-20'); // linked from b's profile
    expect(lastContact('c', data)).toBe(null);
  });
});

describe('overdue and ago', () => {
  const today = day(2026, 11, 22);
  it('counts whole months', () => {
    expect(monthsSince('2026-08-22', today)).toBe(3);
    expect(monthsSince('2026-08-23', today)).toBe(2);
  });
  it('flags a person once their pace has passed', () => {
    const p = { touch_months: 3, created_at: '2026-01-01T12:00:00.000Z' };
    expect(isOverdue(p, '2026-08-22', today)).toBe(true);
    expect(isOverdue(p, '2026-09-01', today)).toBe(false);
    expect(isOverdue(p, null, today)).toBe(true); // never: counted from when added
    expect(isOverdue({ ...p, touch_months: null }, '2020-01-01', today)).toBe(false);
  });
  it('describes how long ago', () => {
    expect(formatAgo(null, today)).toBe('never');
    expect(formatAgo('2026-11-22', today)).toBe('today');
    expect(formatAgo('2026-11-21', today)).toBe('yesterday');
    expect(formatAgo('2026-11-10', today)).toBe('12 days ago');
    expect(formatAgo('2026-08-01', today)).toBe('3 months ago');
    expect(formatAgo('2024-08-01', today)).toBe('2 years ago');
  });
});

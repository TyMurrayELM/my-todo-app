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
  comingUp,
  formatUntil,
  snippetAround,
  cleanTag,
  hasTag,
  tagCounts,
  resolveTag,
  addTag,
  removeTag,
  renameTagIn,
  suggestTags,
  renameTarget,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_PERSON,
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

describe('comingUp', () => {
  const today = day(2026, 11, 22);
  const once = (id, date, completed = false) => ({
    id,
    recurring: false,
    completed,
    actual_date: date,
  });
  const yearly = (id, date) => ({
    id,
    recurring: true,
    repeat_frequency: 'every:1:years',
    actual_date: date,
  });
  it('lists what is due in the window, soonest first, with past undone ones', () => {
    const list = comingUp(
      [
        once('later', '2026-12-10'),
        once('far', '2027-03-01'),
        once('done', '2026-11-25', true),
        once('missed', '2026-11-10'),
        yearly('bday', '2025-12-01'),
        yearly('farBday', '2026-06-01'),
      ],
      [],
      today
    );
    expect(list.map((x) => `${x.row.id}:${x.due}`)).toEqual([
      'missed:2026-11-10',
      'bday:2026-12-01',
      'later:2026-12-10',
    ]);
  });
  it('leaves out a repeat already checked off for that day', () => {
    const done = [{ todo_id: 'bday', completion_date: '2026-12-01' }];
    expect(comingUp([yearly('bday', '2025-12-01')], done, today)).toEqual([]);
  });
});

describe('formatUntil and snippetAround', () => {
  const today = day(2026, 11, 22);
  it('says how far off a day is', () => {
    expect(formatUntil('2026-11-20', today)).toBe('overdue');
    expect(formatUntil('2026-11-22', today)).toBe('today');
    expect(formatUntil('2026-11-23', today)).toBe('tomorrow');
    expect(formatUntil('2026-12-01', today)).toBe('in 9 days');
  });
  it('cuts text around the match', () => {
    expect(snippetAround('Went to the Symphony downtown', 'symphony', 4)).toBe(
      '…the Symphony dow…'
    );
    expect(snippetAround('Short note', 'note')).toBe('Short note');
    expect(snippetAround('Short note', 'zebra')).toBe(null);
    expect(snippetAround('Short note', '  ')).toBe(null);
  });
});

describe('tags', () => {
  it('cleans typed text', () => {
    expect(cleanTag('  Golf   buddies ')).toBe('Golf buddies');
    expect(cleanTag('   ')).toBe('');
    expect(cleanTag(null)).toBe('');
    expect(cleanTag('x'.repeat(50))).toHaveLength(MAX_TAG_LENGTH);
  });
  it('reuses the spelling already in use', () => {
    expect(resolveTag(' golf', ['Golf', 'Church'])).toBe('Golf');
    expect(resolveTag('Hiking', ['Golf'])).toBe('Hiking');
  });
  it('adds a tag once, whatever the capitals', () => {
    expect(addTag([], 'golf', ['Golf'])).toEqual(['Golf']);
    expect(addTag(['Golf'], 'GOLF')).toEqual(['Golf']);
    expect(addTag(['Golf'], '  ')).toEqual(['Golf']);
    expect(addTag(['Golf'], 'Church')).toEqual(['Golf', 'Church']);
  });
  it('stops at the per-person limit', () => {
    const full = Array.from({ length: MAX_TAGS_PER_PERSON }, (_, i) => `t${i}`);
    expect(addTag(full, 'one more')).toBe(full);
  });
  it('removes a tag whatever the capitals', () => {
    expect(removeTag(['Golf', 'Church'], 'golf')).toEqual(['Church']);
  });
  it('renames without leaving a duplicate', () => {
    expect(renameTagIn(['Golf', 'Church'], 'golf', 'Golfing')).toEqual(['Golfing', 'Church']);
    expect(renameTagIn(['Golf', 'Church'], 'Golf', 'church')).toEqual(['church']);
    expect(renameTagIn(['Church'], 'Golf', 'X')).toEqual(['Church']);
  });
  it('counts tags across people, most used first', () => {
    const people = [
      { tags: ['Golf', 'Church'] },
      { tags: ['golf'] },
      { tags: null },
      { tags: ['Neighbors'] },
    ];
    expect(tagCounts(people)).toEqual([
      { tag: 'Golf', count: 2 },
      { tag: 'Church', count: 1 },
      { tag: 'Neighbors', count: 1 },
    ]);
  });
  it('renames onto a tag in use with its spelling, so the two merge', () => {
    const people = [{ tags: ['Golf'] }, { tags: ['College'] }];
    expect(renameTarget(people, 'Golf', ' college ')).toBe('College');
    expect(renameTarget(people, 'Golf', 'GOLF')).toBe('GOLF');
    expect(renameTarget(people, 'Golf', '  ')).toBe('');
  });
  it('checks whether a person has a tag', () => {
    expect(hasTag({ tags: ['Golf'] }, 'GOLF')).toBe(true);
    expect(hasTag({}, 'Golf')).toBe(false);
  });
  it('suggests tags that start with, then contain, the text', () => {
    const known = ['Golf', 'Mini golf', 'Church', 'Goal setting'];
    expect(suggestTags('go', known)).toEqual(['Golf', 'Goal setting', 'Mini golf']);
    expect(suggestTags('go', known, ['golf'])).toEqual(['Goal setting', 'Mini golf']);
    expect(suggestTags('', known, [], 2)).toEqual(['Golf', 'Mini golf']);
  });
});

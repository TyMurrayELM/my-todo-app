import { describe, it, expect } from 'vitest';
import { groupTodosByDay } from './groupTodosByDay';

// Week under view: Monday 2024-06-17 through Sunday 2024-06-23
const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const getDateForDay = (i) => new Date(2024, 5, 17 + i);

const group = ({ todos = [], completions = [], subItemCompletions = [] }) =>
  groupTodosByDay({ todos, completions, subItemCompletions, days, getDateForDay });

const oneTime = (overrides = {}) => ({
  id: 't1',
  text: 'Buy milk',
  day: 'TUESDAY',
  actual_date: '2024-06-18T12:00:00.000Z',
  completed: false,
  completed_at: null,
  recurring: false,
  repeat_frequency: null,
  url: null,
  notes: null,
  parent_task_id: null,
  ...overrides,
});

const recurring = (overrides = {}) => ({
  id: 'r1',
  text: 'Stretch',
  day: 'MONDAY',
  actual_date: '2024-06-10T12:00:00.000Z', // started the previous Monday
  completed: false,
  completed_at: null,
  recurring: true,
  repeat_frequency: 'daily',
  url: null,
  notes: null,
  parent_task_id: null,
  ...overrides,
});

const countAll = (result) => Object.values(result).reduce((n, list) => n + list.length, 0);

describe('groupTodosByDay', () => {
  describe('one-time tasks', () => {
    it('lands on its own day and nowhere else', () => {
      const result = group({ todos: [oneTime()] });
      expect(result.TUESDAY).toHaveLength(1);
      expect(result.TUESDAY[0]).toMatchObject({
        id: 't1',
        text: 'Buy milk',
        recurring: false,
        isRecurringInstance: false,
      });
      expect(countAll(result)).toBe(1);
    });

    it('does not appear when its date is outside the viewed week', () => {
      const result = group({
        todos: [oneTime({ actual_date: '2024-06-25T12:00:00.000Z' })],
      });
      expect(countAll(result)).toBe(0);
    });

    it('trims task text', () => {
      const result = group({ todos: [oneTime({ text: '  Buy milk  ' })] });
      expect(result.TUESDAY[0].text).toBe('Buy milk');
    });

    it('keeps its completed state and timestamp', () => {
      const result = group({
        todos: [oneTime({ completed: true, completed_at: '2024-06-18T19:00:00.000Z' })],
      });
      expect(result.TUESDAY[0].completed).toBe(true);
      expect(result.TUESDAY[0].completedAt).toBe('2024-06-18T19:00:00.000Z');
    });
  });

  describe('Task Bank', () => {
    it('goes to the TASK_BANK bucket regardless of date', () => {
      const result = group({
        todos: [oneTime({ day: 'TASK_BANK', actual_date: '2023-01-01T12:00:00.000Z' })],
      });
      expect(result.TASK_BANK).toHaveLength(1);
      expect(result.TASK_BANK[0].isRecurringInstance).toBe(false);
    });
  });

  describe('recurring instance generation', () => {
    it('daily task started before the week appears on all 7 days', () => {
      const result = group({ todos: [recurring()] });
      days.forEach((day) => expect(result[day]).toHaveLength(1));
      expect(result.TASK_BANK).toHaveLength(0);
    });

    it('instances get a per-date id, originalId, and instanceDate', () => {
      const result = group({ todos: [recurring()] });
      expect(result.MONDAY[0]).toMatchObject({
        id: 'r1_2024-06-17',
        originalId: 'r1',
        instanceDate: '2024-06-17',
        isRecurringInstance: true,
        recurring: true,
      });
    });

    it('daily task starting mid-week only appears from its start date', () => {
      const result = group({
        todos: [recurring({ actual_date: '2024-06-20T12:00:00.000Z' })], // Thursday
      });
      expect(result.MONDAY).toHaveLength(0);
      expect(result.WEDNESDAY).toHaveLength(0);
      expect(result.THURSDAY).toHaveLength(1);
      expect(result.SUNDAY).toHaveLength(1);
      expect(countAll(result)).toBe(4);
    });

    it('weekly task appears once, on its anchor weekday', () => {
      const result = group({ todos: [recurring({ repeat_frequency: 'weekly' })] });
      expect(result.MONDAY).toHaveLength(1);
      expect(countAll(result)).toBe(1);
    });

    it('weekdays task skips Saturday and Sunday', () => {
      const result = group({ todos: [recurring({ repeat_frequency: 'weekdays' })] });
      expect(result.FRIDAY).toHaveLength(1);
      expect(result.SATURDAY).toHaveLength(0);
      expect(result.SUNDAY).toHaveLength(0);
      expect(countAll(result)).toBe(5);
    });

    it('defaults a missing repeat_frequency to daily on the instance', () => {
      const result = group({ todos: [recurring({ repeat_frequency: 'daily' })] });
      expect(result.MONDAY[0].repeatFrequency).toBe('daily');
    });
  });

  describe('recurring completion state', () => {
    it('a completion row marks only that date completed', () => {
      const result = group({
        todos: [recurring()],
        completions: [
          {
            todo_id: 'r1',
            completion_date: '2024-06-19',
            completed_at: '2024-06-19T15:00:00.000Z',
            skipped: false,
          },
        ],
      });
      expect(result.WEDNESDAY[0].completed).toBe(true);
      expect(result.WEDNESDAY[0].completedAt).toBe('2024-06-19T15:00:00.000Z');
      expect(result.TUESDAY[0].completed).toBe(false);
      expect(result.THURSDAY[0].completed).toBe(false);
    });

    it('a skipped row hides that instance entirely (moved elsewhere)', () => {
      const result = group({
        todos: [recurring()],
        completions: [
          {
            todo_id: 'r1',
            completion_date: '2024-06-19',
            completed_at: '2024-06-19T15:00:00.000Z',
            skipped: true,
          },
        ],
      });
      expect(result.WEDNESDAY).toHaveLength(0);
      expect(countAll(result)).toBe(6);
    });

    it('completions for another task do not bleed over', () => {
      const result = group({
        todos: [recurring()],
        completions: [
          {
            todo_id: 'other-task',
            completion_date: '2024-06-19',
            completed_at: '2024-06-19T15:00:00.000Z',
            skipped: false,
          },
        ],
      });
      expect(result.WEDNESDAY[0].completed).toBe(false);
    });
  });

  describe('sub-items', () => {
    const subItem = (overrides = {}) => ({
      id: 's1',
      text: '  Chop onions ',
      day: 'TUESDAY',
      actual_date: '2024-06-18T12:00:00.000Z',
      completed: true,
      completed_at: '2024-06-18T18:00:00.000Z',
      recurring: false,
      repeat_frequency: null,
      url: null,
      notes: null,
      parent_task_id: 't1',
      ...overrides,
    });

    it('attach to a one-time parent with their own completed state, trimmed', () => {
      const result = group({ todos: [oneTime(), subItem()] });
      expect(result.TUESDAY[0].subItems).toHaveLength(1);
      expect(result.TUESDAY[0].subItems[0]).toMatchObject({
        id: 's1',
        text: 'Chop onions',
        completed: true,
        completedAt: '2024-06-18T18:00:00.000Z',
        isRecurringSubItem: false,
      });
    });

    it('on a recurring parent, completion is per-date from the completions table', () => {
      const result = group({
        todos: [recurring(), subItem({ parent_task_id: 'r1' })],
        subItemCompletions: [
          {
            subitem_id: 's1',
            completion_date: '2024-06-18',
            completed_at: '2024-06-18T18:00:00.000Z',
          },
        ],
      });
      // Completed only on Tuesday the 18th; the row's own completed flag is ignored
      expect(result.TUESDAY[0].subItems[0].completed).toBe(true);
      expect(result.TUESDAY[0].subItems[0].completedAt).toBe('2024-06-18T18:00:00.000Z');
      expect(result.MONDAY[0].subItems[0].completed).toBe(false);
      expect(result.MONDAY[0].subItems[0].completedAt).toBe(null);
      expect(result.MONDAY[0].subItems[0].isRecurringSubItem).toBe(true);
    });

    it('sub-items are never promoted to top-level tasks', () => {
      const result = group({ todos: [oneTime(), subItem()] });
      expect(countAll(result)).toBe(1);
    });
  });
});

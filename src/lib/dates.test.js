import { describe, it, expect } from 'vitest';
import { shouldShowOnDate } from './dates';

const task = (frequency, actualDate) => ({
  recurring: true,
  repeat_frequency: frequency,
  actual_date: actualDate,
});

describe('shouldShowOnDate', () => {
  describe('guards', () => {
    it('returns false for non-recurring tasks', () => {
      expect(
        shouldShowOnDate(
          { recurring: false, repeat_frequency: 'daily', actual_date: '2024-06-15' },
          new Date(2024, 5, 15)
        )
      ).toBe(false);
    });

    it('returns false when repeat_frequency is missing', () => {
      expect(
        shouldShowOnDate({ recurring: true, actual_date: '2024-06-15' }, new Date(2024, 5, 15))
      ).toBe(false);
    });

    it('returns false for dates before the start date', () => {
      expect(shouldShowOnDate(task('daily', '2024-06-15'), new Date(2024, 5, 14))).toBe(false);
    });

    it('returns false for unknown frequency', () => {
      expect(
        shouldShowOnDate(
          { recurring: true, repeat_frequency: 'yearly', actual_date: '2024-06-15' },
          new Date(2025, 5, 15)
        )
      ).toBe(false);
    });
  });

  describe('daily', () => {
    const t = task('daily', '2024-06-15');
    it('shows on start date', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 15))).toBe(true);
    });
    it('shows the day after', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 16))).toBe(true);
    });
    it('shows a week later', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 22))).toBe(true);
    });
  });

  describe('every-other-day', () => {
    const t = task('every-other-day', '2024-06-15');
    it('shows on start date (day 0)', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 15))).toBe(true);
    });
    it('does not show on day 1', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 16))).toBe(false);
    });
    it('shows on day 2', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 17))).toBe(true);
    });
  });

  describe('weekdays', () => {
    // 2024-06-17 is a Monday
    const t = task('weekdays', '2024-06-17');
    it('shows on Monday', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 17))).toBe(true);
    });
    it('shows on Friday', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 21))).toBe(true);
    });
    it('does not show on Saturday', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 22))).toBe(false);
    });
    it('does not show on Sunday', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 23))).toBe(false);
    });
  });

  describe('weekly', () => {
    const t = task('weekly', '2024-06-15');
    it('shows on start date', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 15))).toBe(true);
    });
    it('shows exactly 7 days later', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 22))).toBe(true);
    });
    it('does not show 6 days later', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 21))).toBe(false);
    });
  });

  describe('bi-weekly', () => {
    const t = task('bi-weekly', '2024-06-15');
    it('shows on start date', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 15))).toBe(true);
    });
    it('shows 14 days later', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 29))).toBe(true);
    });
    it('does not show 7 days later', () => {
      expect(shouldShowOnDate(t, new Date(2024, 5, 22))).toBe(false);
    });
  });

  describe('monthly', () => {
    it('shows on the same day next month', () => {
      expect(shouldShowOnDate(task('monthly', '2024-06-15'), new Date(2024, 6, 15))).toBe(true);
    });
    it('clamps Jan 31 -> Feb 29 in a leap year', () => {
      expect(shouldShowOnDate(task('monthly', '2024-01-31'), new Date(2024, 1, 29))).toBe(true);
    });
    it('clamps Jan 31 -> Feb 28 in a non-leap year', () => {
      expect(shouldShowOnDate(task('monthly', '2023-01-31'), new Date(2023, 1, 28))).toBe(true);
    });
    it('shows on Mar 31 for a Jan 31 task (no clamp needed)', () => {
      expect(shouldShowOnDate(task('monthly', '2024-01-31'), new Date(2024, 2, 31))).toBe(true);
    });
    it('does not show on the wrong day', () => {
      expect(shouldShowOnDate(task('monthly', '2024-06-15'), new Date(2024, 6, 14))).toBe(false);
    });
  });

  describe('first-of-month', () => {
    const t = task('first-of-month', '2024-06-01');
    it('shows on the 1st', () => {
      expect(shouldShowOnDate(t, new Date(2024, 6, 1))).toBe(true);
    });
    it('does not show on the 2nd', () => {
      expect(shouldShowOnDate(t, new Date(2024, 6, 2))).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { shouldShowOnDate, computeMoveTargetDate, DAY_NAMES, getLocalDateString } from './dates';

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

describe('computeMoveTargetDate', () => {
  // 2024-06-17 is a Monday, 2024-06-21 Friday, 2024-06-22 Saturday, 2024-06-23 Sunday
  const monday = new Date(2024, 5, 17);
  const friday = new Date(2024, 5, 21);
  const saturday = new Date(2024, 5, 22);
  const sunday = new Date(2024, 5, 23);

  const result = (moveType, fromDate) =>
    getLocalDateString(computeMoveTargetDate(moveType, fromDate));

  describe('today', () => {
    it('returns the injected today at local midnight, ignoring fromDate', () => {
      const target = computeMoveTargetDate('today', monday, new Date(2024, 5, 19, 15, 30));
      expect(getLocalDateString(target)).toBe('2024-06-19');
      expect(target.getHours()).toBe(0);
    });
  });

  describe('next-day', () => {
    it('moves forward one day', () => {
      expect(result('next-day', monday)).toBe('2024-06-18');
    });
    it('rolls over a month boundary', () => {
      expect(result('next-day', new Date(2024, 5, 30))).toBe('2024-07-01');
    });
  });

  describe('next-week', () => {
    it('moves forward seven days', () => {
      expect(result('next-week', monday)).toBe('2024-06-24');
    });
    it('rolls over a year boundary', () => {
      expect(result('next-week', new Date(2024, 11, 30))).toBe('2025-01-06');
    });
  });

  describe('next-weekday', () => {
    it('Monday moves to Tuesday', () => {
      expect(result('next-weekday', monday)).toBe('2024-06-18');
    });
    it('Friday skips the weekend to Monday', () => {
      expect(result('next-weekday', friday)).toBe('2024-06-24');
    });
    it('Saturday moves to Monday', () => {
      expect(result('next-weekday', saturday)).toBe('2024-06-24');
    });
  });

  describe('next-weekend', () => {
    it('Monday moves to the coming Saturday', () => {
      expect(result('next-weekend', monday)).toBe('2024-06-22');
    });
    it('Sunday moves to the next Saturday, not backward', () => {
      expect(result('next-weekend', sunday)).toBe('2024-06-29');
    });
    it('Saturday moves a full week out', () => {
      expect(result('next-weekend', saturday)).toBe('2024-06-29');
    });
  });

  it('does not mutate the input date', () => {
    const original = new Date(2024, 5, 17);
    computeMoveTargetDate('next-week', original);
    expect(getLocalDateString(original)).toBe('2024-06-17');
  });

  it('maps every target onto the correct day name', () => {
    expect(DAY_NAMES[computeMoveTargetDate('next-weekend', monday).getDay()]).toBe('SATURDAY');
    expect(DAY_NAMES[computeMoveTargetDate('next-weekday', friday).getDay()]).toBe('MONDAY');
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseCustomFrequency,
  buildIntervalFrequency,
  buildWeekdaysFrequency,
  describeCustomFrequency,
  customFrequencyBadge,
} from './frequency';

describe('parseCustomFrequency', () => {
  it('parses interval frequencies', () => {
    expect(parseCustomFrequency('every:3:days')).toEqual({ kind: 'interval', n: 3, unit: 'days' });
    expect(parseCustomFrequency('every:6:weeks')).toEqual({
      kind: 'interval',
      n: 6,
      unit: 'weeks',
    });
  });

  it('parses weekday frequencies sorted and deduped', () => {
    expect(parseCustomFrequency('days:FR,MO,MO,WE')).toEqual({ kind: 'weekdays', days: [1, 3, 5] });
  });

  it('returns null for presets', () => {
    expect(parseCustomFrequency('daily')).toBeNull();
    expect(parseCustomFrequency('bi-weekly')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseCustomFrequency(null)).toBeNull();
    expect(parseCustomFrequency('every:0:days')).toBeNull();
    expect(parseCustomFrequency('every:-2:days')).toBeNull();
    expect(parseCustomFrequency('every:2.5:days')).toBeNull();
    expect(parseCustomFrequency('every:400:days')).toBeNull();
    expect(parseCustomFrequency('every:3:months')).toBeNull();
    expect(parseCustomFrequency('days:')).toBeNull();
    expect(parseCustomFrequency('days:MO,XX')).toBeNull();
  });
});

describe('builders round-trip through the parser', () => {
  it('interval', () => {
    expect(parseCustomFrequency(buildIntervalFrequency(4, 'days'))).toEqual({
      kind: 'interval',
      n: 4,
      unit: 'days',
    });
  });

  it('weekdays (unsorted input)', () => {
    expect(buildWeekdaysFrequency([5, 1, 3])).toBe('days:MO,WE,FR');
    expect(parseCustomFrequency(buildWeekdaysFrequency([5, 1, 3]))).toEqual({
      kind: 'weekdays',
      days: [1, 3, 5],
    });
  });
});

describe('describeCustomFrequency', () => {
  it('describes intervals', () => {
    expect(describeCustomFrequency('every:3:days')).toBe('Repeats every 3 days');
    expect(describeCustomFrequency('every:1:weeks')).toBe('Repeats every week');
  });

  it('describes weekdays', () => {
    expect(describeCustomFrequency('days:MO,WE,FR')).toBe('Repeats on Mon, Wed, Fri');
  });

  it('returns null for non-custom strings', () => {
    expect(describeCustomFrequency('daily')).toBeNull();
  });
});

describe('customFrequencyBadge', () => {
  it('badges intervals', () => {
    expect(customFrequencyBadge('every:3:days')).toBe('3d');
    expect(customFrequencyBadge('every:6:weeks')).toBe('6w');
  });

  it('badges weekdays', () => {
    expect(customFrequencyBadge('days:MO,WE,FR')).toBe('MWF');
  });

  it('returns null for non-custom strings', () => {
    expect(customFrequencyBadge('weekly')).toBeNull();
  });
});

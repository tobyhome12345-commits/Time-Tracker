import { describe, expect, it } from 'vitest';
import { addDays, dailyTotals, dayKey, entriesOnDay, fmtClock, fmtDur, splitByDay, startOfDay, startOfWeek, MIN } from '../src/logic/time';
import type { Entry } from '../src/data/types';

process.env.TZ = 'Europe/London';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
let n = 0;
const entry = (kind: Entry['kind'], start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({
  id: `e${n++}`,
  kind,
  start,
  minutes,
  source: 'quick',
  createdAt: start,
  updatedAt: start,
  ...extra,
});

describe('splitByDay', () => {
  it('keeps a same-day entry whole', () => {
    expect(splitByDay({ start: at(2026, 11, 26, 15), minutes: 45 })).toEqual([{ day: '2026-11-26', minutes: 45 }]);
  });

  it('splits an entry across midnight', () => {
    const parts = splitByDay({ start: at(2026, 11, 25, 23, 30), minutes: 60 });
    expect(parts).toEqual([
      { day: '2026-11-25', minutes: 30 },
      { day: '2026-11-26', minutes: 30 },
    ]);
  });

  it('chunks always add back up to the total', () => {
    const parts = splitByDay({ start: at(2026, 11, 25, 22, 17), minutes: 1000 });
    expect(parts.reduce((a, p) => a + p.minutes, 0)).toBe(1000);
  });

  it('handles the DST change day (clocks go back)', () => {
    // 25 Oct 2026 has 25 hours in London.
    const parts = splitByDay({ start: at(2026, 10, 25, 0, 30), minutes: 120 });
    expect(parts).toEqual([{ day: '2026-10-25', minutes: 120 }]);
  });
});

describe('dailyTotals', () => {
  it('sums per day and kind', () => {
    const map = dailyTotals([
      entry('outside', at(2026, 11, 26, 9), 30),
      entry('outside', at(2026, 11, 26, 15), 45),
      entry('inside', at(2026, 11, 26, 19), 90),
      entry('inside', at(2026, 11, 25, 23, 45), 30),
    ]);
    expect(map.get('2026-11-26')).toEqual({ inside: 90 + 15, outside: 75 });
    expect(map.get('2026-11-25')).toEqual({ inside: 15, outside: 0 });
  });
});

describe('entriesOnDay', () => {
  it('includes entries overlapping the day', () => {
    const a = entry('inside', at(2026, 11, 25, 23, 30), 60);
    const b = entry('outside', at(2026, 11, 26, 10), 30);
    const c = entry('outside', at(2026, 11, 27, 0), 30);
    const day = at(2026, 11, 26);
    expect(entriesOnDay([a, b, c], day).map((e) => e.id)).toEqual([a.id, b.id]);
  });
});

describe('dates', () => {
  it('week starts on Monday', () => {
    expect(dayKey(startOfWeek(at(2026, 11, 26, 18)))).toBe('2026-11-23');
    expect(dayKey(startOfWeek(at(2026, 11, 29, 18)))).toBe('2026-11-23'); // Sunday
    expect(dayKey(startOfWeek(at(2026, 11, 30, 1)))).toBe('2026-11-30'); // Monday
  });

  it('addDays is calendar-based across DST', () => {
    expect(dayKey(addDays(at(2026, 10, 24), 1))).toBe('2026-10-25');
    expect(dayKey(addDays(at(2026, 10, 25), 1))).toBe('2026-10-26');
    expect(startOfDay(at(2026, 10, 25, 23, 59))).toBe(at(2026, 10, 25));
  });
});

describe('formatting', () => {
  it('fmtDur', () => {
    expect(fmtDur(5)).toBe('5m');
    expect(fmtDur(60)).toBe('1h');
    expect(fmtDur(95)).toBe('1h 35m');
  });
  it('fmtClock', () => {
    expect(fmtClock(65 * 1000)).toBe('01:05');
    expect(fmtClock(3600 * 1000 + 5 * MIN + 9000)).toBe('1:05:09');
  });
});

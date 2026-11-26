import { describe, expect, it } from 'vitest';
import { insights, periodStats } from '../src/logic/stats';
import { dailyTotals } from '../src/logic/time';
import type { Entry } from '../src/data/types';

const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
let n = 0;
const e = (kind: Entry['kind'], start: number, minutes: number, category?: string): Entry => ({
  id: `s${n++}`,
  kind,
  start,
  minutes,
  category,
  source: 'quick',
  createdAt: start,
  updatedAt: start,
});

// "Now" = Thursday 26 Nov 2026, 18:00
const NOW = at(2026, 11, 26, 18);

describe('periodStats (week)', () => {
  const entries = [
    // this week (Mon 23 – Thu 26 so far)
    e('outside', at(2026, 11, 23), 60),
    e('inside', at(2026, 11, 23, 19), 120),
    e('outside', at(2026, 11, 26), 90),
    // last week: Mon 16 – Thu 19 (compared) + Sat 21 (not compared for the current week)
    e('outside', at(2026, 11, 17), 30),
    e('inside', at(2026, 11, 18), 60),
    e('outside', at(2026, 11, 21), 300),
  ];
  const map = dailyTotals(entries);
  const s = periodStats(map, 'week', NOW, NOW);

  it('covers Mon–Sun with future days flagged', () => {
    expect(s.days).toHaveLength(7);
    expect(s.days[0].key).toBe('2026-11-23');
    expect(s.days.filter((d) => d.future).map((d) => d.key)).toEqual(['2026-11-27', '2026-11-28', '2026-11-29']);
  });

  it('sums the current period and computes outside %', () => {
    expect(s.cur).toEqual({ outside: 150, inside: 120, outsidePct: 150 / 270 });
    expect(s.isCurrent).toBe(true);
    expect(s.loggedDays).toBe(2);
  });

  it('compares against the same point of last week (Mon–Thu only)', () => {
    expect(s.prev.outside).toBe(30);
    expect(s.prev.inside).toBe(60);
  });

  it('compares a past week against the full week before', () => {
    const past = periodStats(map, 'week', at(2026, 11, 18), NOW);
    expect(past.isCurrent).toBe(false);
    expect(past.cur.outside).toBe(330);
    expect(past.prev.outside).toBe(0);
  });
});

describe('periodStats (month)', () => {
  it('has the right number of days', () => {
    const map = dailyTotals([]);
    expect(periodStats(map, 'month', at(2026, 2, 10), NOW).days).toHaveLength(28);
    expect(periodStats(map, 'month', NOW, NOW).days).toHaveLength(30);
    expect(periodStats(map, 'month', NOW, NOW).cur.outsidePct).toBeNull();
  });
});

describe('insights', () => {
  const entries = [
    e('outside', at(2026, 11, 20, 9), 60, 'walking'),
    e('outside', at(2026, 11, 21, 14), 180, 'sport'),
    e('outside', at(2026, 11, 22, 18), 30, 'sport'),
    e('inside', at(2026, 11, 21, 19), 60, 'gaming'),
    e('inside', at(2026, 11, 25, 19), 240, 'gaming'),
    e('inside', at(2026, 11, 26, 16), 30),
  ].sort((a, b) => a.start - b.start);
  const map = dailyTotals(entries);
  const ins = insights(entries, map, 30, NOW);

  it('only averages over days since the first log', () => {
    expect(ins.days).toBe(7); // 20th..26th
    expect(ins.avgOutside).toBeCloseTo(270 / 7);
    expect(ins.avgInside).toBeCloseTo(330 / 7);
  });

  it('finds the best outside day and best balance day', () => {
    expect(ins.bestDay?.key).toBe('2026-11-21');
    expect(ins.bestDay?.outside).toBe(180);
    expect(ins.bestBalanceDay?.key).toBe('2026-11-20'); // 100% outside, ≥ 1h logged
  });

  it('ranks categories by minutes, with counts', () => {
    expect(ins.categories.outside.map((c) => [c.id, c.minutes, c.count])).toEqual([
      ['sport', 210, 2],
      ['walking', 60, 1],
    ]);
    expect(ins.categories.inside[0]).toMatchObject({ id: 'gaming', minutes: 300, count: 2 });
    expect(ins.categories.inside[1]).toMatchObject({ id: '', minutes: 30 });
  });

  it('splits outside time into parts of the day', () => {
    expect(ins.partOfDay).toEqual({ morning: 60, afternoon: 180, evening: 30 });
  });

  it('finds the most outdoorsy weekday (Sat 21st)', () => {
    expect(ins.topWeekday).toBe(5);
  });

  it('respects a 7-day range', () => {
    const wk = insights(entries, map, 3, NOW); // 24th..26th
    expect(wk.days).toBe(3);
    expect(wk.totalOutside).toBe(0);
    expect(wk.bestDay).toBeNull();
  });
});

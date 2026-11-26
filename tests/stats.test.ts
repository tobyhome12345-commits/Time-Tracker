import { describe, expect, it } from 'vitest';
import { insights, periodStats } from '../src/logic/stats';
import { buildLedger } from '../src/logic/xp';
import { dailyTotals } from '../src/logic/time';
import { emptyData, type AppData, type Entry } from '../src/data/types';

const at = (d: number, h = 12, mi = 0) => new Date(2026, 10, d, h, mi).getTime();
const NOW = at(26, 18); // Thu 26 Nov 2026
let n = 0;
const e = (start: number, minutes: number, extra: Partial<Entry> = {}): Entry => ({ id: `s${n++}`, start, minutes, source: 'quick', createdAt: start, updatedAt: start, ...extra });

function setup(entries: Entry[], patch: Partial<AppData> = {}) {
  const data: AppData = { ...emptyData('2026-11-16'), entries: entries.sort((a, b) => a.start - b.start), ...patch };
  const map = dailyTotals(data.entries);
  const ledger = buildLedger(data, map, NOW);
  return { data, map, ledger };
}

describe('periodStats (week)', () => {
  const { data, map, ledger } = setup([
    e(at(23), 90), // Mon hit (+25+30+5)
    e(at(24), 30), // Tue miss (−30)
    e(at(26, 9), 20), // Thu, today, pending
    e(at(16), 60), // last Mon hit
    e(at(21), 200), // last Sat (not compared for the current week)
  ]);
  const s = periodStats(data, map, ledger, 'week', NOW, NOW);

  it('covers Mon–Sun with targets, hits, XP and future flags', () => {
    expect(s.days.map((d) => d.key)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    expect(s.days.map((d) => d.target)).toEqual([60, 60, 60, 60, 60, 120, 120]);
    expect(s.days[0]).toMatchObject({ hit: true, xp: 60 });
    expect(s.days[1]).toMatchObject({ hit: false, xp: -30 });
    expect(s.days[3]).toMatchObject({ isToday: true, xp: null });
    expect(s.days.filter((d) => d.future)).toHaveLength(3);
  });

  it('summarises time, hits and XP and compares the same elapsed days of last week', () => {
    expect(s.compared).toBe(4);
    expect(s.cur).toMatchObject({ minutes: 140, hits: 1, days: 4 });
    expect(s.cur.xp).toBe(60 - 30 - 60); // Wed 25th missed entirely
    expect(s.prev.minutes).toBe(60); // Mon–Thu of last week only
  });
});

describe('periodStats (month)', () => {
  it('has the right number of days and marks holidays', () => {
    const { data, map, ledger } = setup([], { holidays: [{ id: 'h', name: 'Half term', start: '2026-11-02', end: '2026-11-06' }] });
    const s = periodStats(data, map, ledger, 'month', NOW, NOW);
    expect(s.days).toHaveLength(30);
    expect(s.days[2]).toMatchObject({ type: 'holiday', holidayName: 'Half term', target: 120, tracked: false });
  });
});

describe('insights', () => {
  const { data, map, ledger } = setup([
    e(at(20, 9), 60, { category: 'walking' }),
    e(at(21, 14), 180, { category: 'sport' }),
    e(at(22, 18), 30, { category: 'sport' }),
    e(at(23, 16), 45),
  ]);

  it('averages since the first log, weekdays vs weekends', () => {
    const ins = insights(data.entries, map, ledger, 30, NOW);
    expect(ins.days).toBe(7); // 20th..26th
    expect(ins.totalMinutes).toBe(315);
    expect(ins.avg).toBeCloseTo(45);
    expect(ins.weekendAvg).toBeCloseTo((180 + 30) / 2);
    expect(ins.weekdayAvg).toBeCloseTo((60 + 45) / 5);
  });

  it('finds best day, longest outing, top activities and time of day', () => {
    const ins = insights(data.entries, map, ledger, null, NOW);
    expect(ins.bestDay?.key).toBe('2026-11-21');
    expect(ins.longest?.minutes).toBe(180);
    expect(ins.categories.map((c) => [c.id, c.minutes, c.count])).toEqual([
      ['sport', 210, 2],
      ['walking', 60, 1],
      ['', 45, 1],
    ]);
    expect(ins.partOfDay).toEqual({ morning: 60, afternoon: 225, evening: 30 });
    expect(ins.topWeekday).toBe(5); // Saturday
  });

  it('hit rate counts finished, non-rest tracked days', () => {
    const ins = insights(data.entries, map, ledger, 30, NOW);
    // range starts at the first log (20th): hits 20 (60≥60), 21 (180≥120); misses 22 (30<120), 23, 24, 25; today pending
    expect(ins.hitRate).toBeCloseTo(2 / 6);
  });
});
